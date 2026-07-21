from app.schemas.screening_state import ScreeningState


async def request_recruiter_approval(state: ScreeningState) -> ScreeningState:
    state.approval_required = True
    state.approval_status = "PENDING"
    return state
