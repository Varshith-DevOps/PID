import logging
from fastapi import Header, HTTPException, status
from app.config import get_settings

logger = logging.getLogger(__name__)


async def require_service_auth(authorization: str | None = Header(default=None)) -> None:
    settings = get_settings()
    expected = settings.hrms_service_token
    if not expected:
        logger.error(
            "[AUTH] HRMS_SERVICE_TOKEN is not configured in ai-recruitment-service/.env — "
            "set it to the same value as AI_RECRUITMENT_SERVICE_TOKEN in backend/.env "
            "or run `npm run setup:tokens` in the backend directory."
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "UNAUTHORIZED_SERVICE", "message": "Service token is not configured. Please run `npm run setup:tokens` in the backend directory."},
        )
    if authorization != f"Bearer {expected}":
        logger.warning(
            "[AUTH] Rejected request — Authorization header missing or token mismatch. "
            "Ensure AI_RECRUITMENT_SERVICE_TOKEN (backend) == HRMS_SERVICE_TOKEN (ai-service)."
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "INVALID_SERVICE_TOKEN", "message": "Unauthorized service request"},
        )

