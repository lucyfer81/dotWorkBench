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
