import os
import shutil
import pytest
from dotworkbench.services.folder_service import FolderService
from dotworkbench.services.doc_service import DocService

TEST_DOCS_DIR = "data/test_docs_folders"
TEST_FOLDERS_DIR = "data/test_folders"

@pytest.fixture
def setup_services():
    if os.path.exists(TEST_DOCS_DIR):
        shutil.rmtree(TEST_DOCS_DIR)
    if os.path.exists(TEST_FOLDERS_DIR):
        shutil.rmtree(TEST_FOLDERS_DIR)
    doc_service = DocService(storage_dir=TEST_DOCS_DIR)
    folder_service = FolderService(storage_dir=TEST_FOLDERS_DIR)
    yield folder_service, doc_service
    if os.path.exists(TEST_DOCS_DIR):
        shutil.rmtree(TEST_DOCS_DIR)
    if os.path.exists(TEST_FOLDERS_DIR):
        shutil.rmtree(TEST_FOLDERS_DIR)

def test_create_and_list_folder(setup_services):
    folder_service, _ = setup_services
    folder = folder_service.create_folder(title="工作文档")
    assert folder["title"] == "工作文档"
    assert folder["type"] == "folder"
    assert folder["parentId"] is None

    folders = folder_service.list_folders()
    assert len(folders) == 1
    assert folders[0]["id"] == folder["id"]

def test_cascade_delete_folder(setup_services):
    folder_service, doc_service = setup_services
    # Create parent folder
    parent = folder_service.create_folder(title="父文件夹")
    # Create child folder
    child_folder = folder_service.create_folder(title="子文件夹", parent_id=parent["id"])
    # Create child doc inside child folder
    child_doc = doc_service.create_doc(title="文档1", parent_id=child_folder["id"])

    # Verify initial creation
    assert len(folder_service.list_folders()) == 2
    assert len(doc_service.list_docs()) == 1

    # Cascade delete parent
    success = folder_service.delete_folder_recursive(parent["id"], doc_service=doc_service)
    assert success is True

    # Verify parent, child folder, and child doc are all deleted
    assert len(folder_service.list_folders()) == 0
    assert len(doc_service.list_docs()) == 0

def test_update_folder_cycle_prevention(setup_services):
    folder_service, _ = setup_services
    f1 = folder_service.create_folder(title="F1")
    f2 = folder_service.create_folder(title="F2", parent_id=f1["id"])
    
    # Trying to set F1's parent to F2 should raise ValueError
    with pytest.raises(ValueError, match="Cannot move folder into its own subfolder"):
        folder_service.update_folder(f1["id"], parent_id=f2["id"])
