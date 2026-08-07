# 博客文章发布 Slug 脏数据与中文 Slug Bug 修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复文章发布到博客时 `blogSlug` 被硬编码为旧值（如“未命名文档”）以及中文 Slug 导致博客 URL 无法正常访问的 Bug，同时修复现存脏数据。

**Architecture:** 
1. 引入 `pypinyin` 将中文标题转换为纯 ASCII 拼音 Slug，防止网络/部署平台中文路由解析异常。
2. 每次发布 `publish_doc` 均使用当前标题生成最新 Slug，若与旧 `blogSlug` 不符则清除旧文章文件及 Git 索引。
3. 清理已有的脏数据：将 `dotBlog` 中的 `未命名文档.md` 重命名为 ASCII 拼音 Slug 并提交，修正 `doc-af8dc0f5.md` 的 `blogSlug`。

**Tech Stack:** Python 3.12, `uv`, `pypinyin`, `pytest`, Git.

## Global Constraints

- 使用 `uv` 管理依赖包
- 确保所有的 slug 均为纯小写 ASCII 字符，仅包含字母、数字及连字符 `-`
- 保持已有的代码风格与接口兼容

---

### Task 1: 安装依赖并升级 `PublishService` 的 `slugify` 与发布清理逻辑

**Files:**
- Modify: `pyproject.toml`
- Modify: `src/dotworkbench/services/publish_service.py`
- Modify: `tests/test_publish_service.py`

**Interfaces:**
- `PublishService.slugify(self, title: str) -> str`: 输入标题字符串，输出只包含 ASCII 小写字母、数字和 `-` 的 slug 字符串。
- `PublishService.publish_doc(self, doc_id: str) -> dict`: 始终重新计算最新 slug；如果与文档记录的原 `blogSlug` 不同，在 disk 和 git 中移除旧 slug 的文件。

- [ ] **Step 1: 安装 pypinyin 依赖**

Run:
```bash
uv add pypinyin
```
Expected: `pypinyin` 被加入 `pyproject.toml` 且成功安装在虚拟环境中。

- [ ] **Step 2: 在 `tests/test_publish_service.py` 中编写/更新 slugify 和发布旧文件清理的失败测试**

修改 `tests/test_publish_service.py`：
```python
def test_slugify_pinyin():
    publish_service = PublishService(blog_dir="/tmp/fake_blog")
    assert publish_service.slugify("达里奥说，我在开源模型上的姿势") == "da-li-ao-shuo-wo-zai-kai-yuan-mo-xing-shang-de-zi-shi"
    assert publish_service.slugify("Hello World 123!") == "hello-world-123"

@patch("subprocess.run")
def test_publish_doc_cleans_up_old_slug(mock_run, doc_service, tmp_path):
    fake_blog_dir = tmp_path / "dotBlog"
    fake_content_dir = fake_blog_dir / "src" / "content" / "blog"
    os.makedirs(fake_content_dir, exist_ok=True)
    
    mock_run.return_value = MagicMock(returncode=0, stdout="success", stderr="")
    
    # 模拟一个拥有旧 slug ("未命名文档") 的文档
    doc = doc_service.create_doc(title="旧标题")
    doc_service.update_doc(doc["id"], blogSlug="未命名文档", content="内容")
    
    # 提前在磁盘上创建一个旧 slug 文件
    old_file = fake_content_dir / "未命名文档.md"
    old_file.write_text("old content", encoding="utf-8")
    
    # 修改标题为最新标题并发布
    doc_service.update_doc(doc["id"], title="最新文章标题")
    
    publish_service = PublishService(blog_dir=str(fake_blog_dir), doc_service=doc_service)
    result = publish_service.publish_doc(doc["id"])
    
    assert result["success"] is True
    assert result["blogSlug"] == "zui-xin-wen-zhang-biao-ti"
    # 旧文件应该被删除
    assert not old_file.exists()
    # 新文件应该存在
    new_file = fake_content_dir / "zui-xin-wen-zhang-biao-ti.md"
    assert new_file.exists()
```

- [ ] **Step 3: 运行 pytest 确认测试失败**

Run:
```bash
uv run pytest tests/test_publish_service.py
```
Expected: FAIL (slug 结果不符合预期或旧文件未删除)。

- [ ] **Step 4: 实现 `PublishService` 中 `slugify` 和 `publish_doc` 的重构**

修改 `src/dotworkbench/services/publish_service.py`：
```python
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

    # generate_metadata 维持原样...

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
                    ["git", "rm", f"src/content/blog/{existing_slug}.md"],
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
```

- [ ] **Step 5: 运行 pytest 验证代码修复**

Run:
```bash
uv run pytest tests/test_publish_service.py
```
Expected: PASS 全部通过。

- [ ] **Step 6: 提交 代码修改**

Run:
```bash
git add pyproject.toml uv.lock src/dotworkbench/services/publish_service.py tests/test_publish_service.py
git commit -m "fix(publish): convert Chinese titles to pypinyin ASCII slugs and cleanup stale slug files on republish"
```

---

### Task 2: 清理博客与本地文档的现存脏数据

**Files:**
- Modify: `data/docs/doc-af8dc0f5.md:2`
- Move/Rename in git: `/home/ubuntu/projects/dotBlog/src/content/blog/未命名文档.md` -> `/home/ubuntu/projects/dotBlog/src/content/blog/da-li-ao-shuo-wo-zai-kai-yuan-mo-xing-shang-de-zi-shi.md`

- [ ] **Step 1: 在 `dotBlog` 仓库中进行 Git mv 与 Commit**

Run:
```bash
cd /home/ubuntu/projects/dotBlog
git mv "src/content/blog/未命名文档.md" "src/content/blog/da-li-ao-shuo-wo-zai-kai-yuan-mo-xing-shang-de-zi-shi.md"
git commit -m "fix: rename chinese slug file to ascii pinyin slug"
```
Expected: 文件重命名完成且已提交记录。

- [ ] **Step 2: 修改 `data/docs/doc-af8dc0f5.md` 中的 `blogSlug`**

修改 `data/docs/doc-af8dc0f5.md` 前几行：
```markdown
---
blogSlug: da-li-ao-shuo-wo-zai-kai-yuan-mo-xing-shang-de-zi-shi
createdAt: '2026-08-07T01:25:41.319913+00:00'
```

- [ ] **Step 3: 检查与验证完整系统单元测试**

Run:
```bash
cd /home/ubuntu/projects/dotWorkbench
uv run pytest
```
Expected: PASS 全部测试通过。

- [ ] **Step 4: 提交数据清理修改**

Run:
```bash
git add data/docs/doc-af8dc0f5.md
git commit -m "fix(data): update blogSlug for doc-af8dc0f5 to ascii pinyin"
```
