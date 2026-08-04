import os
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings



class Settings(BaseSettings):
    app_name: str = Field("Priya Document Intelligence Platform", alias="APP_NAME")
    app_env: str = Field("development", alias="APP_ENV")
    port: int = Field(8002, alias="PORT")
    database_url: str = Field("", alias="DATABASE_URL")
    redis_url: str = Field("redis://localhost:6379/0", alias="REDIS_URL")
    
    # Model Configurations
    model_dir: str = Field("/app/models", alias="MODEL_DIR")
    offline_mode: bool = Field(True, alias="OFFLINE_MODE")
    hybrid_confidence_threshold: float = Field(0.85, alias="HYBRID_CONFIDENCE_THRESHOLD")
    
    # Cloud OCR Provider Fallback Configurations
    cloud_provider: str = Field("none", alias="CLOUD_PROVIDER") # azure, google, aws, none
    azure_endpoint: str = Field("", alias="AZURE_OCR_ENDPOINT")
    azure_key: str = Field("", alias="AZURE_OCR_KEY")

    class Config:
        env_file = ".env"
        populate_by_name = True


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    
    # Automatically detect and configure cloud fallback provider based on key presence
    if settings.azure_key or os.environ.get("AZURE_OCR_KEY"):
        settings.cloud_provider = "azure"
    else:
        # Default fallback to none if no key is present
        if not settings.cloud_provider or settings.cloud_provider == "none":
            settings.cloud_provider = "none"
            
    return settings
