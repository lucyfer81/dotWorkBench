import os
import re
import subprocess
from datetime import datetime, timezone
import frontmatter
from pypinyin import lazy_pinyin
from dotworkbench.services.doc_service import DocService

class PublishService:
    def __init__(self, blog_dir: str = "/home/ubuntu/projects/dotBlog", doc_service: DocService | None = None):
        self.blog_dir = os.path.abspath(blog_dir)
        self.content_dir = os.path.join(self.blog_dir, "src/content/blog")
        self.doc_service = doc_service or DocService()

    def slugify(self, title: str) -> str:
        # 将中文转换为拼音数组
        pinyin_parts = lazy_pinyin(title)
        slug_raw = '-'.join(pinyin_parts)
        # 将非字母数字替换为连字符，并转小写
        slug = re.sub(r'[^a-zA-Z0-9]+', '-', slug_raw).strip('-').lower()
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

        # 始终根据当前标题重新生成最新 slug
        slug = self.slugify(title)

        # 检查是否存在旧 slug，若不同则清理旧文件
        existing_slug = doc.get("blogSlug")
        if existing_slug and existing_slug != slug:
            old_path = os.path.join(self.content_dir, f"{existing_slug}.md")
            if os.path.exists(old_path):
                try:
                    os.remove(old_path)
                except OSError:
                    pass
            subprocess.run(
                ["git", "rm", "--ignore-unmatch", f"src/content/blog/{existing_slug}.md"],
                cwd=self.blog_dir, capture_output=True, text=True
            )

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
            ["git", "add", "-A"],
            ["git", "commit", "-m", f"publish(blog): {title}"],
            ["git", "push", "origin", "main"]
        ]

        for cmd in git_cmds:
            res = subprocess.run(cmd, cwd=self.blog_dir, capture_output=True, text=True)
            # 如果 commit 没有变化允许忽略
            if cmd[1] == "commit":
                output = (res.stdout or "") + (res.stderr or "")
                if "nothing to commit" in output or "no changes added to commit" in output:
                    continue
            if res.returncode != 0 and "everything up-to-date" not in res.stderr:
                raise RuntimeError(f"Git command {' '.join(cmd)} failed: {res.stderr or res.stdout}")

        # 执行 Cloudflare Pages 构建与部署
        deploy_cmds = [
            ["npm", "run", "build"],
            ["npx", "wrangler", "pages", "deploy", "dist", "--project-name=dotblog-786", "--commit-dirty=true"]
        ]

        for cmd in deploy_cmds:
            res = subprocess.run(cmd, cwd=self.blog_dir, capture_output=True, text=True)
            if res.returncode != 0:
                raise RuntimeError(f"Deploy command {' '.join(cmd)} failed: {res.stderr or res.stdout}")

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

