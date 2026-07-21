from pydantic import BaseModel, Field


class ScreeningRequest(BaseModel):
    tenant_id: str = Field(alias="tenantId", min_length=1)
    organization_id: str = Field(alias="organizationId", min_length=1)
    job_id: str = Field(alias="jobId", min_length=1)
    application_id: str = Field(alias="applicationId", min_length=1)
    candidate_id: str = Field(alias="candidateId", min_length=1)
    requested_by: str | None = Field(default=None, alias="requestedBy")

    class Config:
        populate_by_name = True
