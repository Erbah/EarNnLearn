import os
import re
import json
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.orm import Session
import litellm

from app.core.config import settings
from app.models.shop import Product, Order, Escrow, ShopSetting
from app.models.wallet import Wallet, WalletTransaction
from app.services.ai_engine import AITutorEngine

logger = logging.getLogger("uvicorn.error")

class ShopService:
    @classmethod
    def trigger_ai_review(cls, db: Session, product: Product) -> Product:
        """
        Runs the product listing through the AI reviewer using the admin's prompt rules.
        Falls back to local heuristic checks if the LLM API is unavailable.
        """
        # Fetch the current AI review prompt rules
        setting = db.query(ShopSetting).filter(ShopSetting.id == "AI_REVIEW_CONFIG").first()
        rules_prompt = setting.ai_rules_prompt if setting else "Ensure content is clean and appropriate."
        
        prompt = (
            f"You are an AI Product Reviewer for the EarNnLearn online marketplace.\n"
            f"Your task is to review the following product listing submission based on the admin's rules.\n\n"
            f"ADMIN RULES:\n"
            f"{rules_prompt}\n\n"
            f"PRODUCT SUBMISSION:\n"
            f"- Title: {product.title}\n"
            f"- Description: {product.description}\n"
            f"- Price: {product.price} {product.currency}\n"
            f"- Type: {product.product_type}\n\n"
            f"OBJECTIVE:\n"
            f"Determine if the product meets the safety, quality, and content rules. Approve or reject it accordingly.\n\n"
            f"Return your review in JSON format with exactly these fields:\n"
            f"{{\n"
            f"  \"approved\": boolean,\n"
            f"  \"feedback\": \"A concise explanation of why it was approved or rejected based on the rules.\"\n"
            f"}}\n"
        )

        try:
            # Re-use existing AITutorEngine active model detection
            provider, model, key, base_url = AITutorEngine._get_active_model(db)
            
            env_key_map = {
                "google": "GEMINI_API_KEY",
                "openai": "OPENAI_API_KEY",
                "anthropic": "ANTHROPIC_API_KEY",
                "deepseek": "DEEPSEEK_API_KEY"
            }
            if provider in env_key_map:
                os.environ[env_key_map[provider]] = key or getattr(settings, f"{provider.upper()}_API_KEY", "") or ""

            if provider == "mock":
                raise Exception("Using mock provider, fallback to local heuristics")

            completion_args = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "timeout": 20
            }
            if base_url:
                completion_args["api_base"] = base_url

            response = litellm.completion(**completion_args)
            raw_text = response.choices[0].message.content
            
            # Extract JSON block
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw_text)
            if json_match:
                raw_text = json_match.group(1).strip()
            
            result = json.loads(raw_text)
            approved = result.get("approved", False)
            feedback = result.get("feedback", "No feedback provided.")
            
            product.status = "APPROVED" if approved else "REJECTED"
            product.review_feedback = feedback
            
        except Exception as e:
            logger.warning(f"AI Review failed ({e}), falling back to local heuristics.")
            # Local heuristics fallback
            title_lower = product.title.lower()
            desc_lower = product.description.lower()
            
            prohibited = ["weapons", "drugs", "scam", "hack", "exploit", "spam", "test item"]
            violations = [word for word in prohibited if word in title_lower or word in desc_lower]
            
            if violations:
                product.status = "REJECTED"
                product.review_feedback = f"Rejected by local reviewer: Content contains prohibited terms: {', '.join(violations)}."
            elif len(product.description) < 20:
                product.status = "REJECTED"
                product.review_feedback = "Rejected by local reviewer: Description is too short (minimum 20 characters)."
            else:
                product.status = "APPROVED"
                product.review_feedback = "Auto-approved by local fallback checks."
        
        db.add(product)
        db.commit()
        db.refresh(product)
        return product

    @classmethod
    def process_escrow_hold(cls, db: Session, order: Order) -> Escrow:
        """
        Locks buyer funds into escrow. Debits the buyer wallet and logs the transaction.
        """
        buyer_wallet = db.query(Wallet).filter(Wallet.user_rid == order.buyer_rid).first()
        if not buyer_wallet or buyer_wallet.balance < order.total_price:
            raise ValueError("Insufficient wallet balance.")
        
        product = db.query(Product).filter(Product.id == order.product_id).first()
        if not product:
            raise ValueError("Product not found.")

        # Debit Buyer
        buyer_wallet.balance -= order.total_price
        db.add(buyer_wallet)
        
        # Log Transaction
        tx = WalletTransaction(
            user_rid=order.buyer_rid,
            type="SHOP_DEBIT",
            amount=-order.total_price,
            description=f"Purchase of '{product.title}' (Held in Escrow, Order #{order.id})"
        )
        db.add(tx)

        # Create Escrow
        release_at = None
        if product.product_type == "DIGITAL":
            # Digital goods auto-release after 48 hours
            release_at = datetime.utcnow() + timedelta(hours=48)

        escrow = Escrow(
            order_id=order.id,
            amount=order.total_price,
            seller_rid=product.seller_rid,
            buyer_rid=order.buyer_rid,
            status="HELD",
            release_at=release_at
        )
        db.add(escrow)
        
        order.shipping_status = "ESCROWED"
        db.add(order)
        
        db.commit()
        db.refresh(escrow)
        return escrow

    @classmethod
    def process_escrow_release(cls, db: Session, order: Order) -> Escrow:
        """
        Releases held funds from escrow directly to the seller's wallet minus the 5% platform fee.
        Logs transactions for the seller and the platform.
        """
        escrow = db.query(Escrow).filter(Escrow.order_id == order.id, Escrow.status == "HELD").first()
        if not escrow:
            # Maybe frozen or already released
            escrow_frozen = db.query(Escrow).filter(Escrow.order_id == order.id, Escrow.status == "FROZEN").first()
            if escrow_frozen:
                raise ValueError("Escrow is frozen due to an active dispute. Release must be processed via Admin arbitration.")
            raise ValueError("No active escrow found for this order.")
        
        product = db.query(Product).filter(Product.id == order.product_id).first()
        if not product:
            raise ValueError("Product not found.")

        from app.models.admin import SystemSetting
        sys_setting = db.query(SystemSetting).filter(SystemSetting.key == "shop_platform_commission").first()
        if sys_setting:
            commission_rate = Decimal(sys_setting.value)
        else:
            setting = db.query(ShopSetting).filter(ShopSetting.id == "AI_REVIEW_CONFIG").first()
            commission_rate = setting.platform_commission if setting else Decimal("0.05")
        
        total_amount = escrow.amount
        platform_fee = (total_amount * commission_rate).quantize(Decimal("0.01"))
        seller_share = total_amount - platform_fee

        # Credit Seller
        seller_wallet = db.query(Wallet).filter(Wallet.user_rid == escrow.seller_rid).first()
        if not seller_wallet:
            # Create a wallet for the seller if they don't have one
            seller_wallet = Wallet(user_rid=escrow.seller_rid, balance=Decimal("0.00"), currency="GHS")
            db.add(seller_wallet)
            db.flush()

        seller_wallet.balance += seller_share
        seller_wallet.withdrawable_balance += seller_share
        db.add(seller_wallet)

        # Log Seller credit
        seller_tx = WalletTransaction(
            user_rid=escrow.seller_rid,
            type="SHOP_CREDIT",
            amount=seller_share,
            description=f"Earnings from Order #{order.id} ('{product.title}')"
        )
        db.add(seller_tx)

        # Log Platform fee
        platform_tx = WalletTransaction(
            user_rid="SYSTEM",
            type="PLATFORM_COMMISSION",
            amount=platform_fee,
            description=f"5% Platform fee on Order #{order.id} ('{product.title}')"
        )
        db.add(platform_tx)

        # Update Escrow & Order status
        escrow.status = "RELEASED"
        db.add(escrow)

        order.shipping_status = "RELEASED"
        order.buyer_confirmed = True
        db.add(order)

        db.commit()
        db.refresh(escrow)
        return escrow

    @classmethod
    def process_escrow_refund(cls, db: Session, order: Order, reason: str = "Order cancelled") -> Escrow:
        """
        Refunds the buyer wallet from the held escrow. Logs transaction.
        """
        escrow = db.query(Escrow).filter(Escrow.order_id == order.id, Escrow.status.in_(["HELD", "FROZEN"])).first()
        if not escrow:
            raise ValueError("No active or frozen escrow found for refund.")

        product = db.query(Product).filter(Product.id == order.product_id).first()
        title = product.title if product else "Unknown Product"

        # Refund Buyer
        buyer_wallet = db.query(Wallet).filter(Wallet.user_rid == escrow.buyer_rid).first()
        if not buyer_wallet:
            buyer_wallet = Wallet(user_rid=escrow.buyer_rid, balance=Decimal("0.00"), currency="GHS")
            db.add(buyer_wallet)
            db.flush()

        buyer_wallet.balance += escrow.amount
        db.add(buyer_wallet)

        # Log Refund
        buyer_tx = WalletTransaction(
            user_rid=escrow.buyer_rid,
            type="SHOP_REFUND",
            amount=escrow.amount,
            description=f"Refund for Order #{order.id} ('{title}'). Reason: {reason}"
        )
        db.add(buyer_tx)

        escrow.status = "REFUNDED"
        db.add(escrow)

        order.shipping_status = "REFUNDED"
        db.add(order)

        db.commit()
        db.refresh(escrow)
        return escrow

    @classmethod
    def process_dispute_hold(cls, db: Session, order: Order) -> Escrow:
        """
        Freezes the escrow status during a dispute.
        """
        escrow = db.query(Escrow).filter(Escrow.order_id == order.id, Escrow.status == "HELD").first()
        if not escrow:
            raise ValueError("No active escrow to dispute.")

        escrow.status = "FROZEN"
        db.add(escrow)

        order.shipping_status = "DISPUTED"
        db.add(order)

        db.commit()
        db.refresh(escrow)
        return escrow

    @classmethod
    def release_expired_digital_escrows(cls, db: Session) -> int:
        """
        Queries all HELD escrows where release_at has passed (expired digital dispute window)
        and automatically releases them to the sellers.
        """
        now = datetime.utcnow()
        expired_escrows = db.query(Escrow).filter(
            Escrow.status == "HELD",
            Escrow.release_at.isnot(None),
            Escrow.release_at <= now
        ).all()
        
        count = 0
        for escrow in expired_escrows:
            order = db.query(Order).filter(Order.id == escrow.order_id).first()
            if order:
                try:
                    cls.process_escrow_release(db, order)
                    order.shipping_status = "DELIVERED"
                    db.add(order)
                    count += 1
                except Exception as e:
                    logger.error(f"Failed to auto-release expired digital escrow for order {order.id}: {e}")
        
        if count > 0:
            db.commit()
        return count
