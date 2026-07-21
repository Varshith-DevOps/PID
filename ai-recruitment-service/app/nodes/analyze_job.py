import re
from app.schemas.screening_state import ScreeningState

SKILL_HINTS = {
    "python", "java", "javascript", "typescript", "react", "node", "express",
    "sql", "postgresql", "sqlite", "aws", "azure", "docker", "kubernetes",
    "fastapi", "django", "spring", "graphql", "prisma", "next.js", "nextjs",
}


def _extract_skills(text: str) -> list[str]:
    lower = text.lower()
    return sorted({skill for skill in SKILL_HINTS if skill in lower})


async def analyze_job(state: ScreeningState) -> ScreeningState:
    text = state.job_description or ""
    skills = _extract_skills(text)
    preferred = []
    preferred_match = re.search(r"preferred[:\s-]+(.+)", text, re.IGNORECASE)
    if preferred_match:
        preferred = _extract_skills(preferred_match.group(1))
    state.required_skills = [s for s in skills if s not in preferred]
    state.preferred_skills = preferred
    exp_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)", text, re.IGNORECASE)
    state.required_experience = float(exp_match.group(1)) if exp_match else None
    state.education_requirements = [item for item in ["bachelor", "master", "b.tech", "mba"] if item in text.lower()]
    state.certification_requirements = [item for item in ["aws", "azure", "pmp", "scrum"] if f"certified {item}" in text.lower() or f"{item} certification" in text.lower()]
    state.responsibilities = [line.strip(" -") for line in text.splitlines() if any(word in line.lower() for word in ["build", "manage", "design", "lead", "develop"])]
    state.domain_requirements = [item for item in ["hrms", "payroll", "healthcare", "finance", "recruitment"] if item in text.lower()]
    return state
