import os
import shutil
import pytest
from fastapi.testclient import TestClient
from dotworkbench.main import app, folder_service, doc_service

TEST_DOCS_DIR = "data/test_api_docs"
TEST_FOLDERS_DIR = "data/test_api_folders"

@pytest.fixture(autouse=True)
def setup_api_storage():
    old_doc_dir = doc_service.storage_dir
    old_folder_dir = folder_service.storage_dir
    doc_service.storage_dir = TEST_DOCS_DIR
    folder_service.storage_dir = TEST_FOLDERS_DIR
    os.makedirs(TEST_DOCS_DIR, exist_ok=True)
    os.makedirs(TEST_FOLDERS_DIR, exist_ok=True)
    yield
    if os.path.exists(TEST_DOCS_DIR):
        shutil.rmtree(TEST_DOCS_DIR)
    if os.path.exists(TEST_FOLDERS_DIR):
        shutil.rmtree(TEST_FOLDERS_DIR)
    doc_service.storage_dir = old_doc_dir
    folder_service.storage_dir = old_folder_dir

def test_api_nodes_and_folders():
    client = TestClient(app)

    # Create folder
    res = client.post("/api/folders", json={"title": "架构组", "parentId": None})
    assert res.status_code == 200
    folder_data = res.json()
    assert folder_data["title"] == "架构组"
    assert folder_data["type"] == "folder"

    # Create doc in folder
    res_doc = client.post("/api/docs", json={"title": "设计规范", "parentId": folder_data["id"]})
    assert res_doc.status_code == 200
    doc_data = res_doc.json()
    assert doc_data["parentId"] == folder_data["id"]

    # Get nodes
    res_nodes = client.get("/api/nodes")
    assert res_nodes.status_code == 200
    nodes = res_nodes.json()
    assert len(nodes) == 2

    # Cascade delete folder
    res_del = client.delete(f"/api/folders/{folder_data['id']}")
    assert res_del.status_code == 200

    # Verify empty nodes
    res_nodes_after = client.get("/api/nodes")
    assert len(res_nodes_after.json()) == 0
