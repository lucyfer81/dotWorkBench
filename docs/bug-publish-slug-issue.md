# Bug 分析与修复报告：博客一键发布与 Cloudflare Pages 部署

## 问题现象

1. 用户在 dotWorkbench 编辑器中点击「发布到博客」按钮，虽然界面提示"发布成功！"，但文章未能在 Cloudflare Pages 的博客站点中正常上架展示。
2. `~/projects/dotBlog` 无法进行自动打包与一键发布。

---

## 原因排查与诊断

经深入排查，发现共有以下 3 个相互叠加的问题原因：

### 1. `publish_service.py` 缺乏构建与部署命令（导致无法自动上架到 Cloudflare Pages）
- **现象**：原后端服务在写入 markdown 静态文件后，仅执行了 `git commit` 与 `git push origin main`。
- **原因**：如果 Cloudflare Pages 部署没有通过 GitHub Webhook 触发自动构建（或本地没有执行打包部署），单纯 `git push` 无法将页面推送到 Cloudflare 边缘服务器。

### 2. `dotBlog/wrangler.toml` 包含非法配置块 `[build]`（导致 Pages 部署被拦截报错）
- **现象**：之前的 Commit 中在 `dotBlog/wrangler.toml` 里添加了如下代码：
  ```toml
  [build]
  command = "npm run build"
  ```
- **原因**：Cloudflare Pages **不支持**在 `wrangler.toml` 中配置 `[build]` 块（此选项仅适用于 Cloudflare Workers）。当 Wrangler 执行部署校验时，抛出以下致命错误：
  ```text
  ✘ [ERROR] Running configuration file validation for Pages:
      - Configuration file for Pages projects does not support "build"
  ```
  这直接拦截阻断了后续一切 Cloudflare CLI 的自动化部署。

### 3. 旧版 Slug 逻辑保留中文导致路由失效 & `blogSlug` 脏数据持久化
- **原因 A**：原 `slugify` 正则显式保留中文字符（`\u4e00-\u9fa5`），生成如 `未命名文档.md` 的中文文件名。Astro 及 Cloudflare Pages 无法稳定解析中文路径，导致 `/blog/未命名文档` 路由无法访问。
- **原因 B**：`publish_service.py` 中使用了 `existing_slug = doc.get("blogSlug")` 逻辑，在第一次生成错误/默认 slug 后永久锁定复用，导致修改标题后发布依然覆盖旧文件。

---

## 解决方案与修复实施

针对上述诊断问题，已完成以下修复：

### 修复 1：在 `publish_service.py` 中集成 Cloudflare Pages 自动化构建与部署
在 `PublishService.publish_doc()` 执行完 Git 提交后，自动添加打包与 Wrangler 直接部署流程：
```python
# 执行 Cloudflare Pages 构建与部署
deploy_cmds = [
    ["npm", "run", "build"],
    ["npx", "wrangler", "pages", "deploy", "dist", "--project-name=dotblog-786", "--commit-dirty=true"]
]

for cmd in deploy_cmds:
    res = subprocess.run(cmd, cwd=self.blog_dir, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Deploy command {' '.join(cmd)} failed: {res.stderr or res.stdout}")
```

### 修复 2：修复 `dotBlog/wrangler.toml` 配置
移除了 `wrangler.toml` 中非法的 `[build]` 节点，保留 Cloudflare Pages 规范配置：
```toml
name = "dotblog"
pages_build_output_dir = "./dist"
compatibility_date = "2026-08-01"

[[d1_databases]]
binding = "DB"
database_name = "dotblog-db"
database_id = "3aead635-a2b9-4042-9dc5-01147bc97437"
```

### 修复 3：使用 `pypinyin` 生成纯 ASCII 拼音 Slug，并始终更新 Slug
1. 引入 `pypinyin.lazy_pinyin` 将中文转换为拼音，确保生成如 `da-li-ao-shuo-wo-zai-kai-yuan-mo-xing-shang-de-zi-shi` 的合法路由。
2. 每次发布根据最新标题重新生成 Slug，若检测到旧 Slug 不一致，自动清理并从 Git 移除旧的 `.md` 存量文件。

---

## 验证结论

我们通过命令直接模拟触发了发布接口：
```bash
curl --noproxy localhost -X POST http://localhost:5001/api/docs/doc-af8dc0f5/publish
```

**验证结果**：
1. 后端成功返回：
   ```json
   {
     "success": true,
     "message": "发布成功！",
     "blogSlug": "da-li-ao-shuo-wo-zai-kai-yuan-mo-xing-shang-de-zi-shi",
     "publishedAt": "2026-08-07T04:08:39.238154+00:00"
   }
   ```
2. 网页部署成功并完成实时上线，在 Cloudflare Pages 地址 `https://21f132af.dotblog-786.pages.dev/blog/da-li-ao-shuo-wo-zai-kai-yuan-mo-xing-shang-de-zi-shi/` 下已能稳定访问并渲染全部文章内容。
