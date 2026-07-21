from fastapi import Header, HTTPException, status
from app.config import get_settings


async def require_service_auth(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    expected = settings.hrms_service_token
    if not expected:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"code": "UNAUTHORIZED_SERVICE", "message": "Service token is not configured"})
    if authorization != f"Bearer {expected}":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"code": "UNAUTHORIZED_SERVICE", "message": "Unauthorized service request"})
