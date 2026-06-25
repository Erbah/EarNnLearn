from typing import List, Optional
from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.shop import Product, Order, Escrow, ShopSetting
from app.services.shop_service import ShopService

router = APIRouter()

# --- Pydantic Schemas ---
class ProductCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: str = Field(..., min_length=10)
    price: Decimal = Field(..., gt=0)
    product_type: str = Field("PHYSICAL", pattern="^(PHYSICAL|DIGITAL)$")
    image_urls: Optional[List[str]] = None

class ProductOut(BaseModel):
    id: str
    seller_rid: str
    title: str
    description: str
    price: Decimal
    currency: str
    stock: int
    image_urls: Optional[List[str]] = None
    product_type: str
    status: str
    review_feedback: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    product_id: str
    quantity: int = Field(1, ge=1)
    shipping_address: Optional[str] = None

class OrderOut(BaseModel):
    id: str
    buyer_rid: str
    product_id: str
    quantity: int
    total_price: Decimal
    shipping_address: Optional[str] = None
    shipping_status: str
    tracking_code: Optional[str] = None
    buyer_confirmed: bool
    created_at: datetime

    class Config:
        from_attributes = True

class ShipOrder(BaseModel):
    tracking_code: str

class DisputeOrder(BaseModel):
    reason: str

class SettingsUpdate(BaseModel):
    ai_rules_prompt: str
    platform_commission: Decimal = Field(..., ge=0, le=1)

class SettingsOut(BaseModel):
    ai_rules_prompt: str
    platform_commission: Decimal

    class Config:
        from_attributes = True

class AdminProductReview(BaseModel):
    approved: bool
    review_feedback: str


# --- User Endpoints (Shopping & Selling) ---

@router.post("/products", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    body: ProductCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Creates a new product listing. Initiates background AI content review.
    """
    db_product = Product(
        seller_rid=current_user.rid,
        title=body.title,
        description=body.description,
        price=body.price,
        product_type=body.product_type,
        image_urls=body.image_urls,
        status="PENDING_AI_REVIEW"
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # Trigger AI Review asynchronously
    background_tasks.add_task(ShopService.trigger_ai_review, db, db_product)
    return db_product


@router.get("/products", response_model=List[ProductOut])
def get_approved_products(db: Session = Depends(get_db)):
    """
    Fetches all approved product listings for the store catalog.
    """
    ShopService.release_expired_digital_escrows(db)
    return db.query(Product).filter(Product.status.in_(["APPROVED", "ADMIN_APPROVED"]), Product.stock > 0).all()


@router.get("/products/my-listings", response_model=List[ProductOut])
def get_user_listings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetches products listed by the current logged-in user.
    """
    return db.query(Product).filter(Product.seller_rid == current_user.rid).all()


@router.get("/products/{product_id}", response_model=ProductOut)
def get_product_details(product_id: str, db: Session = Depends(get_db)):
    """
    Fetches details of a single product.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.post("/buy", response_model=OrderOut)
def buy_product(
    body: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Purchases a product, debits the buyer's wallet, and moves funds into escrow.
    """
    product = db.query(Product).filter(Product.id == body.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.status not in ["APPROVED", "ADMIN_APPROVED"]:
        raise HTTPException(status_code=400, detail="Product is not active or approved")
    if product.stock < body.quantity:
        raise HTTPException(status_code=400, detail="Insufficient product stock")
    if product.seller_rid == current_user.rid:
        raise HTTPException(status_code=400, detail="You cannot buy your own product")

    total_price = product.price * body.quantity

    # Create Order
    order = Order(
        buyer_rid=current_user.rid,
        product_id=product.id,
        quantity=body.quantity,
        total_price=total_price,
        shipping_address=body.shipping_address,
        shipping_status="PENDING_PAYMENT"
    )
    db.add(order)
    db.flush()

    try:
        # Move funds to Escrow
        ShopService.process_escrow_hold(db, order)
        
        # Decrement stock
        product.stock -= body.quantity
        db.add(product)
        db.commit()
        db.refresh(order)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Transaction failed processing escrow.")

    return order


@router.post("/orders/{order_id}/ship", response_model=OrderOut)
def ship_order(
    order_id: str,
    body: ShipOrder,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows a seller to mark an order as shipped and supply tracking details.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    product = db.query(Product).filter(Product.id == order.product_id).first()
    if not product or product.seller_rid != current_user.rid:
        raise HTTPException(status_code=403, detail="You are not the seller of this order")

    if order.shipping_status != "ESCROWED":
        raise HTTPException(status_code=400, detail="Order cannot be shipped in its current status")

    order.shipping_status = "SHIPPED"
    order.tracking_code = body.tracking_code
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.post("/orders/{order_id}/confirm", response_model=OrderOut)
def confirm_delivery(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows a buyer to confirm delivery of physical goods, triggering release of escrow.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.buyer_rid != current_user.rid:
        raise HTTPException(status_code=403, detail="You are not the buyer of this order")

    if order.shipping_status not in ["SHIPPED", "ESCROWED"]:
        raise HTTPException(status_code=400, detail="Order delivery cannot be confirmed in its current status")

    try:
        ShopService.process_escrow_release(db, order)
        order.shipping_status = "DELIVERED"
        db.add(order)
        db.commit()
        db.refresh(order)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    return order


@router.post("/orders/{order_id}/dispute", response_model=OrderOut)
def dispute_order(
    order_id: str,
    body: DisputeOrder,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Allows a buyer to lock escrow funds and file a dispute.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.buyer_rid != current_user.rid:
        raise HTTPException(status_code=403, detail="You are not the buyer of this order")

    if order.shipping_status not in ["ESCROWED", "SHIPPED"]:
        raise HTTPException(status_code=400, detail="Order cannot be disputed in its current status")

    try:
        ShopService.process_dispute_hold(db, order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return order


@router.get("/orders/buyer", response_model=List[OrderOut])
def get_buyer_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists all orders made by the logged-in user.
    """
    ShopService.release_expired_digital_escrows(db)
    return db.query(Order).filter(Order.buyer_rid == current_user.rid).all()


@router.get("/orders/seller", response_model=List[OrderOut])
def get_seller_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Lists all sales orders for products owned by the logged-in user.
    """
    ShopService.release_expired_digital_escrows(db)
    return db.query(Order).join(Product, Order.product_id == Product.id).filter(Product.seller_rid == current_user.rid).all()


# --- Admin Shop Moderation Endpoints ---

def verify_admin_access(current_user: User = Depends(get_current_user)):
    if current_user.role not in ["SUPER_ADMIN", "EDUCATION_ADMIN"]:
        raise HTTPException(status_code=403, detail="Admin permissions required")

@router.get("/admin/settings", response_model=SettingsOut, dependencies=[Depends(verify_admin_access)])
def get_shop_settings(db: Session = Depends(get_db)):
    """
    Fetches platform shop and AI review rules settings.
    """
    setting = db.query(ShopSetting).filter(ShopSetting.id == "AI_REVIEW_CONFIG").first()
    if not setting:
        setting = ShopSetting()
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


@router.put("/admin/settings", response_model=SettingsOut, dependencies=[Depends(verify_admin_access)])
def update_shop_settings(body: SettingsUpdate, db: Session = Depends(get_db)):
    """
    Updates the platform AI review rules guidelines and commission rate.
    """
    setting = db.query(ShopSetting).filter(ShopSetting.id == "AI_REVIEW_CONFIG").first()
    if not setting:
        setting = ShopSetting()
    setting.ai_rules_prompt = body.ai_rules_prompt
    setting.platform_commission = body.platform_commission
    db.add(setting)
    db.commit()
    db.refresh(setting)
    return setting


@router.get("/admin/pending", response_model=List[ProductOut], dependencies=[Depends(verify_admin_access)])
def get_pending_moderation_products(db: Session = Depends(get_db)):
    """
    Fetches a list of all products waiting for moderation or rejected by AI.
    """
    return db.query(Product).filter(Product.status.in_(["PENDING_AI_REVIEW", "REJECTED"])).all()


@router.post("/admin/review/{product_id}", response_model=ProductOut, dependencies=[Depends(verify_admin_access)])
def admin_manual_review(
    product_id: str,
    body: AdminProductReview,
    db: Session = Depends(get_db)
):
    """
    Allows admin to override AI reviews and manually approve/reject a product listing.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    product.status = "ADMIN_APPROVED" if body.approved else "ADMIN_REJECTED"
    product.review_feedback = f"Moderator action: {body.review_feedback}"
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


@router.get("/admin/orders", response_model=List[OrderOut], dependencies=[Depends(verify_admin_access)])
def admin_get_all_orders(db: Session = Depends(get_db)):
    """
    Allows admin to inspect all shop transactions and shipping states.
    """
    ShopService.release_expired_digital_escrows(db)
    return db.query(Order).all()


@router.post("/admin/orders/{order_id}/resolve", response_model=OrderOut, dependencies=[Depends(verify_admin_access)])
def admin_resolve_dispute(
    order_id: str,
    resolution: str = Field("release", pattern="^(release|refund)$"),
    db: Session = Depends(get_db)
):
    """
    Allows admin to resolve a disputed order by releasing escrowed funds to seller or refunding buyer.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if order.shipping_status != "DISPUTED":
        raise HTTPException(status_code=400, detail="Order is not in a disputed state")

    try:
        if resolution == "release":
            # Force release to seller
            ShopService.process_escrow_release(db, order)
            order.shipping_status = "RELEASED"
        else:
            # Force refund to buyer
            ShopService.process_escrow_refund(db, order, reason="Admin arbitration refund")
            order.shipping_status = "REFUNDED"
        
        db.add(order)
        db.commit()
        db.refresh(order)
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    return order
