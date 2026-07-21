from pydantic import BaseModel, Field


class ExtractedResume(BaseModel):
    candidate_name: str | None = None
    email: str | None = None
    phone: str | None = None
    skills: list[str] = Field(default_factory=list)
    total_experience_years: float | None = None
    relevant_experience_years: float | None = None
    employment_history: list[str] = Field(default_factory=list)
    education: list[str] = Field(default_factory=list)
    certifications: list[str] = Field(default_factory=list)
    projects: list[str] = Field(default_factory=list)
    previous_companies: list[str] = Field(default_factory=list)
    github_url: str | None = None
    linkedin_url: str | None = None
    portfolio_url: str | None = None
