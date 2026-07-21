from datetime import datetime
from typing import Any
from pydantic import BaseModel, Field


class ScreeningResponse(BaseModel):
    workflow_id: str = Field(alias="workflowId")
    status: str
    tenant_id: str = Field(alias="tenantId")
    organization_id: str = Field(alias="organizationId")
    job_id: str = Field(alias="jobId")
    application_id: str = Field(alias="applicationId")
    candidate_id: str = Field(alias="candidateId")
    scores: dict[str, float]
    recommendation: str
    confidence: float
    matched_skills: list[str] = Field(alias="matchedSkills")
    missing_required_skills: list[str] = Field(alias="missingRequiredSkills")
    missing_preferred_skills: list[str] = Field(alias="missingPreferredSkills")
    recruiter_notes: str = Field(alias="recruiterNotes")
    evidence: dict[str, Any]
    approval_status: str = Field(alias="approvalStatus")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    class Config:
        populate_by_name = True
