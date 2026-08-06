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
        try:
            from google import genai
            from google.genai import types
            import json
            import os
            
            # 检查是否有 API Key 环境变量，如果没有直接走 fallback
            if not os.environ.get("GEMINI_API_KEY"):
                raise ValueError("No GEMINI_API_KEY found")
                
            client = genai.Client()
            prompt = f"Analyze the following blog post and provide a short description (under 100 chars) and 1-3 relevant tags as a JSON object with keys 'description' and 'tags' (list of strings).\n\nTitle: {title}\nContent: {content}"
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                ),
            )
            data = json.loads(response.text)
            
            tags = data.get("tags", [])
            if not isinstance(tags, list):
                tags = ["Blog"]
            if not tags:
                tags = ["Blog"]
                
            return {
                "description": data.get("description", title)[:100],
                "tags": tags
            }
        except Exception:
            # Fallback to regex
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
        self.doc_service.update_doc(
            doc_id,
            published=True,
            blogSlug=slug,
            publishedAt=now_iso
        )

        return {
            "success": True,
            "message": "发布成功！",
            "blogSlug": slug,
            "publishedAt": now_iso
        }
