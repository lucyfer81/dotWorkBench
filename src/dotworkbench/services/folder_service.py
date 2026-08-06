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
