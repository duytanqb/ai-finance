"""DNSE credential verification endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel

from services.dnse_client import DnseClient

router = APIRouter()
client = DnseClient()


class VerifyRequest(BaseModel):
    username: str
    password: str


@router.post("/verify")
async def verify_credentials(body: VerifyRequest):
    try:
        valid = await client.verify_credentials(body.username, body.password)
        if valid:
            return {"valid": True}
        return {"valid": False, "error": "Invalid username or password"}
    except Exception as e:
        return {"valid": False, "error": str(e)}
