# dotWorkbench 文件夹功能设计规范 (Folder Feature Design Spec)

## 1. 概述 (Overview)
本文档规范了 dotWorkbench 项目中“显式文件夹 (Explicit Folders)”功能的架构与实现细节。该功能为工作台提供多层级树形目录组织能力，支持文件夹创建、展开/折叠、重命名以及级联删除。

---

## 2. 数据模型与存储设计 (Data Model & Storage)

### 2.1 统一节点数据结构 (Node Model)
工作台中的文档和文件夹统一建模为节点 (Node)：

```typescript
interface NodeItem {
  id: string;             // 节点唯一标识: "folder-xxx" 或 "doc-xxx"
  type: 'folder' | 'doc'; // 节点类型
  title: string;          // 节点名称/标题
  parentId: string | null;// 父文件夹 ID，根节点为 null
  icon?: string;          // 图标，文件夹默认为 "📁"，文档默认为 "📝"
  createdAt: string;      // 创建时间 (ISO8601)
  updatedAt: string;      // 更新时间 (ISO8601)
  content?: string;       // 仅 doc 包含正文内容
}
```

### 2.2 存储方案 (Storage Architecture)
* **文档 (Doc)**：存储在 `data/docs/{doc_id}.md`。使用 frontmatter 存储元数据，包含 `id`, `type: "doc"`, `title`, `parentId`, `icon`, `createdAt`, `updatedAt`。
* **文件夹 (Folder)**：存储在 `data/folders/{folder_id}.json`。JSON 内容格式：
  ```json
  {
    "id": "folder-a1b2c3d4",
    "type": "folder",
    "title": "项目文档",
    "parentId": null,
    "icon": "📁",
    "createdAt": "2026-08-06T20:30:00Z",
    "updatedAt": "2026-08-06T20:30:00Z"
  }
  ```

---

## 3. 后端服务与 API 接口规范 (Backend APIs & Services)

### 3.1 服务架构 (Service Layer)
* 新增 `FolderService` (`src/dotworkbench/services/folder_service.py`) 负责处理文件夹的 CRUD 操作与级联删除算法。
* 扩展 `DocService` (`src/dotworkbench/services/doc_service.py`)，确保 `list_docs()` 返回 `type: "doc"`，并支持处理 `parentId` 变更。

### 3.2 级联删除算法 (Recursive Cascade Delete)
当请求删除文件夹 `folder_id` 时：
1. 读取所有文件夹 JSON 和所有文档 Markdown 的 `id` 与 `parentId` 形成全量关系映射。
2. 以 `folder_id` 为根节点，使用递归/深度优先搜索 (DFS) 收集其下所有的子文件夹 ID 列表与子文档 ID 列表。
3. 删除收集到的所有子文档 `.md` 文件。
4. 删除收集到的所有子文件夹 `.json` 文件。
5. 最后删除目标文件夹 `data/folders/{folder_id}.json`。

### 3.3 循环嵌套防错 (Cycle Protection)
修改文件夹 `parentId` 时，校验新 `parentId` 是否在目标文件夹的子孙节点列表中。若存在，拒绝修改并抛出错误（HTTP 400）。

### 3.4 API 路由定义 (REST API Routes)
| HTTP Method | Endpoint | 说明 |
| :--- | :--- | :--- |
| `GET` | `/api/nodes` | 获取所有节点元数据列表（文档 + 文件夹） |
| `POST` | `/api/folders` | 创建新文件夹 `{ title, parentId? }` |
| `PUT` | `/api/folders/{folder_id}` | 更新文件夹 `{ title?, parentId? }` |
| `DELETE` | `/api/folders/{folder_id}` | 级联删除文件夹及其全部内容 |
| `POST` | `/api/docs` | 创建文档，支持传入 `parentId` |
| `PUT` | `/api/docs/{doc_id}` | 更新文档，支持更新 `parentId` |

---

## 4. 前端侧边栏 Tree UI 设计 (Frontend Sidebar Tree UI)

### 4.1 组件结构 (Components)
* **`Sidebar`**：包含顶部系统 Title、根目录新建按钮组（`新建笔记`、`新建文件夹`）、以及 `SidebarTree`。
* **`SidebarTree`**：将后端返回的扁平 `NodeItem[]` 转换为层级树结构 `TreeNode[]` 并进行渲染。
* **`TreeItem`**：递归组件，负责单独渲染节点。
  * **文件夹**：展示折叠/展开箭头（▶/▼）、📁 图标、文件夹名、快捷操作菜单（新建子文档、新建子文件夹、重命名、级联删除）。
  * **文档**：展示 📝 图标、文档标题、删除按钮。

### 4.2 状态管理 (State Management)
* `expandedFolderIds`: `Set<string>` - 记录已展开的文件夹 ID 集合。
* `editingNodeId`: `string | null` - 记录当前正处于重命名行内输入状态的节点 ID。

---

## 5. 测试与验证计划 (Testing & Verification)
1. **单元测试与集成测试 (`tests/test_folders.py`)**：
   * 验证文件夹创建、读取、更新 API。
   * 验证嵌套多层文件夹与文档时的级联删除逻辑是否干净利落，无死锁或残留文件。
   * 验证跨文件夹移动时的防循环嵌套逻辑。
2. **前端与 API 端到端验证**：
   * 启动 FastAPI 与 Frontend，验证侧边栏树形结构的展示、折叠展开、行内重命名与级联删除确认框。
