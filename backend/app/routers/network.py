from fastapi import APIRouter

router = APIRouter(prefix="/network", tags=["network"])

@router.get("")
def get_network():
    return {
        "user_code": "ACNIRPc1c2c1c3c4c1",
        "parent": "ACNIRPc1c2c1c3c4",
        "ancestors": [
            "ACNIRPc1c2c1c3",
            "ACNIRPc1c2c1",
            "ACNIRPc1c2",
            "ACNIRPc1",
            "ACNIRP",
            "A"
        ]
    }
