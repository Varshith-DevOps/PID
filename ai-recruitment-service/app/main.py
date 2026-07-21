from datetime import datetime, timezone
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel, Field
from app.config import get_settings
from app.graphs.candidate_screening_graph import STORE, run_candidate_screening
from app.middleware.service_auth import require_service_auth
from app.schemas.screening_request import ScreeningRequest
from app.services.hrms_client import HrmsClient, HrmsClientError
from app.utils.logging import configure_logging

configure_logging()

app = FastAPI(title="HRMS AI Recruitment Service")


class ApprovalRequest(BaseModel):
    workflow_id: str | None = Field(default=None, alias="workflowId")
    decision: str
    approved_by: str = Field(alias="approvedBy")
    comments: str | None = None

    class Config:
        populate_by_name = True


@app.get("/health")
async def health() -> dict:
    settings = get_settings()
    return {
        "status": "healthy",
        "service": "ai-recruitment-service",
        "llmProvider": settings.llm_provider,
    }


@app.post("/api/v1/screenings", dependencies=[Depends(require_service_auth)])
async def create_screening(request: ScreeningRequest) -> dict:
    settings = get_settings()
    hrms = HrmsClient(settings)
    try:
        return await run_candidate_screening(request, settings, hrms)
    except HrmsClientError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": str(exc)}) from exc


@app.get("/api/v1/screenings/{workflow_id}", dependencies=[Depends(require_service_auth)])
async def get_screening(workflow_id: str) -> dict:
    item = STORE.get(workflow_id)
    if not item:
        raise HTTPException(status_code=404, detail={"code": "WORKFLOW_NOT_FOUND", "message": "Workflow not found"})
    return item


@app.post("/api/v1/screenings/{workflow_id}/approval", dependencies=[Depends(require_service_auth)])
async def approve_screening(workflow_id: str, request: ApprovalRequest) -> dict:
    decision = request.decision.upper()
    if decision not in {"APPROVED", "REJECTED", "NEEDS_REVIEW"}:
        raise HTTPException(status_code=400, detail={"code": "INVALID_APPROVAL_DECISION", "message": "Invalid approval decision"})
    item = STORE.get(workflow_id)
    if not item:
        raise HTTPException(status_code=404, detail={"code": "WORKFLOW_NOT_FOUND", "message": "Workflow not found"})
    settings = get_settings()
    hrms = HrmsClient(settings)
    payload = {
        "decision": decision,
        "approvedBy": request.approved_by,
        "comments": request.comments,
        "originalRecommendation": item["recommendation"],
    }
    try:
        saved = await hrms.record_approval(workflow_id, payload)
    except HrmsClientError as exc:
        raise HTTPException(status_code=400, detail={"code": exc.code, "message": str(exc)}) from exc
    item["approvalStatus"] = decision
    item["updatedAt"] = datetime.now(timezone.utc).isoformat()
    STORE.put(workflow_id, item)
    return {"workflowId": workflow_id, "approvalStatus": decision, "assessment": saved}
