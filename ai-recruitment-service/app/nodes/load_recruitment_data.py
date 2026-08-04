import os
from app.schemas.screening_state import ScreeningState
from app.services.hrms_client import HrmsClient
from app.services.resume_parser import parse_resume_file


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
    
    # Heuristically join standard metadata fields as base fallback
    fallback_text = resume.get("text") or " ".join(
        str(candidate.get(key) or "")
        for key in ["fullName", "experience", "skills", "coverLetter"]
    )
    state.resume_text = fallback_text

    # Parse real resume file if path exists in the shared backend uploads volume
    if state.resume_url:
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__)) # .../app/nodes
            app_dir = os.path.dirname(current_dir) # .../app
            service_root = os.path.dirname(app_dir) # .../ai-recruitment-service
            project_root = os.path.dirname(service_root) # ...
            file_path = os.path.join(project_root, "backend", "uploads", state.resume_url)
            
            if os.path.exists(file_path):
                parsed_text = await parse_resume_file(file_path)
                if parsed_text and len(parsed_text.strip()) > 50:
                    state.resume_text = parsed_text
        except Exception as e:
            # Gracefully fail back to metadata text
            pass

    state.candidate_name = candidate.get("fullName")
    return state
