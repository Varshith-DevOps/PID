from typing import Any, Literal
from pydantic import BaseModel, Field


Recommendation = Literal[
    "STRONG_MATCH",
    "SHORTLIST_RECOMMENDED",
    "RECRUITER_REVIEW_REQUIRED",
    "LOW_MATCH",
    "REJECTION_RECOMMENDED",
]


class ScreeningState(BaseModel):
    workflow_id: str
    tenant_id: str
    organization_id: str
    job_id: str
    application_id: str
    candidate_id: str
    requested_by: str | None = None

    job_title: str | None = None
    job_description: str | None = None
    required_skills: list[str] = Field(default_factory=list)
    preferred_skills: list[str] = Field(default_factory=list)
    required_experience: float | None = None
    education_requirements: list[str] = Field(default_factory=list)
    certification_requirements: list[str] = Field(default_factory=list)
    responsibilities: list[str] = Field(default_factory=list)
    domain_requirements: list[str] = Field(default_factory=list)

    resume_url: str | None = None
    resume_text: str | None = None
    candidate_name: str | None = None
    candidate_skills: list[str] = Field(default_factory=list)
    candidate_experience: float | None = None
    candidate_education: list[str] = Field(default_factory=list)
    candidate_certifications: list[str] = Field(default_factory=list)
    candidate_projects: list[str] = Field(default_factory=list)
    previous_companies: list[str] = Field(default_factory=list)
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None

    matched_skills: list[str] = Field(default_factory=list)
    missing_required_skills: list[str] = Field(default_factory=list)
    missing_preferred_skills: list[str] = Field(default_factory=list)

    skills_score: float = 0
    experience_score: float = 0
    education_score: float = 0
    project_score: float = 0
    certification_score: float = 0
    domain_score: float = 0
    overall_score: float = 0

    recommendation: Recommendation = "RECRUITER_REVIEW_REQUIRED"
    confidence: float = 0
    recruiter_notes: str = ""
    evidence: dict[str, Any] = Field(default_factory=dict)

    approval_required: bool = True
    approval_status: Literal["PENDING", "APPROVED", "REJECTED", "NEEDS_REVIEW"] = "PENDING"
    approved_by: str | None = None
    approval_comments: str | None = None

    model_provider: str = "disabled"
    model_name: str | None = None
    prompt_version: str = "candidate-screening-v1"
    scoring_version: str = "deterministic-v1"

    errors: list[str] = Field(default_factory=list)
