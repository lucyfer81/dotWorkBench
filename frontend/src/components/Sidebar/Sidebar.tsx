import React, { useState } from 'react';
import { FileText, Folder, FolderOpen, Plus, Trash2, ChevronRight, ChevronDown, Edit2 } from 'lucide-react';

export interface NodeItem {
  id: string;
  type: 'folder' | 'doc';
  title: string;
  parentId?: string | null;
  icon?: string;
  published?: boolean;
}

export interface TreeNode extends NodeItem {
  children?: TreeNode[];
}

interface SidebarProps {
  nodes: NodeItem[];
  currentDocId: string | null;
  onSelectDoc: (id: string) => void;
  onCreateDoc: (parentId?: string) => Promise<string | undefined>;
  onCreateFolder: (parentId?: string) => Promise<string | undefined>;
  onDeleteDoc: (id: string, e: React.MouseEvent) => void;
  onDeleteFolder: (id: string, title: string, e: React.MouseEvent) => void;
  onRenameNode: (id: string, type: 'folder' | 'doc', newTitle: string) => void;
}

// Build hierarchical tree from flat node array
const buildTree = (nodes: NodeItem[]): TreeNode[] => {
  const nodeMap = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  nodes.forEach(node => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  nodes.forEach(node => {
    const treeNode = nodeMap.get(node.id)!;
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children!.push(treeNode);
    } else {
      roots.push(treeNode);
    }
  });

  return roots;
};

export const Sidebar: React.FC<SidebarProps> = ({
  nodes,
  currentDocId,
  onSelectDoc,
  onCreateDoc,
  onCreateFolder,
  onDeleteDoc,
  onDeleteFolder,
  onRenameNode,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleStartRename = (node: NodeItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(node.id);
    setEditingTitle(node.title || '');
  };

  const handleSaveRename = (node: NodeItem) => {
    if (editingTitle.trim() && editingTitle !== node.title) {
      onRenameNode(node.id, node.type, editingTitle.trim());
    }
    setEditingId(null);
  };

  const tree = buildTree(nodes);

  const renderTreeItem = (node: TreeNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedIds.has(node.id);
    const isSelected = currentDocId === node.id;
    const isEditing = editingId === node.id;

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          onClick={() => {
            if (isFolder) {
              setExpandedIds(prev => {
                const next = new Set(prev);
                if (next.has(node.id)) next.delete(node.id);
                else next.add(node.id);
                return next;
              });
            } else {
              onSelectDoc(node.id);
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            paddingLeft: `${8 + depth * 16}px`,
            borderRadius: '6px',
            cursor: 'pointer',
            marginBottom: '2px',
            backgroundColor: isSelected ? 'var(--affine-background-hover)' : 'transparent',
            color: 'var(--affine-text-primary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
            {isFolder ? (
              <span onClick={(e) => toggleExpand(node.id, e)} style={{ display: 'flex', alignItems: 'center', padding: '2px' }}>
                {isExpanded ? <ChevronDown size={14} color="var(--affine-text-secondary)" /> : <ChevronRight size={14} color="var(--affine-text-secondary)" />}
              </span>
            ) : (
              <span style={{ width: '14px' }} />
            )}

            {isFolder ? (
              isExpanded ? <FolderOpen size={16} color="var(--affine-brand-color)" /> : <Folder size={16} color="var(--affine-brand-color)" />
            ) : (
              <FileText size={16} color="var(--affine-text-secondary)" />
            )}

            {isEditing ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSaveRename(node);
                }}
                style={{ display: 'inline-flex', flex: 1, margin: 0 }}
              >
                <input
                  type="text"
                  value={editingTitle}
                  onChange={e => setEditingTitle(e.target.value)}
                  onBlur={() => handleSaveRename(node)}
                  autoFocus
                  onFocus={e => e.target.select()}
                  onClick={e => e.stopPropagation()}
                  style={{
                    fontSize: '13px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--affine-brand-color)',
                    outline: 'none',
                    width: '90%',
                    backgroundColor: 'var(--affine-background-primary)',
                    color: 'var(--affine-text-primary)'
                  }}
                />
              </form>
            ) : (
              <span
                onDoubleClick={(e) => handleStartRename(node, e)}
                title="双击进行重命名"
                style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
              >
                {node.title || (isFolder ? '未命名文件夹' : '未命名文档')}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {isFolder && (
              <>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newId = await onCreateDoc(node.id);
                    setExpandedIds(prev => new Set(prev).add(node.id));
                    if (newId) {
                      setEditingId(newId);
                      setEditingTitle('未命名文档');
                    }
                  }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.7 }}
                  title="在文件夹内新建文档"
                >
                  <Plus size={14} color="var(--affine-text-secondary)" />
                </button>
                <button
                  onClick={async (e) => {
                    e.stopPropagation();
                    const newId = await onCreateFolder(node.id);
                    setExpandedIds(prev => new Set(prev).add(node.id));
                    if (newId) {
                      setEditingId(newId);
                      setEditingTitle('新建文件夹');
                    }
                  }}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.7 }}
                  title="在文件夹内新建子文件夹"
                >
                  <Folder size={14} color="var(--affine-text-secondary)" />
                </button>
              </>
            )}

            <button
              onClick={(e) => handleStartRename(node, e)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.8 }}
              title="重命名 (也可直接双击名称)"
            >
              <Edit2 size={13} color="var(--affine-text-secondary)" />
            </button>

            <button
              onClick={(e) => isFolder ? onDeleteFolder(node.id, node.title, e) : onDeleteDoc(node.id, e)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
              title={isFolder ? "删除文件夹" : "删除文档"}
            >
              <Trash2 size={13} color="var(--affine-text-secondary)" />
            </button>
          </div>
        </div>

        {isFolder && isExpanded && node.children && node.children.length > 0 && (
          <div>
            {node.children.map(child => renderTreeItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{
      width: '280px',
      backgroundColor: 'var(--affine-background-sidebar)',
      borderRight: '1px solid var(--affine-border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      userSelect: 'none'
    }}>
      <div style={{ padding: '16px', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>🎨</span> dotWorkbench
      </div>
      
      <div style={{ padding: '0 12px 12px 12px', display: 'flex', gap: '8px' }}>
        <button
          onClick={async () => {
            const newId = await onCreateDoc();
            if (newId) {
              setEditingId(newId);
              setEditingTitle('未命名文档');
            }
          }}
          style={{
            flex: 1,
            padding: '8px 10px',
            backgroundColor: 'var(--affine-brand-color)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: 500
          }}
        >
          <Plus size={15} /> 新建文档
        </button>
        <button
          onClick={async () => {
            const newId = await onCreateFolder();
            if (newId) {
              setEditingId(newId);
              setEditingTitle('新建文件夹');
            }
          }}
          style={{
            padding: '8px 10px',
            backgroundColor: 'transparent',
            color: 'var(--affine-text-primary)',
            border: '1px solid var(--affine-border-color)',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: 500
          }}
          title="在根目录新建文件夹"
        >
          <Folder size={15} /> 新建文件夹
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {tree.map(node => renderTreeItem(node, 0))}
      </div>
    </div>
  );
};
