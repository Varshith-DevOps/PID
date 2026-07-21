from app.config import Settings


class LlmService:
    def __init__(self, settings: Settings):
        self.settings = settings

    @property
    def enabled(self) -> bool:
        return self.settings.llm_provider.lower() != "disabled"

    async def extract_job(self, text: str) -> dict:
        # Provider integrations belong behind this interface. Disabled mode is
        # deterministic and is used by tests and local development.
        return {}

    async def extract_resume(self, text: str) -> dict:
        return {}
