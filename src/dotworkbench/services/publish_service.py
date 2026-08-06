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
