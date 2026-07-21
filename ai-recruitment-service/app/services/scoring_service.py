from app.schemas.screening_state import ScreeningState

WEIGHTS = {
    "skills": 0.35,
    "experience": 0.30,
    "education": 0.10,
    "projects": 0.10,
    "domain": 0.10,
    "certifications": 0.05,
}


def normalize(value: str) -> str:
    return " ".join(value.lower().replace("/", " ").replace("-", " ").split())


def percentage(matches: int, total: int) -> float:
    if total <= 0:
        return 100.0
    return round((matches / total) * 100, 2)


def calculate_scores(state: ScreeningState) -> ScreeningState:
    candidate_skills = {normalize(skill) for skill in state.candidate_skills}
    required = {normalize(skill): skill for skill in state.required_skills}
    preferred = {normalize(skill): skill for skill in state.preferred_skills}

    matched_required = [label for key, label in required.items() if key in candidate_skills]
    matched_preferred = [label for key, label in preferred.items() if key in candidate_skills]
    missing_required = [label for key, label in required.items() if key not in candidate_skills]
    missing_preferred = [label for key, label in preferred.items() if key not in candidate_skills]

    required_pct = percentage(len(matched_required), len(required))
    preferred_pct = percentage(len(matched_preferred), len(preferred))
    skills_score = round(required_pct * 0.75 + preferred_pct * 0.25, 2)

    required_exp = state.required_experience or 0
    candidate_exp = state.candidate_experience or 0
    experience_score = 100.0 if required_exp <= 0 else min(100.0, round((candidate_exp / required_exp) * 100, 2))
    education_score = 100.0 if not state.education_requirements else (100.0 if state.candidate_education else 0.0)
    project_score = 100.0 if state.candidate_projects else 0.0
    domain_score = 100.0 if not state.domain_requirements else percentage(
        sum(1 for req in state.domain_requirements if normalize(req) in " ".join(map(normalize, state.candidate_projects + state.previous_companies))),
        len(state.domain_requirements),
    )
    certification_score = 100.0 if not state.certification_requirements else percentage(
        sum(1 for cert in state.certification_requirements if normalize(cert) in {normalize(c) for c in state.candidate_certifications}),
        len(state.certification_requirements),
    )

    overall = round(
        skills_score * WEIGHTS["skills"]
        + experience_score * WEIGHTS["experience"]
        + education_score * WEIGHTS["education"]
        + project_score * WEIGHTS["projects"]
        + domain_score * WEIGHTS["domain"]
        + certification_score * WEIGHTS["certifications"],
        2,
    )

    if missing_required:
        recommendation = "RECRUITER_REVIEW_REQUIRED" if overall >= 65 else "LOW_MATCH"
    elif overall >= 85:
        recommendation = "STRONG_MATCH"
    elif overall >= 75:
        recommendation = "SHORTLIST_RECOMMENDED"
    elif overall >= 55:
        recommendation = "RECRUITER_REVIEW_REQUIRED"
    else:
        recommendation = "REJECTION_RECOMMENDED"

    state.matched_skills = sorted(set(matched_required + matched_preferred))
    state.missing_required_skills = missing_required
    state.missing_preferred_skills = missing_preferred
    state.skills_score = skills_score
    state.experience_score = experience_score
    state.education_score = education_score
    state.project_score = project_score
    state.domain_score = domain_score
    state.certification_score = certification_score
    state.overall_score = overall
    state.confidence = round(min(95.0, max(35.0, 55.0 + overall * 0.4 - len(missing_required) * 5)), 2)
    state.recommendation = recommendation
    state.evidence.update(
        {
            "JD -> Required skills": state.required_skills,
            "JD -> Responsibilities": state.responsibilities,
            "Resume -> Skills": state.candidate_skills,
            "Resume -> Work experience": state.candidate_experience,
            "Resume -> Education": state.candidate_education,
            "Resume -> Projects": state.candidate_projects,
        }
    )
    return state
