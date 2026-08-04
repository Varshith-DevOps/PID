from fastapi import FastAPI, Depends, HTTPException, status
from app.config import get_settings, Settings

app = FastAPI(title="Priya Document Intelligence Platform")


@app.get("/health")
async def health(settings: Settings = Depends(get_settings)) -> dict:
    return {
        "status": "healthy",
        "service": "document-intelligence-service",
        "offlineMode": settings.offline_mode,
        "hybridConfidenceThreshold": settings.hybrid_confidence_threshold,
        "fallbackProvider": settings.cloud_provider
    }
