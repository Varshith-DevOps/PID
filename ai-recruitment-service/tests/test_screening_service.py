import os
from fastapi.testclient import TestClient

os.environ["HRMS_SERVICE_TOKEN"] = "test-token"
os.environ["LLM_PROVIDER"] = "disabled"

from app.main import app
from app.services.hrms_client import HrmsClient


def fake_context(payload):
    return {
        "job": {
            "id": payload["jobId"],
            "title": "Backend Engineer",
            "description": "Build APIs and services",
            "requirements": "Required: Python, FastAPI, SQL. Preferred: Docker. 3 years experience.",
        },
        "candidate": {
            "id": payload["candidateId"],
            "fullName": "Test Candidate",
            "experience": "4 years",
            "skills": "Python, FastAPI, SQL",
            "coverLetter": "Project: API migration",
        },
        "resume": {
            "url": "resumes/test.txt",
            "available": True,
            "text": "Test Candidate\n4 years\nSkills: Python, FastAPI, SQL\nProject: API migration",
        },
    }


async def mock_get_context(self, payload):
    return fake_context(payload)


async def mock_save(self, assessment):
    return assessment


async def mock_approval(self, workflow_id, payload):
    return {"workflowId": workflow_id, "approvalStatus": payload["decision"]}


def client(monkeypatch):
    monkeypatch.setattr(HrmsClient, "get_screening_context", mock_get_context)
    monkeypatch.setattr(HrmsClient, "save_assessment", mock_save)
    monkeypatch.setattr(HrmsClient, "record_approval", mock_approval)
    return TestClient(app)


def test_health():
    res = TestClient(app).get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "healthy"
    assert body["service"] == "ai-recruitment-service"
    assert body["llmProvider"] == "disabled"


def test_unauthorized_request(monkeypatch):
    res = client(monkeypatch).post("/api/v1/screenings", json={})
    assert res.status_code == 401


def test_create_screening_and_approval(monkeypatch):
    c = client(monkeypatch)
    payload = {
        "tenantId": "org-1",
        "organizationId": "org-1",
        "jobId": "job-1",
        "applicationId": "app-1",
        "candidateId": "app-1",
    }
    res = c.post("/api/v1/screenings", json=payload, headers={"Authorization": "Bearer test-token"})
    assert res.status_code == 200
    body = res.json()
    assert body["approvalStatus"] == "PENDING"
    assert body["scores"]["overall"] > 0
    assert "Python" not in body["missingRequiredSkills"]

    approval = c.post(
        f"/api/v1/screenings/{body['workflowId']}/approval",
        json={"decision": "APPROVED", "approvedBy": "user-1"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert approval.status_code == 200
    assert approval.json()["approvalStatus"] == "APPROVED"


def test_invalid_approval_decision(monkeypatch):
    c = client(monkeypatch)
    res = c.post(
        "/api/v1/screenings/missing/approval",
        json={"decision": "MOVE_STAGE", "approvedBy": "user-1"},
        headers={"Authorization": "Bearer test-token"},
    )
    assert res.status_code == 400
