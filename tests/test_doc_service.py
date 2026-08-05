import os
import pytest
from dotworkbench.services.doc_service import DocService

@pytest.fixture
def tmp_doc_dir(tmp_path):
    d = tmp_path / "docs"
    d.mkdir()
    return str(d)

def test_create_and_get_doc(tmp_doc_dir):
    service = DocService(storage_dir=tmp_doc_dir)
    doc_meta = service.create_doc(title="测试文档", parent_id=None)
    assert doc_meta["title"] == "测试文档"
    assert "id" in doc_meta

    doc = service.get_doc(doc_meta["id"])
    assert doc["title"] == "测试文档"
    assert doc["content"] == ""

def test_list_and_update_doc(tmp_doc_dir):
    service = DocService(storage_dir=tmp_doc_dir)
    doc_meta = service.create_doc(title="笔记1")
    service.update_doc(doc_meta["id"], title="笔记1-修改", content="# Hello World")
    
    doc = service.get_doc(doc_meta["id"])
    assert doc["title"] == "笔记1-修改"
    assert doc["content"] == "# Hello World"
    
    docs = service.list_docs()
    assert len(docs) == 1
    assert docs[0]["title"] == "笔记1-修改"
