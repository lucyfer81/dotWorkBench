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
        if not os.path.exists(self.storage_dir):
            return docs
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
                        "icon": post.get("icon", "📝"),
                        "published": post.get("published", False),
                        "blogSlug": post.get("blogSlug"),
                        "publishedAt": post.get("publishedAt")
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
            "content": post.content,
            "published": post.get("published", False),
            "blogSlug": post.get("blogSlug"),
            "publishedAt": post.get("publishedAt")
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
        with open(filepath, "w", encoding="utf-8") as f:
            frontmatter.dump(post, f)
        return {
            "id": doc_id,
            "title": title,
            "parentId": parent_id,
            "createdAt": now,
            "updatedAt": now,
            "icon": "📝"
        }

    def update_doc(self, doc_id: str, title: str | None = None, content: str | None = None, **kwargs) -> dict:
        filepath = self._get_file_path(doc_id)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"Document {doc_id} not found")
        post = frontmatter.load(filepath)
        now = datetime.now(timezone.utc).isoformat()
        
        if title is not None:
            post["title"] = title
        if content is not None:
            post.content = content
            
        if "parentId" in kwargs:
            post["parentId"] = kwargs["parentId"]

        for k, v in kwargs.items():
            post[k] = v
            
        post["updatedAt"] = now

        with open(filepath, "w", encoding="utf-8") as f:
            frontmatter.dump(post, f)

        res = {
            "id": doc_id,
            "title": post.get("title"),
            "parentId": post.get("parentId"),
            "createdAt": post.get("createdAt"),
            "updatedAt": now,
            "icon": post.get("icon", "📝"),
            "content": post.content
        }
        for k in kwargs.keys():
            res[k] = post.get(k)
        return res

    def delete_doc(self, doc_id: str) -> bool:
        filepath = self._get_file_path(doc_id)
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False
