import re
from app.nodes.analyze_job import _extract_skills
from app.schemas.screening_state import ScreeningState


async def analyze_resume(state: ScreeningState) -> ScreeningState:
    text = state.resume_text or ""
    state.candidate_skills = _extract_skills(text)
    exp_match = re.search(r"(\d+(?:\.\d+)?)\+?\s*(?:years|yrs)", text, re.IGNORECASE)
    state.candidate_experience = float(exp_match.group(1)) if exp_match else None
    state.candidate_education = [item for item in ["bachelor", "master", "b.tech", "mba"] if item in text.lower()]
    state.candidate_certifications = [item for item in ["aws", "azure", "pmp", "scrum"] if item in text.lower() and "cert" in text.lower()]
    state.candidate_projects = [line.strip(" -") for line in text.splitlines() if "project" in line.lower()]
    state.previous_companies = re.findall(r"(?:company|employer)[:\s]+([A-Za-z0-9 .&-]{2,80})", text, flags=re.IGNORECASE)
    urls = re.findall(r"https?://[^\s)]+", text)
    state.github_url = next((url for url in urls if "github.com" in url.lower()), None)
    state.linkedin_url = next((url for url in urls if "linkedin.com" in url.lower()), None)
    state.portfolio_url = next((url for url in urls if url not in [state.github_url, state.linkedin_url]), None)
    return state
