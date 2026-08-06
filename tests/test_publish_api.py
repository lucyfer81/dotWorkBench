import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch
from dotworkbench.main import app, doc_service

client = TestClient(app)

@patch("dotworkbench.services.publish_service.PublishService.publish_doc")
def test_publish_api_success(mock_publish_doc):
    doc = doc_service.create_doc(title="API测试文档")
    mock_publish_doc.return_value = {
        "success": True,
        "message": "发布成功",
        "blogSlug": "api-test-doc",
        "publishedAt": "2026-08-06T17:00:00Z"
    }

    response = client.post(f"/api/docs/{doc['id']}/publish")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["blogSlug"] == "api-test-doc"

def test_publish_api_not_found():
    response = client.post("/api/docs/non-existent-id/publish")
    assert response.status_code == 404
