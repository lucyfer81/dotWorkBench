# Design Spec: AFFiNE-style Vditor AI Workbench

## 1. Overview
The **AFFiNE-style Vditor AI Workbench** is a modern, web-based personal workspace integrating a Markdown editor, structured document tree, and AI copilot. 

### Key Objectives
* **UI/UX Aesthetics**: Replicate AFFiNE's high-aesthetic, boundaryless paper editor with modern dark/light themes and sleek sub-panels.
* **Editor Core**: Leverage **Vditor** locked in **WYSIWYG (WYSIWYG/Instant Rendering)** mode with custom styling, Slash Commands (`/`), and context-aware floating AI inline toolbar.
* **Architecture**: Vite + React (TypeScript) frontend compiled into static assets hosted directly by a Python FastAPI backend running on port `5001`.
* **Data Storage**: Portable `.md` files stored with **YAML Frontmatter** headers for self-contained metadata (`id`, `title`, `parentId`, `createdAt`, `updatedAt`, `tags`, etc.).

---

## 2. Architecture & Directory Structure

```text
dotWorkbench/
├── .venv/                      # Managed by uv
├── pyproject.toml              # FastAPI, uvicorn, PyYAML/python-frontmatter
├── AGENTS.md                   # Development guide & rules
├── data/
│   └── docs/                   # Storage directory for .md files with YAML frontmatter
├── docs/
│   └── superpowers/specs/      # Design specs
├── frontend/                   # React + Vite application
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar/        # Left doc tree navigation
│   │   │   ├── Editor/         # Vditor wrapper & AFFiNE paper container
│   │   │   └── AIPanel/        # Right AI Copilot & context chat
│   │   ├── styles/             # AFFiNE theme variables & Vditor CSS overrides
│   │   ├── types/              # TypeScript interfaces
│   │   └── App.tsx
│   └── dist/                   # Static bundle output
└── src/
    └── dotworkbench/
        ├── __init__.py
        ├── main.py             # FastAPI server & SPA static file router
        └── services/           # Markdown file manager & AI service handlers
```

---

## 3. Detailed Component Specifications

### 3.1 Left Sidebar (Document Navigation)
* **AFFiNE Workspace Header**: Shows workspace name and minimal logo with quick action toggle.
* **Search & Quick Create**: Quick search filter for document titles, plus `+ New Note` button.
* **Tree View Hierarchy**: Unlimited nesting depth with folder collapsible nodes, active selection highlighting, and context menu (Rename, Delete).
* **Collapsible Panel**: Left panel can be smoothly collapsed to maximize writing space.

### 3.2 Middle Editor (Vditor + AFFiNE Styling)
* **Paper Container**: Centered 800px paper-like layout (responsive, switchable to full-width).
* **WYSIWYG Locking**: Vditor initialized strictly in 所见即所得 (WYSIWYG/IR) mode. Mode selector hidden for ultra-clean writing experience.
* **Slash Commands (`/`)**: Integrated Vditor hint menu triggered by `/`. Supports:
  * Headers (`/h1`, `/h2`, `/h3`)
  * Lists & Checklists (`/todo`, `/bullet`)
  * Codeblocks (`/code`), Tables (`/table`), Quotes (`/quote`)
  * AI Shortcut (`/ai`) to invoke the AI floating assistant.
* **Floating AI Selection Bar**: Selecting text in editor pops up an inline action menu (`Ask AI`, `Summarize`, `Polish`, `Translate`).

### 3.3 Right AI Copilot Panel
* **Document Context Awareness**: Automatically references full active document content or current text selection.
* **Chat Stream Interaction**: Rich Markdown conversation rendering with code syntax highlighting.
* **Direct Actions**:
  * **Insert at Cursor**: Inserts AI output into the Vditor editor at current caret location.
  * **Replace Selection**: Replaces highlighted selection with AI generated text.
  * **Copy to Clipboard**.

---

## 4. Backend & Metadata Specification

### 4.1 Storage Model (YAML Frontmatter)
Each document is saved under `data/docs/{doc_id}.md` with standard YAML Frontmatter:

```markdown
---
id: "doc-8f92a1"
title: "AI Workbench Architecture"
parentId: "folder-01"
createdAt: "2026-08-05T10:00:00Z"
updatedAt: "2026-08-05T10:30:00Z"
tags: ["design", "ai"]
icon: "📝"
---

# Document Title
Markdown body text goes here...
```

### 4.2 FastAPI Routes (`http://localhost:5001`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/docs` | Scans `data/docs/` and returns tree metadata |
| `GET` | `/api/docs/{doc_id}` | Returns parsed frontmatter metadata and body content |
| `POST` | `/api/docs` | Creates a new markdown document |
| `PUT` | `/api/docs/{doc_id}` | Updates markdown content and frontmatter |
| `DELETE` | `/api/docs/{doc_id}` | Deletes a document |
| `POST` | `/api/ai/chat` | AI completion endpoint (supports streaming/SSE) |

### 4.3 Static File Serving & Port 5001
FastAPI serves static files from `frontend/dist`. Any non-API route falls back to `index.html` (SPA routing).
Execution via `uv`:
```bash
uv run uvicorn dotworkbench.main:app --host 0.0.0.0 --port 5001 --reload
```

---

## 5. Implementation & Verification Plan
1. **Scaffold Frontend & Backend**: Initialize Vite + React project, set up FastAPI structure with `uv`.
2. **Frontend UI Implementation**: Build 3-column layout, style AFFiNE design tokens, wrap Vditor in WYSIWYG mode.
3. **Slash Commands & AI Float Toolbar**: Configure Vditor hints and selection listeners.
4. **Backend Document API & Frontmatter Engine**: Implement file scanner, CRUD endpoints, and parser.
5. **Integration & Build Test**: Compile `frontend/dist`, mount via FastAPI, verify all features on `http://localhost:5001`.
