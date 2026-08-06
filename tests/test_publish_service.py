import os
import pytest
from unittest.mock import patch, MagicMock
from dotworkbench.services.doc_service import DocService
from dotworkbench.services.publish_service import PublishService

@pytest.fixture
def doc_service(tmp_path):
    storage_dir = tmp_path / "docs"
    return DocService(storage_dir=str(storage_dir))

def test_slugify():
    publish_service = PublishService(blog_dir="/tmp/fake_blog")
    assert publish_service.slugify("Hello World 123!") == "hello-world-123"
    assert publish_service.slugify("测试 中文 标题") != ""

def test_generate_metadata_fallback():
    publish_service = PublishService(blog_dir="/tmp/fake_blog")
    content = "这是一篇关于 Astro 和 Cloudflare 的文章正文内容。"
    metadata = publish_service.generate_metadata("文章标题", content)
    assert "description" in metadata
    assert "tags" in metadata
    assert isinstance(metadata["tags"], list)

@patch("subprocess.run")
def test_publish_doc_success(mock_run, doc_service, tmp_path):
    fake_blog_dir = tmp_path / "dotBlog"
    fake_content_dir = fake_blog_dir / "src" / "content" / "blog"
    os.makedirs(fake_content_dir, exist_ok=True)
    
    mock_run.return_value = MagicMock(returncode=0, stdout="success", stderr="")
    
    # 创建测试文档
    doc = doc_service.create_doc(title="测试发布文章")
    doc_service.update_doc(doc["id"], content="这是正文内容，至少包含一些文字。")
    
    publish_service = PublishService(blog_dir=str(fake_blog_dir), doc_service=doc_service)
    result = publish_service.publish_doc(doc["id"])
    
    assert result["success"] is True
    assert "blogSlug" in result
    
    # 检查文件是否成功创建
    published_file = fake_content_dir / f"{result['blogSlug']}.md"
    assert published_file.exists()
    
    # 检查原文档状态更新
    updated_doc = doc_service.get_doc(doc["id"])
    assert updated_doc.get("published") is True
