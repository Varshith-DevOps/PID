# HRMS AI Recruitment Service

FastAPI service for recruiter-triggered candidate screening. The HRMS backend remains the source of truth; browsers must call the HRMS backend, not this service directly.

## Local

```powershell
cd ai-recruitment-service
python -m venv venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Use `LLM_PROVIDER=disabled` for deterministic development and tests.

Run the full local stack from separate PowerShell terminals:

```powershell
cd backend
npm.cmd start
```

```powershell
cd ai-recruitment-service
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

```powershell
cd frontend
npm.cmd run dev
```

## Endpoints

- `GET /health`
- `POST /api/v1/screenings`
- `GET /api/v1/screenings/{workflowId}`
- `POST /api/v1/screenings/{workflowId}/approval`

All screening endpoints require `Authorization: Bearer <HRMS_SERVICE_TOKEN>`.
