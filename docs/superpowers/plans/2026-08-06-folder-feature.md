# Folder Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement explicit folder support with recursive cascading deletion and tree navigation UI in dotWorkbench.

**Architecture:** Extend FastAPI backend with `FolderService` for `data/folders/{folder_id}.json` CRUD, cascade deletion, and `/api/nodes` endpoint. Update React frontend with a recursive `SidebarTree` component for collapsible folder tree navigation, inside-folder creation, and inline renaming.

**Tech Stack:** Python 3.12, FastAPI, pytest, React 18, Vite, TypeScript, Lucide React.

## Global Constraints

- Backend dependencies must be managed using `uv`.
- Python virtual environment is located at `.venv/bin`.
- Existing document storage format (`data/docs/{id}.md` with frontmatter) must remain compatible.
- Folders are stored as JSON files in `data/folders/{id}.json`.

---

### Task 1: Backend FolderService Implementation & Unit Tests

**Files:**
- Create: `src/dotworkbench/services/folder_service.py`
- Test: `tests/test_folder_service.py`

**Interfaces:**
- Consumes: `os`, `json`, `uuid`, `frontmatter`, `DocService`
- Produces: `FolderService` class with methods `list_folders()`, `create_folder(title, parent_id)`, `update_folder(folder_id, title, parent_id)`, `delete_folder_recursive(folder_id, doc_service)`

- [ ] **Step 1: Write failing unit test for FolderService**

Create `tests/test_folder_service.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_folder_service.py`
Expected: FAIL (ModuleNotFoundError or ImportError because `FolderService` does not exist yet)

- [ ] **Step 3: Implement FolderService**

Create `src/dotworkbench/services/folder_service.py`:

```python
import os
import json
import uuid
from datetime import datetime, timezone

class FolderService:
    def __init__(self, storage_dir: str = "data/folders"):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    def _get_file_path(self, folder_id: str) -> str:
        return os.path.join(self.storage_dir, f"{folder_id}.json")

    def list_folders(self) -> list[dict]:
        folders = []
        if not os.path.exists(self.storage_dir):
            return folders
        for filename in os.listdir(self.storage_dir):
            if filename.endswith(".json"):
                filepath = os.path.join(self.storage_dir, filename)
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        data["type"] = "folder"
                        folders.append(data)
                except Exception:
                    continue
        return folders

    def get_folder(self, folder_id: str) -> dict:
        filepath = self._get_file_path(folder_id)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Folder {folder_id} not found")
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            data["type"] = "folder"
            return data

    def create_folder(self, title: str = "新建文件夹", parent_id: str | None = None) -> dict:
        folder_id = f"folder-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        folder_data = {
            "id": folder_id,
            "type": "folder",
            "title": title,
            "parentId": parent_id,
            "icon": "📁",
            "createdAt": now,
            "updatedAt": now
        }
        filepath = self._get_file_path(folder_id)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(folder_data, f, ensure_ascii=False, indent=2)
        return folder_data

    def update_folder(self, folder_id: str, title: str | None = None, parent_id: str | None = None) -> dict:
        folder = self.get_folder(folder_id)
        
        if parent_id is not None and parent_id != folder.get("parentId"):
            if parent_id == folder_id:
                raise ValueError("Cannot set folder as its own parent")
            # Check for cycles
            all_folders = {f["id"]: f for f in self.list_folders()}
            curr = parent_id
            while curr:
                if curr == folder_id:
                    raise ValueError("Cannot move folder into its own subfolder")
                curr = all_folders.get(curr, {}).get("parentId")
            folder["parentId"] = parent_id

        if title is not None:
            folder["title"] = title

        folder["updatedAt"] = datetime.now(timezone.utc).isoformat()
        filepath = self._get_file_path(folder_id)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(folder, f, ensure_ascii=False, indent=2)
        return folder

    def delete_folder_recursive(self, folder_id: str, doc_service) -> bool:
        filepath = self._get_file_path(folder_id)
        if not os.path.exists(filepath):
            return False

        all_folders = self.list_folders()
        all_docs = doc_service.list_docs()

        # Gather all child folder IDs and child doc IDs recursively
        folders_to_delete = set([folder_id])
        changed = True
        while changed:
            changed = False
            for f in all_folders:
                if f["parentId"] in folders_to_delete and f["id"] not in folders_to_delete:
                    folders_to_delete.add(f["id"])
                    changed = True

        docs_to_delete = [d["id"] for d in all_docs if d.get("parentId") in folders_to_delete]

        # Delete docs
        for doc_id in docs_to_delete:
            doc_service.delete_doc(doc_id)

        # Delete folders
        for fid in folders_to_delete:
            fpath = self._get_file_path(fid)
            if os.path.exists(fpath):
                os.remove(fpath)

        return True
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run pytest tests/test_folder_service.py`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/dotworkbench/services/folder_service.py tests/test_folder_service.py
git commit -m "feat: add FolderService with recursive cascade deletion and cycle prevention"
```

---

### Task 2: Backend REST API Integration for Nodes and Folders

**Files:**
- Modify: `src/dotworkbench/main.py`
- Test: `tests/test_api_folders.py`

**Interfaces:**
- Consumes: `FolderService`, `DocService`
- Produces: API endpoints `/api/nodes`, `POST /api/folders`, `PUT /api/folders/{id}`, `DELETE /api/folders/{id}`

- [ ] **Step 1: Write failing API test**

Create `tests/test_api_folders.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest tests/test_api_folders.py`
Expected: FAIL (404 on `/api/nodes` or `/api/folders`)

- [ ] **Step 3: Update main.py to integrate FolderService and new endpoints**

Modify `src/dotworkbench/main.py`:

```python
import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotworkbench.services.doc_service import DocService
from dotworkbench.services.folder_service import FolderService
from dotworkbench.services.publish_service import PublishService

app = FastAPI(title="dotWorkbench API")
doc_service = DocService()
folder_service = FolderService()
publish_service = PublishService(doc_service=doc_service)

class CreateDocRequest(BaseModel):
    title: str = "未命名文档"
    parentId: str | None = None

class UpdateDocRequest(BaseModel):
    title: str | None = None
    content: str | None = None
    parentId: str | None = None

class CreateFolderRequest(BaseModel):
    title: str = "新建文件夹"
    parentId: str | None = None

class UpdateFolderRequest(BaseModel):
    title: str | None = None
    parentId: str | None = None

class AIChatRequest(BaseModel):
    message: str
    context: str | None = None

@app.get("/api/nodes")
def list_nodes():
    folders = folder_service.list_folders()
    docs = doc_service.list_docs()
    for d in docs:
        d["type"] = "doc"
    return folders + docs

@app.get("/api/docs")
def list_docs():
    return doc_service.list_docs()

@app.get("/api/docs/{doc_id}")
def get_doc(doc_id: str):
    try:
        return doc_service.get_doc(doc_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found")

@app.post("/api/docs")
def create_doc(req: CreateDocRequest):
    return doc_service.create_doc(title=req.title, parent_id=req.parentId)

@app.put("/api/docs/{doc_id}")
def update_doc(doc_id: str, req: UpdateDocRequest):
    try:
        kwargs = {}
        if req.parentId is not None:
            kwargs["parentId"] = req.parentId
        return doc_service.update_doc(doc_id, title=req.title, content=req.content, **kwargs)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found")

@app.delete("/api/docs/{doc_id}")
def delete_doc(doc_id: str):
    success = doc_service.delete_doc(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}

@app.post("/api/folders")
def create_folder(req: CreateFolderRequest):
    return folder_service.create_folder(title=req.title, parent_id=req.parentId)

@app.put("/api/folders/{folder_id}")
def update_folder(folder_id: str, req: UpdateFolderRequest):
    try:
        return folder_service.update_folder(folder_id, title=req.title, parent_id=req.parentId)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Folder not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/api/folders/{folder_id}")
def delete_folder(folder_id: str):
    success = folder_service.delete_folder_recursive(folder_id, doc_service=doc_service)
    if not success:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"success": True}

@app.post("/api/docs/{doc_id}/publish")
def publish_doc(doc_id: str):
    try:
        return publish_service.publish_doc(doc_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ai/chat")
def ai_chat(req: AIChatRequest):
    reply = f"【AI Copilot】关于请求 '{req.message}'：\n"
    if req.context:
        reply += f"\n引用划词上下文：\"{req.context[:100]}\"\n"
    reply += "\n建议与修改建议：\n1. 进一步补充逻辑细节\n2. 保持 AFFiNE 的简洁条理"
    return {"reply": reply}

# Mount static dist directory if exists
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API route not found")
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
```

- [ ] **Step 4: Run all pytest tests to verify they pass**

Run: `uv run pytest`
Expected: All tests pass (including existing and new API test)

- [ ] **Step 5: Commit**

```bash
git add src/dotworkbench/main.py tests/test_api_folders.py
git commit -m "feat: add /api/nodes and /api/folders API endpoints"
```

---

### Task 3: Frontend Tree UI Component and App Integration

**Files:**
- Modify: `frontend/src/components/Sidebar/Sidebar.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `/api/nodes`, `/api/folders`, `/api/docs`
- Produces: Collapsible sidebar tree UI with inline renaming, creation of sub-docs and sub-folders, and folder deletion confirmation.

- [ ] **Step 1: Update Sidebar.tsx with Folder Tree UI**

Replace `frontend/src/components/Sidebar/Sidebar.tsx` with tree-aware recursive component:

```tsx
import React, { useState } from 'react';
import { FileText, Folder, FolderOpen, Plus, Trash2, ChevronRight, ChevronDown, Edit2 } from 'lucide-react';

export interface NodeItem {
  id: string;
  type: 'folder' | 'doc';
  title: string;
  parentId?: string | null;
  icon?: string;
  published?: boolean;
}

export interface TreeNode extends NodeItem {
  children?: TreeNode[];
}

interface SidebarProps {
  nodes: NodeItem[];
  currentDocId: string | null;
  onSelectDoc: (id: string) => void;
  onCreateDoc: (parentId?: string) => void;
  onCreateFolder: (parentId?: string) => void;
  onDeleteDoc: (id: string, e: React.MouseEvent) => void;
  onDeleteFolder: (id: string, title: string, e: React.MouseEvent) => void;
  onRenameNode: (id: string, type: 'folder' | 'doc', newTitle: string) => void;
}

// Build hierarchical tree from flat node array
const buildTree = (nodes: NodeItem[]): TreeNode[] => {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  nodes.forEach(node => {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children!.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  });

  return roots;
};

export const Sidebar: React.FC<SidebarProps> = ({
  nodes,
  currentDocId,
  onSelectDoc,
  onCreateDoc,
  onCreateFolder,
  onDeleteDoc,
  onDeleteFolder,
  onRenameNode,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStartRename = (node: NodeItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(node.id);
    setEditingTitle(node.title || '');
  };

  const handleSaveRename = (node: NodeItem) => {
    if (editingTitle.trim() && editingTitle !== node.title) {
      onRenameNode(node.id, node.type, editingTitle.trim());
    }
    setEditingId(null);
  };

  const tree = buildTree(nodes);

  const renderTreeItem = (node: TreeNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedIds.has(node.id);
    const isSelected = currentDocId === node.id;
    const isEditing = editingId === node.id;

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => {
            if (isFolder) {
              setExpandedIds(prev => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              });
            } else {
              onSelectDoc(node.id);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            paddingLeft: `${8 + depth * 16}px`,
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '2px',
            backgroundColor: isSelected ? 'var(--affine-background-hover)' : 'transparent',
            color: 'var(--affine-text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
            {isFolder ? (
              <span onClick={(e) => toggleExpand(node.id, e)} style={{ display: 'flex', alignItems: 'center', padding: '2px' }}>
                {isExpanded ? <ChevronDown size={14} color="var(--affine-text-secondary)" /> : <ChevronRight size={14} color="var(--affine-text-secondary)" />}
              </span>
            ) : (
              <span style={{ width: '14px' }} />
            )}

            {isFolder ? (
              isExpanded ? <FolderOpen size={16} color="#4f46e5" /> : <Folder size={16} color="#4f46e5" />
            ) : (
              <FileText size={16} color="var(--affine-text-secondary)" />
            )}

            {isEditing ? (
              <input
                type="text"
                value={editingTitle}
                onChange={e => setEditingTitle(e.target.value)}
                onBlur={() => handleSaveRename(node)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleSaveRename(node);
                }}
                autoFocus
                onClick={e => e.stopPropagation()}
                style={{
                  fontSize: '13px',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  border: '1px solid var(--affine-brand-color)',
                  outline: 'none',
                  width: '80%'
                }}
              />
            ) : (
              <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {node.title || (isFolder ? '未命名文件夹' : '未命名文档')}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isFolder && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateDoc(node.id);
                    setExpandedIds(prev => new Set(prev).add(node.id));
                  }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.7 }}
                  title="在文件夹内新建文档"
                >
                  <Plus size={14} color="var(--affine-text-secondary)" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateFolder(node.id);
                    setExpandedIds(prev => new Set(prev).add(node.id));
                  }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.7 }}
                  title="在文件夹内新建子文件夹"
                >
                  <Folder size={14} color="var(--affine-text-secondary)" />
                </button>
              </>
            )}

            <button
              onClick={(e) => handleStartRename(node, e)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
              title="重命名"
            >
              <Edit2 size={13} color="var(--affine-text-secondary)" />
            </button>

            <button
              onClick={(e) => isFolder ? onDeleteFolder(node.id, node.title, e) : onDeleteDoc(node.id, e)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
              title={isFolder ? "删除文件夹" : "删除文档"}
            >
              <Trash2 size={13} color="var(--affine-text-secondary)" />
            </button>
          </div>
        </div>

        {isFolder && isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: '280px',
      backgroundColor: 'var(--affine-background-sidebar)',
      borderRight: '1px solid var(--affine-border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none'
    }}>
      <div style={{ padding: '16px', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>🎨</span> dotWorkbench
      </div>
      
      <div style={{ padding: '0 12px 12px 12px', display: 'flex', gap: '8px' }}>
        <button
          onClick={() => onCreateDoc()}
          style={{
            flex: 1,
            padding: '8px 10px',
            backgroundColor: 'var(--affine-brand-color)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          <Plus size={15} /> 新建文档
        </button>
        <button
          onClick={() => onCreateFolder()}
          style={{
            padding: '8px 10px',
            backgroundColor: 'transparent',
            color: 'var(--affine-text-primary)',
            border: '1px solid var(--affine-border-color)',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: 500
          }}
          title="在根目录新建文件夹"
        >
          <Folder size={15} /> 新建文件夹
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {tree.map(node => renderTreeItem(node, 0))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Update App.tsx to use `/api/nodes` and Folder API calls**

Modify `frontend/src/App.tsx`:

```tsx
import React, { useState, useEffect } from 'react';
import { Sidebar, NodeItem } from './components/Sidebar/Sidebar';
import { Header } from './components/Header/Header';
import { Editor } from './components/Editor/Editor';
import { AIPanel } from './components/AIPanel/AIPanel';
import './App.css';

export interface DocDetail {
  id: string;
  title: string;
  content: string;
  icon?: string;
  published?: boolean;
  blogSlug?: string;
  publishedAt?: string;
}

export const App: React.FC = () => {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentDoc, setCurrentDoc] = useState<DocDetail | null>(null);
  const [selectedText, setSelectedText] = useState('');

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/nodes');
      if (res.ok) {
        const data = await res.json();
        setNodes(data);
        if (!currentDocId && data.length > 0) {
          const firstDoc = data.find((n: NodeItem) => n.type === 'doc');
          if (firstDoc) setCurrentDocId(firstDoc.id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch nodes', e);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  useEffect(() => {
    if (currentDocId) {
      fetch(`/api/docs/${currentDocId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setCurrentDoc(data);
        })
        .catch(console.error);
    } else {
      setCurrentDoc(null);
    }
  }, [currentDocId]);

  const handleCreateDoc = async (parentId?: string) => {
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '未命名文档', parentId })
      });
      if (res.ok) {
        const newDoc = await res.json();
        await fetchNodes();
        setCurrentDocId(newDoc.id);
      }
    } catch (e) {
      console.error('Failed to create doc', e);
    }
  };

  const handleCreateFolder = async (parentId?: string) => {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新建文件夹', parentId })
      });
      if (res.ok) {
        await fetchNodes();
      }
    } catch (e) {
      console.error('Failed to create folder', e);
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除该文档吗？')) return;
    try {
      const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentDocId === id) setCurrentDocId(null);
        fetchNodes();
      }
    } catch (e) {
      console.error('Failed to delete doc', e);
    }
  };

  const handleDeleteFolder = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除文件夹“${title || '未命名文件夹'}”及其内部包含的全部子内容吗？此操作不可撤销。`)) return;
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchNodes();
      }
    } catch (e) {
      console.error('Failed to delete folder', e);
    }
  };

  const handleRenameNode = async (id: string, type: 'folder' | 'doc', newTitle: string) => {
    try {
      const endpoint = type === 'folder' ? `/api/folders/${id}` : `/api/docs/${id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        fetchNodes();
        if (type === 'doc' && currentDocId === id && currentDoc) {
          setCurrentDoc({ ...currentDoc, title: newTitle });
        }
      }
    } catch (e) {
      console.error('Failed to rename node', e);
    }
  };

  const handleDocChange = async (title: string, content: string) => {
    if (!currentDocId) return;
    try {
      const res = await fetch(`/api/docs/${currentDocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      if (res.ok) {
        setCurrentDoc(prev => prev ? { ...prev, title, content } : null);
        setNodes(prev => prev.map(n => n.id === currentDocId ? { ...n, title } : n));
      }
    } catch (e) {
      console.error('Failed to update doc', e);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar
        nodes={nodes}
        currentDocId={currentDocId}
        onSelectDoc={setCurrentDocId}
        onCreateDoc={handleCreateDoc}
        onCreateFolder={handleCreateFolder}
        onDeleteDoc={handleDeleteDoc}
        onDeleteFolder={handleDeleteFolder}
        onRenameNode={handleRenameNode}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
        <Header
          doc={currentDoc}
          onPublishSuccess={(publishedAt, slug) => {
            if (currentDoc) {
              setCurrentDoc({ ...currentDoc, published: true, publishedAt, blogSlug: slug });
              fetchNodes();
            }
          }}
        />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <Editor
            doc={currentDoc}
            onChange={handleDocChange}
            onSelectText={setSelectedText}
          />
          <AIPanel selectedText={selectedText} />
        </div>
      </div>
    </div>
  );
};
export default App;
```

- [ ] **Step 3: Test frontend build using Vite**

Run: `cd frontend && npm run build`
Expected: Build succeeds without TypeScript or Vite errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Sidebar/Sidebar.tsx frontend/src/App.tsx
git commit -m "feat: add SidebarTree component with folder support and integrate with App"
```

---

## Plan Self-Review
1. **Spec Coverage:**
   - Unified node structure (`type: "folder" | "doc"`) implemented in Task 1 & 2.
   - Recursive cascade delete algorithm implemented in `FolderService.delete_folder_recursive`.
   - Anti-cycle check implemented in `FolderService.update_folder`.
   - `/api/nodes`, `/api/folders` CRUD endpoints implemented in Task 2.
   - Frontend `SidebarTree` UI with collapsible folders, sub-doc/sub-folder creation, inline renaming, and confirmation box implemented in Task 3.
2. **Placeholder Scan:** Passed (no placeholders or vague instructions).
3. **Type Consistency:** Verified API signatures across tasks.
