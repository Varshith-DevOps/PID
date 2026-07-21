from app.schemas.screening_state import ScreeningState


async def generate_recruiter_notes(state: ScreeningState) -> ScreeningState:
    missing = ", ".join(state.missing_required_skills) or "No mandatory skill gaps found"
    matched = ", ".join(state.matched_skills) or "No direct skill matches found"
    state.recruiter_notes = (
        f"Candidate summary: {state.candidate_name or 'Candidate'} was assessed for {state.job_title or 'the selected role'}.\n"
        f"Strong matching factors: {matched}. Source: Resume -> Skills and JD -> Required skills.\n"
        f"Relevant experience: candidate evidence indicates {state.candidate_experience or 0} years against "
        f"{state.required_experience or 'unspecified'} required years. Source: Resume -> Work experience.\n"
        f"Missing required skills: {missing}. Source: JD -> Required skills.\n"
        f"Missing preferred skills: {', '.join(state.missing_preferred_skills) or 'None identified'}.\n"
        f"Education observations: {', '.join(state.candidate_education) or 'No explicit education evidence extracted'}.\n"
        f"Certification observations: {', '.join(state.candidate_certifications) or 'No explicit certification evidence extracted'}.\n"
        f"Project observations: {', '.join(state.candidate_projects[:3]) or 'No project evidence extracted'}.\n"
        f"Possible concerns: review mandatory gaps and verify resume evidence during screening.\n"
        f"Suggested interview focus areas: {missing if state.missing_required_skills else 'validate depth in matched skills'}.\n"
        f"Recommendation explanation: deterministic score {state.overall_score} produced {state.recommendation}; recruiter approval is required before any status action."
    )
    return state
