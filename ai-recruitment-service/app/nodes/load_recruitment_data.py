from app.schemas.screening_state import ScreeningState
from app.services.hrms_client import HrmsClient


async def load_recruitment_data(state: ScreeningState, hrms: HrmsClient) -> ScreeningState:
    context = await hrms.get_screening_context(
        {
            "tenantId": state.tenant_id,
            "organizationId": state.organization_id,
            "jobId": state.job_id,
            "applicationId": state.application_id,
            "candidateId": state.candidate_id,
            "workflowId": state.workflow_id,
            "requestedBy": state.requested_by,
        }
    )
    job = context["job"]
    candidate = context["candidate"]
    resume = context.get("resume") or {}
    state.job_title = job.get("title")
    state.job_description = "\n".join([job.get("description") or "", job.get("requirements") or ""]).strip()
    state.resume_url = resume.get("url")
    state.resume_text = resume.get("text") or " ".join(
        str(candidate.get(key) or "")
        for key in ["fullName", "experience", "skills", "coverLetter"]
    )
    state.candidate_name = candidate.get("fullName")
    return state
