import os
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = Field("HRMS AI Recruitment Service", alias="APP_NAME")
    app_env: str = Field("development", alias="APP_ENV")
    port: int = Field(8001, alias="PORT")
    hrms_api_url: str = Field("http://127.0.0.1:5000/api", alias="HRMS_API_URL")
    hrms_service_token: str = Field("", alias="HRMS_SERVICE_TOKEN")
    ai_database_url: str = Field("", alias="AI_DATABASE_URL")
    llm_provider: str = Field("disabled", alias="LLM_PROVIDER")
    llm_model: str = Field("", alias="LLM_MODEL")
    openai_api_key: str = Field("", alias="OPENAI_API_KEY")
    azure_openai_api_key: str = Field("", alias="AZURE_OPENAI_API_KEY")
    azure_openai_endpoint: str = Field("", alias="AZURE_OPENAI_ENDPOINT")
    azure_openai_api_version: str = Field("", alias="AZURE_OPENAI_API_VERSION")
    anthropic_api_key: str = Field("", alias="ANTHROPIC_API_KEY")
    google_api_key: str = Field("", alias="GOOGLE_API_KEY")
    ollama_base_url: str = Field("http://localhost:11434", alias="OLLAMA_BASE_URL")
    max_resume_size_mb: int = Field(10, alias="MAX_RESUME_SIZE_MB")
    hrms_request_timeout_seconds: int = Field(30, alias="HRMS_REQUEST_TIMEOUT_SECONDS")
    llm_request_timeout_seconds: int = Field(60, alias="LLM_REQUEST_TIMEOUT_SECONDS")
    pii_logging_enabled: bool = Field(False, alias="PII_LOGGING_ENABLED")

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"),
        env_file_encoding="utf-8",
        populate_by_name=True,
        extra="ignore"
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
