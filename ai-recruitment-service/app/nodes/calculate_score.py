from app.schemas.screening_state import ScreeningState
from app.services.scoring_service import calculate_scores


async def calculate_score(state: ScreeningState) -> ScreeningState:
    return calculate_scores(state)
