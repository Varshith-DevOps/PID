from app.schemas.screening_state import ScreeningState
from app.services.hrms_client import HrmsClient


def assessment_payload(state: ScreeningState) -> dict:
    return {
        "workflowId": state.workflow_id,
        "tenantId": state.tenant_id,
        "organizationId": state.organization_id,
        "jobId": state.job_id,
        "applicationId": state.application_id,
        "candidateId": state.candidate_id,
        "status": "PENDING_APPROVAL",
        "skillsScore": state.skills_score,
        "experienceScore": state.experience_score,
        "educationScore": state.education_score,
        "projectScore": state.project_score,
        "certificationScore": state.certification_score,
        "domainScore": state.domain_score,
        "overallScore": state.overall_score,
        "confidence": state.confidence,
        "matchedSkills": state.matched_skills,
        "missingRequiredSkills": state.missing_required_skills,
        "missingPreferredSkills": state.missing_preferred_skills,
        "evidence": state.evidence,
        "recruiterNotes": state.recruiter_notes,
        "recommendation": state.recommendation,
        "approvalStatus": state.approval_status,
        "modelProvider": state.model_provider,
        "modelName": state.model_name,
        "promptVersion": state.prompt_version,
        "scoringVersion": state.scoring_version,
        "createdBy": state.requested_by,
    }


async def save_assessment(state: ScreeningState, hrms: HrmsClient) -> ScreeningState:
    await hrms.save_assessment(assessment_payload(state))
    return state
