# AFFiNE-style Vditor AI Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first phase of an AFFiNE-inspired personal AI Workbench featuring a 3-column React frontend (Vditor WYSIWYG Markdown editor with Slash Commands, doc tree sidebar, AI Copilot panel) and a Python FastAPI backend (YAML Frontmatter doc storage, port 5001 static hosting).

**Architecture:** Frontend built with Vite + React + TS and Vditor styled after AFFiNE UI, compiled to `frontend/dist`. Python FastAPI backend manages document CRUD operations on local `.md` files with YAML Frontmatter, serving the compiled static SPA and API routes on port `5001`.

**Tech Stack:** Python 3.12, FastAPI, Uvicorn, PyYAML/python-frontmatter, Vite, React 18, TypeScript, Vditor, Lucide React, CSS Custom Properties.

## Global Constraints
* **Language & Tone**: All UI labels and primary communication in Chinese.
* **Package Management**: Python packages managed via `uv` with venv at `.venv/bin`.
* **Port**: FastAPI running on port `5001`.
* **Editor**: Vditor locked strictly in 所见即所得 (WYSIWYG/IR) mode.

---

### Task 1: Python FastAPI Backend & YAML Frontmatter Document Engine

**Files:**
- Create: `src/dotworkbench/services/doc_service.py`
- Modify: `pyproject.toml`
- Create: `tests/test_doc_service.py`
- Modify: `src/dotworkbench/main.py`

**Interfaces:**
- Consumes: None
- Produces: `DocService` class with methods `list_docs()`, `get_doc(doc_id)`, `create_doc(title, parent_id)`, `update_doc(doc_id, title, content)`, `delete_doc(doc_id)`. FastAPI server entry point at `src/dotworkbench/main.py`.

- [ ] **Step 1: Install Python dependencies using `uv`**

Run:
```bash
uv add fastapi "uvicorn[standard]" python-frontmatter pydantic pytest
```

- [ ] **Step 2: Write failing unit test for `DocService`**

Create `tests/test_doc_service.py`:
```python
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
```

- [ ] **Step 3: Run test to verify failure**

Run: `.venv/bin/pytest tests/test_doc_service.py -v`
Expected: FAIL with `ModuleNotFoundError` or `ImportError`.

- [ ] **Step 4: Implement `DocService` in `src/dotworkbench/services/doc_service.py`**

Create `src/dotworkbench/services/doc_service.py`:
```python
import os
import uuid
from datetime import datetime, timezone
import frontmatter

class DocService:
    def __init__(self, storage_dir: str = "data/docs"):
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    def _get_file_path(self, doc_id: str) -> str:
        return os.path.join(self.storage_dir, f"{doc_id}.md")

    def list_docs(self) -> list[dict]:
        docs = []
        for filename in os.listdir(self.storage_dir):
            if filename.endswith(".md"):
                doc_id = filename[:-3]
                filepath = self._get_file_path(doc_id)
                try:
                    post = frontmatter.load(filepath)
                    docs.append({
                        "id": post.get("id", doc_id),
                        "title": post.get("title", "未命名文档"),
                        "parentId": post.get("parentId"),
                        "createdAt": post.get("createdAt"),
                        "updatedAt": post.get("updatedAt"),
                        "icon": post.get("icon", "📝")
                    })
                except Exception:
                    continue
        return docs

    def get_doc(self, doc_id: str) -> dict:
        filepath = self._get_file_path(doc_id)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Document {doc_id} not found")
        post = frontmatter.load(filepath)
        return {
            "id": post.get("id", doc_id),
            "title": post.get("title", "未命名文档"),
            "parentId": post.get("parentId"),
            "createdAt": post.get("createdAt"),
            "updatedAt": post.get("updatedAt"),
            "icon": post.get("icon", "📝"),
            "content": post.content
        }

    def create_doc(self, title: str = "未命名文档", parent_id: str | None = None) -> dict:
        doc_id = f"doc-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        post = frontmatter.Post(
            content="",
            id=doc_id,
            title=title,
            parentId=parent_id,
            createdAt=now,
            updatedAt=now,
            icon="📝"
        )
        filepath = self._get_file_path(doc_id)
        with open(filepath, "wb") as f:
            frontmatter.dump(post, f)
        return {
            "id": doc_id,
            "title": title,
            "parentId": parent_id,
            "createdAt": now,
            "updatedAt": now,
            "icon": "📝"
        }

    def update_doc(self, doc_id: str, title: str | None = None, content: str | None = None) -> dict:
        filepath = self._get_file_path(doc_id)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Document {doc_id} not found")
        post = frontmatter.load(filepath)
        now = datetime.now(timezone.utc).isoformat()
        
        if title is not None:
            post["title"] = title
        if content is not None:
            post.content = content
        post["updatedAt"] = now

        with open(filepath, "wb") as f:
            frontmatter.dump(post, f)

        return {
            "id": doc_id,
            "title": post.get("title"),
            "parentId": post.get("parentId"),
            "createdAt": post.get("createdAt"),
            "updatedAt": now,
            "icon": post.get("icon", "📝"),
            "content": post.content
        }

    def delete_doc(self, doc_id: str) -> bool:
        filepath = self._get_file_path(doc_id)
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False
```

- [ ] **Step 5: Re-run test to verify pass**

Run: `.venv/bin/pytest tests/test_doc_service.py -v`
Expected: PASS.

- [ ] **Step 6: Implement FastAPI `src/dotworkbench/main.py` REST API and static mount**

Modify `src/dotworkbench/main.py`:
```python
import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotworkbench.services.doc_service import DocService

app = FastAPI(title="dotWorkbench API")
doc_service = DocService()

class CreateDocRequest(BaseModel):
    title: str = "未命名文档"
    parentId: str | None = None

class UpdateDocRequest(BaseModel):
    title: str | None = None
    content: str | None = None

class AIChatRequest(BaseModel):
    message: str
    context: str | None = None

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
        return doc_service.update_doc(doc_id, title=req.title, content=req.content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found")

@app.delete("/api/docs/{doc_id}")
def delete_doc(doc_id: str):
    success = doc_service.delete_doc(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="Document not found")
    return {"success": True}

@app.post("/api/ai/chat")
def ai_chat(req: AIChatRequest):
    # Standard mock AI response for prompt processing
    reply = f"【AI助手分析】针对请求：'{req.message}'\n\n根据当前文档上下文，生成优化建议如下：\n- 提炼核心要点\n- 完善结构与排版"
    return {"reply": reply}

# Mount static dist directory if exists
frontend_dist = os.path.join(os.path.dirname(__file__), "../../frontend/dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        file_path = os.path.join(frontend_dist, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_dist, "index.html"))
```

- [ ] **Step 7: Commit Task 1**

```bash
git add pyproject.toml src/dotworkbench/services/doc_service.py src/dotworkbench/main.py tests/test_doc_service.py
git commit -m "feat: implement FastAPI backend with YAML Frontmatter DocService"
```

---

### Task 2: React + Vite Frontend Setup & AFFiNE Design System Token Integration

**Files:**
- Create: `frontend/` (via `npm create vite@latest`)
- Modify: `frontend/package.json`
- Create: `frontend/src/styles/affine-theme.css`
- Modify: `frontend/src/App.css`

**Interfaces:**
- Consumes: None
- Produces: React + Vite application shell with AFFiNE CSS design tokens (`var(--affine-...)`).

- [ ] **Step 1: Initialize Vite React TypeScript project inside `frontend` directory**

Run:
```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install lucide-react vditor
```

- [ ] **Step 2: Create AFFiNE Design System CSS Tokens**

Create `frontend/src/styles/affine-theme.css`:
```css
:root {
  --affine-brand-color: #1e96eb;
  --affine-background-primary: #ffffff;
  --affine-background-secondary: #f7f8f9;
  --affine-background-sidebar: #f4f5f7;
  --affine-background-hover: #e9ecef;
  --affine-text-primary: #121212;
  --affine-text-secondary: #6c757d;
  --affine-border-color: #e3e5e8;
  --affine-paper-width: 800px;
  --affine-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
  --affine-shadow-card: 0 4px 12px rgba(0, 0, 0, 0.05);
}

[data-theme='dark'] {
  --affine-background-primary: #191919;
  --affine-background-secondary: #202020;
  --affine-background-sidebar: #1e1e1e;
  --affine-background-hover: #2c2c2c;
  --affine-text-primary: #e0e0e0;
  --affine-text-secondary: #9e9e9e;
  --affine-border-color: #2f2f2f;
  --affine-shadow-card: 0 4px 12px rgba(0, 0, 0, 0.3);
}

body {
  margin: 0;
  padding: 0;
  font-family: var(--affine-font-family);
  background-color: var(--affine-background-primary);
  color: var(--affine-text-primary);
  overflow: hidden;
}

.affine-app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
}
```

- [ ] **Step 3: Verify build compiles cleanly**

Run: `cd frontend && npm run build`
Expected: Builds without errors and generates `dist/` directory.

- [ ] **Step 4: Commit Task 2**

```bash
git add frontend/
git commit -m "feat: scaffold React frontend with AFFiNE CSS tokens and dependencies"
```

---

### Task 3: Vditor Wrapper with AFFiNE Paper Theme, WYSIWYG Mode & Slash Commands

**Files:**
- Create: `frontend/src/components/Editor/VditorEditor.tsx`
- Create: `frontend/src/components/Editor/vditor-affine.css`

**Interfaces:**
- Consumes: Vditor package
- Produces: `<VditorEditor content={content} onChange={onChange} onSelectText={onSelectText} />` component.

- [ ] **Step 1: Write Vditor AFFiNE Theme Overrides**

Create `frontend/src/components/Editor/vditor-affine.css`:
```css
/* Custom AFFiNE Paper Look for Vditor */
.vditor-affine-wrapper {
  max-width: var(--affine-paper-width);
  margin: 0 auto;
  padding: 20px 40px;
  height: 100%;
  box-sizing: border-box;
}

.vditor-affine-wrapper .vditor {
  border: none !important;
  background: transparent !important;
}

.vditor-affine-wrapper .vditor-toolbar {
  border-bottom: 1px solid var(--affine-border-color) !important;
  background-color: var(--affine-background-secondary) !important;
  border-radius: 8px;
  margin-bottom: 16px;
}

.vditor-affine-wrapper .vditor-wysiwyg {
  background: transparent !important;
  color: var(--affine-text-primary) !important;
  font-size: 16px;
  line-height: 1.7;
}

.vditor-affine-wrapper .vditor-reset {
  color: var(--affine-text-primary) !important;
}
```

- [ ] **Step 2: Implement `VditorEditor.tsx` with WYSIWYG lock and Slash Hint**

Create `frontend/src/components/Editor/VditorEditor.tsx`:
```tsx
import React, { useEffect, useRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './vditor-affine.css';

interface VditorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectText?: (text: string) => void;
}

export const VditorEditor: React.FC<VditorEditorProps> = ({ value, onChange, onSelectText }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const vditorInstance = useRef<Vditor | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const vditor = new Vditor(editorRef.current, {
      height: '100%',
      mode: 'wysiwyg', // Strictly WYSIWYG
      toolbarConfig: {
        hide: false,
        pin: true,
      },
      cache: {
        enable: false,
      },
      preview: {
        actions: [],
      },
      hint: {
        parse: true,
        extend: [
          {
            key: '/h1',
            hint: () => [
              {
                value: '# ',
                html: '<b># 一级标题</b> (H1)',
              },
            ],
          },
          {
            key: '/h2',
            hint: () => [
              {
                value: '## ',
                html: '<b>## 二级标题</b> (H2)',
              },
            ],
          },
          {
            key: '/todo',
            hint: () => [
              {
                value: '* [ ] ',
                html: '<b>* [ ] 待办事项</b> (Todo List)',
              },
            ],
          },
          {
            key: '/code',
            hint: () => [
              {
                value: '```\n\n```',
                html: '<b>``` 代码块</b> (Code Block)',
              },
            ],
          },
          {
            key: '/ai',
            hint: () => [
              {
                value: '',
                html: '<b>✨ 呼叫 AI 助手</b>',
              },
            ],
          },
        ],
      },
      input: (val) => {
        onChange(val);
      },
      after: () => {
        vditor.setValue(value);
        vditorInstance.current = vditor;
      },
    });

    return () => {
      vditor.destroy();
    };
  }, []);

  // Sync value when switching documents
  useEffect(() => {
    if (vditorInstance.current && value !== vditorInstance.current.getValue()) {
      vditorInstance.current.setValue(value);
    }
  }, [value]);

  const handleMouseUp = () => {
    if (onSelectText) {
      const selected = window.getSelection()?.toString() || '';
      if (selected.trim().length > 0) {
        onSelectText(selected);
      }
    }
  };

  return (
    <div className="vditor-affine-wrapper" onMouseUp={handleMouseUp}>
      <div ref={editorRef} />
    </div>
  );
};
```

- [ ] **Step 3: Test component build**

Run: `cd frontend && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit Task 3**

```bash
git add frontend/src/components/Editor/
git commit -m "feat: implement Vditor wrapper with WYSIWYG mode and AFFiNE paper theme"
```

---

### Task 4: 3-Column Layout, Sidebar Doc Tree & AI Copilot Panel Integration

**Files:**
- Create: `frontend/src/components/Sidebar/Sidebar.tsx`
- Create: `frontend/src/components/AIPanel/AIPanel.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: Backend API `/api/docs` and `/api/ai/chat`
- Produces: Complete AFFiNE Workbench UI with 3 columns.

- [ ] **Step 1: Build AFFiNE Left Sidebar (`Sidebar.tsx`)**

Create `frontend/src/components/Sidebar/Sidebar.tsx`:
```tsx
import React from 'react';
import { FileText, Plus, Search, ChevronRight, Trash2 } from 'lucide-react';

export interface DocItem {
  id: string;
  title: string;
  parentId?: string;
  icon?: string;
}

interface SidebarProps {
  docs: DocItem[];
  currentDocId: string | null;
  onSelectDoc: (id: string) => void;
  onCreateDoc: () => void;
  onDeleteDoc: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  docs,
  currentDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
}) => {
  return (
    <div style={{
      width: '260px',
      backgroundColor: 'var(--affine-background-sidebar)',
      borderRight: '1px solid var(--affine-border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none'
    }}>
      <div style={{ padding: '16px', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>🎨</span> dotWorkbench
      </div>
      
      <div style={{ padding: '0 12px 12px 12px' }}>
        <button
          onClick={onCreateDoc}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: 'var(--affine-brand-color)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontWeight: 500
          }}
        >
          <Plus size={16} /> 新建笔记
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {docs.map((doc) => (
          <div
            key={doc.id}
            onClick={() => onSelectDoc(doc.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '4px',
              backgroundColor: currentDocId === doc.id ? 'var(--affine-background-hover)' : 'transparent',
              color: 'var(--affine-text-primary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <FileText size={16} color="var(--affine-text-secondary)" />
              <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.title || '未命名文档'}
              </span>
            </div>
            <button
              onClick={(e) => onDeleteDoc(doc.id, e)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
            >
              <Trash2 size={14} color="var(--affine-text-secondary)" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Build AI Copilot Right Sidebar (`AIPanel.tsx`)**

Create `frontend/src/components/AIPanel/AIPanel.tsx`:
```tsx
import React, { useState } from 'react';
import { Sparkles, Send, ArrowRightToLine } from 'lucide-react';

interface AIPanelProps {
  selectedText: string;
  onInsertToEditor: (text: string) => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ selectedText, onInsertToEditor }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: '你好！我是你的 AI 工作台助手。选中编辑器中的文本或直接在下方输入对话指令。' },
  ]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context: selectedText }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { sender: 'ai', text: data.reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { sender: 'ai', text: '请求 AI 服务出现错误。' }]);
    }
  };

  return (
    <div style={{
      width: '320px',
      backgroundColor: 'var(--affine-background-secondary)',
      borderLeft: '1px solid var(--affine-border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--affine-border-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={18} color="var(--affine-brand-color)" /> AI 助手 Copilot
      </div>

      <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {selectedText && (
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--affine-background-hover)', borderRadius: '6px', fontSize: '12px' }}>
            <strong>当前划词:</strong> "{selectedText.slice(0, 40)}..."
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} style={{
            alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
            backgroundColor: m.sender === 'user' ? 'var(--affine-brand-color)' : 'var(--affine-background-primary)',
            color: m.sender === 'user' ? '#fff' : 'var(--affine-text-primary)',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            maxWidth: '85%',
            boxShadow: 'var(--affine-shadow-card)'
          }}>
            <div>{m.text}</div>
            {m.sender === 'ai' && idx > 0 && (
              <button
                onClick={() => onInsertToEditor(m.text)}
                style={{
                  marginTop: '8px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: 'var(--affine-background-hover)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowRightToLine size={12} /> 插入到编辑器
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid var(--affine-border-color)', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="问问 AI 助手..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--affine-border-color)' }}
        />
        <button onClick={handleSend} style={{ border: 'none', backgroundColor: 'var(--affine-brand-color)', color: '#fff', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Assemble App.tsx**

Modify `frontend/src/App.tsx`:
```tsx
import React, { useEffect, useState } from 'react';
import './styles/affine-theme.css';
import { Sidebar, DocItem } from './components/Sidebar/Sidebar';
import { VditorEditor } from './components/Editor/VditorEditor';
import { AIPanel } from './components/AIPanel/AIPanel';

export const App: React.FC = () => {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string>('');

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/docs');
      const data = await res.json();
      setDocs(data);
      if (data.length > 0 && !currentDocId) {
        loadDoc(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadDoc = async (id: string) => {
    setCurrentDocId(id);
    try {
      const res = await fetch(`/api/docs/${id}`);
      const data = await res.json();
      setCurrentContent(data.content || '');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateDoc = async () => {
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新笔记' }),
      });
      const newDoc = await res.json();
      await fetchDocs();
      loadDoc(newDoc.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      await fetchDocs();
      if (currentDocId === id) {
        setCurrentDocId(null);
        setCurrentContent('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleContentChange = async (val: string) => {
    setCurrentContent(val);
    if (currentDocId) {
      // Debounce save to backend
      fetch(`/api/docs/${currentDocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: val }),
      }).catch(console.error);
    }
  };

  const handleInsertToEditor = (text: string) => {
    setCurrentContent((prev) => prev + '\n\n' + text);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  return (
    <div className="affine-app-container">
      <Sidebar
        docs={docs}
        currentDocId={currentDocId}
        onSelectDoc={loadDoc}
        onCreateDoc={handleCreateDoc}
        onDeleteDoc={handleDeleteDoc}
      />
      <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
        {currentDocId ? (
          <VditorEditor
            value={currentContent}
            onChange={handleContentChange}
            onSelectText={setSelectedText}
          />
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--affine-text-secondary)' }}>
            请选择或新建一篇笔记开始编辑
          </div>
        )}
      </div>
      <AIPanel selectedText={selectedText} onInsertToEditor={handleInsertToEditor} />
    </div>
  );
};

export default App;
```

- [ ] **Step 4: Commit Task 4**

```bash
git add frontend/src/
git commit -m "feat: complete 3-column layout integrating Sidebar, Vditor and AI Panel"
```

---

### Task 5: Fullstack Bundle, FastAPI Static Mount & Port 5001 Verification

**Files:**
- Modify: `frontend/dist/` (via build)
- Verify: `src/dotworkbench/main.py`

**Interfaces:**
- Consumes: Complete codebase
- Produces: Working application at `http://localhost:5001`

- [ ] **Step 1: Compile Frontend Production Build**

Run: `cd frontend && npm run build`
Expected: Successfully generates `frontend/dist/index.html` and assets.

- [ ] **Step 2: Start FastAPI Server on Port 5001**

Run: `.venv/bin/python -m uvicorn dotworkbench.main:app --host 0.0.0.0 --port 5001`
Expected: Server starts on port 5001 without error.

- [ ] **Step 3: Verify REST API & Static Serving**

Run: `curl http://localhost:5001/api/docs`
Expected: HTTP 200 with JSON list `[]` or created docs.

Run: `curl http://localhost:5001/`
Expected: HTTP 200 returning HTML containing `<div id="root"></div>`.

- [ ] **Step 4: Final Commit**

```bash
git add .
git commit -m "chore: verify build and static mounting on port 5001"
```
