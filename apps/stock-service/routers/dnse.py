"""DNSE credential verification endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel

from services.dnse_client import DnseClient

router = APIRouter()
client = DnseClient()


class VerifyRequest(BaseModel):
    api_key: str
    api_secret: str


@router.post("/verify")
async def verify_credentials(body: VerifyRequest):
    try:
        valid = await client.verify_api_key(body.api_key, body.api_secret)
        if valid:
            return {"valid": True}
        return {"valid": False, "error": "Invalid API Key or Secret"}
    except Exception as e:
        return {"valid": False, "error": str(e)}
