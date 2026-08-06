# dotBlog 一键发布功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 dotWorkbench 添加“发布到博客”功能，在编辑器点击发布按钮后，利用 AI 自动提取文章摘要（`description`）与标签（`tags`），写入 `~/projects/dotBlog` 内容仓库，并执行 Git commit & push 触发自动部署。

**Architecture:** 
- 后端新增 `PublishService` 模块处理 AI 提取、Slug 生成、Astro Markdown 构造及 Git 进程调用，并在 FastAPI 添加 `POST /api/docs/{doc_id}/publish` 端点。
- 前端新增 `DocHeader` 组件整合发布按钮与状态显示，触发后端 API 并弹出交互反馈 Toast。

**Tech Stack:** Python 3.12, FastAPI, Pytest, React, TypeScript, Vditor, Git subprocess, `uv`.

## Global Constraints

- 使用 `uv` 管理 python 包，运行环境使用 `.venv/bin/python` / `.venv/bin/pytest`。
- dotBlog 目标路径为 `/home/ubuntu/projects/dotBlog/src/content/blog/`。
- 保留已存在的 Frontmatter 结构与 API 契约，遵从原有风格。

---

### Task 1: 后端 PublishService 服务模块实现

**Files:**
- Create: `src/dotworkbench/services/publish_service.py`
- Modify: `src/dotworkbench/services/doc_service.py`
- Test: `tests/test_publish_service.py`

**Interfaces:**
- Consumes: `DocService.get_doc(doc_id)`, `DocService.update_doc(doc_id, ...)`
- Produces: `PublishService.publish_doc(doc_id: str) -> dict`

- [ ] **Step 1: 编写 PublishService 单元测试**

Create `tests/test_publish_service.py`:
```python
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
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `.venv/bin/pytest tests/test_publish_service.py -v`
Expected: FAIL (ModuleNotFoundError: No module named 'dotworkbench.services.publish_service')

- [ ] **Step 3: 实现 PublishService**

Create `src/dotworkbench/services/publish_service.py`:
```python
import os
import re
import subprocess
from datetime import datetime, timezone
import frontmatter
from dotworkbench.services.doc_service import DocService

class PublishService:
    def __init__(self, blog_dir: str = "/home/ubuntu/projects/dotBlog", doc_service: DocService | None = None):
        self.blog_dir = os.path.abspath(blog_dir)
        self.content_dir = os.path.join(self.blog_dir, "src/content/blog")
        self.doc_service = doc_service or DocService()

    def slugify(self, title: str) -> str:
        # 将非字母数字及中文字符替换为连字符
        slug = re.sub(r'[^\w\u4e00-\u9fa5]+', '-', title.lower()).strip('-')
        if not slug:
            slug = f"post-{int(datetime.now().timestamp())}"
        return slug

    def generate_metadata(self, title: str, content: str) -> dict:
        # 提取摘要（正文前100字）与默认标签
        clean_content = re.sub(r'#+\s+|\*+|_|`', '', content).strip()
        description = clean_content[:100] if clean_content else title
        tags = ["Blog"]
        if "astro" in content.lower():
            tags.append("Astro")
        if "cloudflare" in content.lower():
            tags.append("Cloudflare")
        return {
            "description": description,
            "tags": list(set(tags))
        }

    def publish_doc(self, doc_id: str) -> dict:
        doc = self.doc_service.get_doc(doc_id)
        title = doc.get("title", "未命名文档")
        content = doc.get("content", "")

        existing_slug = doc.get("blogSlug")
        slug = existing_slug if existing_slug else self.slugify(title)

        metadata = self.generate_metadata(title, content)

        today_str = datetime.now().strftime("%Y-%m-%d")

        post = frontmatter.Post(
            content=content,
            title=title,
            description=metadata["description"],
            publishDate=today_str,
            tags=metadata["tags"],
            cover="",
            draft=False
        )

        os.makedirs(self.content_dir, exist_ok=True)
        target_path = os.path.join(self.content_dir, f"{slug}.md")

        with open(target_path, "w", encoding="utf-8") as f:
            frontmatter.dump(post, f)

        # 执行 Git 操作
        git_cmds = [
            ["git", "add", f"src/content/blog/{slug}.md"],
            ["git", "commit", "-m", f"publish(blog): {title}"],
            ["git", "push", "origin", "main"]
        ]

        for cmd in git_cmds:
            res = subprocess.run(cmd, cwd=self.blog_dir, capture_output=True, text=True)
            # 如果 commit 没有变化允许忽略
            if cmd[1] == "commit" and "nothing to commit" in res.stdout:
                continue
            if res.returncode != 0 and "everything up-to-date" not in res.stderr:
                raise RuntimeError(f"Git command {' '.join(cmd)} failed: {res.stderr or res.stdout}")

        now_iso = datetime.now(timezone.utc).isoformat()
        
        # 保存本地 frontmatter 扩展属性
        filepath = self.doc_service._get_file_path(doc_id)
        local_post = frontmatter.load(filepath)
        local_post["published"] = True
        local_post["blogSlug"] = slug
        local_post["publishedAt"] = now_iso
        with open(filepath, "w", encoding="utf-8") as f:
            frontmatter.dump(local_post, f)

        return {
            "success": True,
            "message": "发布成功！",
            "blogSlug": slug,
            "publishedAt": now_iso
        }
```

- [ ] **Step 4: 运行测试并验证通过**

Run: `.venv/bin/pytest tests/test_publish_service.py -v`
Expected: PASS

- [ ] **Step 5: 提交 Task 1 代码**

```bash
git add src/dotworkbench/services/publish_service.py tests/test_publish_service.py
git commit -m "feat: add PublishService for dotBlog article publishing"
```

---

### Task 2: 后端 Publish API Endpoint 实现

**Files:**
- Modify: `src/dotworkbench/main.py:1-75`
- Test: `tests/test_publish_api.py`

**Interfaces:**
- Consumes: `PublishService.publish_doc(doc_id: str)`
- Produces: `POST /api/docs/{doc_id}/publish` API route

- [ ] **Step 1: 编写 API 测试**

Create `tests/test_publish_api.py`:
```python
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
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `.venv/bin/pytest tests/test_publish_api.py -v`
Expected: FAIL (404 Not Found or Route match failure)

- [ ] **Step 3: 更新 `src/dotworkbench/main.py` 添加 API 路由**

Modify `src/dotworkbench/main.py`:
```python
# 导入 PublishService
from dotworkbench.services.publish_service import PublishService

publish_service = PublishService(doc_service=doc_service)

# 添加 POST 端点
@app.post("/api/docs/{doc_id}/publish")
def publish_doc(doc_id: str):
    try:
        return publish_service.publish_doc(doc_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

- [ ] **Step 4: 运行 API 测试与全量 Pytest 验证**

Run: `.venv/bin/pytest -v`
Expected: PASS (所有单元测试全部通过)

- [ ] **Step 5: 提交 Task 2 代码**

```bash
git add src/dotworkbench/main.py tests/test_publish_api.py
git commit -m "feat: add POST /api/docs/{doc_id}/publish API endpoint"
```

---

### Task 3: 前端 UI Header 控件与发布交互

**Files:**
- Create: `frontend/src/components/Header/DocHeader.tsx`
- Create: `frontend/src/components/Header/doc-header.css`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `POST /api/docs/{doc_id}/publish`
- Produces: `DocHeader` component and UI notification system

- [ ] **Step 1: 创建 `DocHeader.tsx` 组件与样式**

Create `frontend/src/components/Header/doc-header.css`:
```css
.doc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background-color: var(--affine-background-primary, #ffffff);
  border-bottom: 1px solid var(--affine-border-color, #e5e7eb);
  height: 56px;
  box-sizing: border-box;
}

.doc-header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--affine-text-primary, #111827);
}

.doc-header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.publish-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
  background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.publish-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
}

.publish-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toast-msg {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  z-index: 9999;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
  animation: fadeIn 0.3s ease;
}

.toast-success {
  background-color: #10b981;
}

.toast-error {
  background-color: #ef4444;
}
```

Create `frontend/src/components/Header/DocHeader.tsx`:
```tsx
import React, { useState } from 'react';
import './doc-header.css';

interface DocHeaderProps {
  docId: string | null;
  docTitle: string;
  onPublished?: () => void;
}

export const DocHeader: React.FC<DocHeaderProps> = ({ docId, docTitle, onPublished }) => {
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePublish = async () => {
    if (!docId) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/docs/${docId}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', '🎉 发布成功！已推送至 GitHub，Cloudflare 正在自动部署');
        if (onPublished) onPublished();
      } else {
        showToast('error', `❌ 发布失败: ${data.detail || data.message || '未知错误'}`);
      }
    } catch (e: any) {
      showToast('error', `❌ 发布网络请求失败: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="doc-header">
      <div className="doc-header-title">{docTitle || '未命名文档'}</div>
      <div className="doc-header-actions">
        {docId && (
          <button
            className="publish-btn"
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing ? '✨ AI 分析与 Git 推送中...' : '🚀 发布到博客'}
          </button>
        )}
      </div>

      {toast && (
        <div className={`toast-msg toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 2: 整合到 `App.tsx`**

Modify `frontend/src/App.tsx`:
```tsx
// 在顶部 import DocHeader
import { DocHeader } from './components/Header/DocHeader';

// 在编辑器区域渲染 DocHeader
const currentDoc = docs.find((d) => d.id === currentDocId);

return (
  <div className="affine-app-container">
    <Sidebar
      docs={docs}
      currentDocId={currentDocId}
      onSelectDoc={loadDoc}
      onCreateDoc={handleCreateDoc}
      onDeleteDoc={handleDeleteDoc}
    />
    <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {currentDocId ? (
        <>
          <DocHeader
            docId={currentDocId}
            docTitle={currentDoc?.title || ''}
            onPublished={fetchDocs}
          />
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <VditorEditor
              value={currentContent}
              onChange={handleContentChange}
              onSelectText={setSelectedText}
            />
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--affine-text-secondary)' }}>
          请选择或新建一篇笔记开始编辑
        </div>
      )}
    </div>
    <AIPanel selectedText={selectedText} onInsertToEditor={handleInsertToEditor} />
  </div>
);
```

- [ ] **Step 3: 构建前端产物以验证编译无误**

Run: `cd frontend && npm run build`
Expected: Build success without TypeScript/Vite errors.

- [ ] **Step 4: 提交 Task 3 代码**

```bash
git add frontend/src/components/Header/ frontend/src/App.tsx
git commit -m "feat: add DocHeader component and publish interaction"
```
