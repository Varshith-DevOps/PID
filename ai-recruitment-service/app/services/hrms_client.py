import logging
import httpx
from app.config import Settings

logger = logging.getLogger(__name__)


class HrmsClientError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


class HrmsClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.settings.hrms_service_token}"}

    async def get_screening_context(self, payload: dict) -> dict:
        url = f"{self.settings.hrms_api_url.rstrip('/')}/internal/recruitment/ai/context"
        logger.info("[HRMS CLIENT] POST %s", url)
        try:
            async with httpx.AsyncClient(timeout=self.settings.hrms_request_timeout_seconds) as client:
                res = await client.post(url, json=payload, headers=self._headers())
        except httpx.TimeoutException as exc:
            logger.warning("[HRMS CLIENT] Timeout fetching screening context from %s", url)
            raise HrmsClientError("HRMS_API_UNAVAILABLE", "HRMS API timed out") from exc
        except httpx.HTTPError as exc:
            logger.warning("[HRMS CLIENT] Network error fetching screening context from %s: %s", url, exc)
            raise HrmsClientError("HRMS_API_UNAVAILABLE", "HRMS API unavailable") from exc
        logger.info("[HRMS CLIENT] Response %s from %s", res.status_code, url)
        if res.status_code >= 400:
            code = res.json().get("code", "AI_SCREENING_FAILED") if res.headers.get("content-type", "").startswith("application/json") else "AI_SCREENING_FAILED"
            raise HrmsClientError(code, "Unable to load screening context")
        return res.json()

    async def save_assessment(self, assessment: dict) -> dict:
        url = f"{self.settings.hrms_api_url.rstrip('/')}/internal/recruitment/ai/assessments"
        logger.info("[HRMS CLIENT] POST %s", url)
        try:
            async with httpx.AsyncClient(timeout=self.settings.hrms_request_timeout_seconds) as client:
                res = await client.post(url, json=assessment, headers=self._headers())
        except httpx.TimeoutException as exc:
            logger.warning("[HRMS CLIENT] Timeout saving assessment to %s", url)
            raise HrmsClientError("HRMS_API_UNAVAILABLE", "HRMS API timed out") from exc
        except httpx.HTTPError as exc:
            logger.warning("[HRMS CLIENT] Network error saving assessment to %s: %s", url, exc)
            raise HrmsClientError("HRMS_API_UNAVAILABLE", "HRMS API unavailable") from exc
        logger.info("[HRMS CLIENT] Response %s from %s", res.status_code, url)
        if res.status_code >= 400:
            code = res.json().get("code", "AI_SCREENING_FAILED") if res.headers.get("content-type", "").startswith("application/json") else "AI_SCREENING_FAILED"
            raise HrmsClientError(code, "Unable to save assessment")
        return res.json()

    async def record_approval(self, workflow_id: str, payload: dict) -> dict:
        url = f"{self.settings.hrms_api_url.rstrip('/')}/internal/recruitment/ai/assessments/{workflow_id}/approval"
        logger.info("[HRMS CLIENT] POST %s", url)
        try:
            async with httpx.AsyncClient(timeout=self.settings.hrms_request_timeout_seconds) as client:
                res = await client.post(url, json=payload, headers=self._headers())
        except httpx.TimeoutException as exc:
            logger.warning("[HRMS CLIENT] Timeout recording approval to %s", url)
            raise HrmsClientError("HRMS_API_UNAVAILABLE", "HRMS API timed out") from exc
        except httpx.HTTPError as exc:
            logger.warning("[HRMS CLIENT] Network error recording approval to %s: %s", url, exc)
            raise HrmsClientError("HRMS_API_UNAVAILABLE", "HRMS API unavailable") from exc
        logger.info("[HRMS CLIENT] Response %s from %s", res.status_code, url)
        if res.status_code >= 400:
            code = res.json().get("code", "AI_SCREENING_FAILED") if res.headers.get("content-type", "").startswith("application/json") else "AI_SCREENING_FAILED"
            raise HrmsClientError(code, "Unable to record approval")
        return res.json()


