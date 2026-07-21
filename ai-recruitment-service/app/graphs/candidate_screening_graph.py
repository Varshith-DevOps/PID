import uuid
from datetime import datetime, timezone
from app.config import Settings
from app.nodes.analyze_job import analyze_job
from app.nodes.analyze_resume import analyze_resume
from app.nodes.calculate_score import calculate_score
from app.nodes.generate_recruiter_notes import generate_recruiter_notes
from app.nodes.load_recruitment_data import load_recruitment_data
from app.nodes.request_recruiter_approval import request_recruiter_approval
from app.nodes.save_assessment import save_assessment
from app.schemas.screening_request import ScreeningRequest
from app.schemas.screening_state import ScreeningState
from app.services.hrms_client import HrmsClient


class WorkflowStore:
    def __init__(self) -> None:
        self._items: dict[str, dict] = {}

    def put(self, workflow_id: str, payload: dict) -> None:
        self._items[workflow_id] = payload

    def get(self, workflow_id: str) -> dict | None:
        return self._items.get(workflow_id)


STORE = WorkflowStore()


def state_to_response(state: ScreeningState, status: str = "PENDING_APPROVAL") -> dict:
    now = datetime.now(timezone.utc)
    return {
        "workflowId": state.workflow_id,
        "status": status,
        "tenantId": state.tenant_id,
        "organizationId": state.organization_id,
        "jobId": state.job_id,
        "applicationId": state.application_id,
        "candidateId": state.candidate_id,
        "scores": {
            "skills": state.skills_score,
            "experience": state.experience_score,
            "education": state.education_score,
            "projects": state.project_score,
            "certifications": state.certification_score,
            "domain": state.domain_score,
            "overall": state.overall_score,
        },
        "recommendation": state.recommendation,
        "confidence": state.confidence,
        "matchedSkills": state.matched_skills,
        "missingRequiredSkills": state.missing_required_skills,
        "missingPreferredSkills": state.missing_preferred_skills,
        "recruiterNotes": state.recruiter_notes,
        "evidence": state.evidence,
        "approvalStatus": state.approval_status,
        "createdAt": now.isoformat(),
        "updatedAt": now.isoformat(),
    }


async def run_candidate_screening(request: ScreeningRequest, settings: Settings, hrms: HrmsClient) -> dict:
    state = ScreeningState(
        workflow_id=str(uuid.uuid4()),
        tenant_id=request.tenant_id,
        organization_id=request.organization_id,
        job_id=request.job_id,
        application_id=request.application_id,
        candidate_id=request.candidate_id,
        requested_by=request.requested_by,
        model_provider=settings.llm_provider,
        model_name=settings.llm_model or None,
    )
    state = await load_recruitment_data(state, hrms)
    state = await analyze_job(state)
    state = await analyze_resume(state)
    state = await calculate_score(state)
    state = await generate_recruiter_notes(state)
    state = await save_assessment(state, hrms)
    state = await request_recruiter_approval(state)
    response = state_to_response(state)
    STORE.put(state.workflow_id, response)
    return response
