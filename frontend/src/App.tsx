import React, { useState, useEffect } from 'react';
import './styles/affine-theme.css';
import { Sidebar, NodeItem } from './components/Sidebar/Sidebar';
import { DocHeader } from './components/Header/DocHeader';
import { VditorEditor } from './components/Editor/VditorEditor';
import { AIPanel } from './components/AIPanel/AIPanel';

export interface DocDetail {
  id: string;
  title: string;
  content: string;
  icon?: string;
  published?: boolean;
  blogSlug?: string;
  publishedAt?: string;
}

export const App: React.FC = () => {
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentDoc, setCurrentDoc] = useState<DocDetail | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/nodes');
      if (res.ok) {
        const data: NodeItem[] = await res.json();
        setNodes(data);
        setCurrentDocId(prevId => {
          if (!prevId && data.length > 0) {
            const firstDoc = data.find((n: NodeItem) => n.type === 'doc');
            return firstDoc ? firstDoc.id : null;
          }
          if (prevId && !data.some((n: NodeItem) => n.id === prevId)) {
            setCurrentDoc(null);
            return null;
          }
          return prevId;
        });
      }
    } catch (e) {
      console.error('Failed to fetch nodes', e);
    }
  };

  useEffect(() => {
    fetchNodes();
  }, []);

  useEffect(() => {
    if (currentDocId) {
      fetch(`/api/docs/${currentDocId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data) setCurrentDoc(data);
        })
        .catch(console.error);
    } else {
      setCurrentDoc(null);
    }
  }, [currentDocId]);

  const handleCreateDoc = async (parentId?: string) => {
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '未命名文档', parentId })
      });
      if (res.ok) {
        const newDoc = await res.json();
        setNodes(prev => [...prev, { ...newDoc, type: 'doc' }]);
        setCurrentDocId(newDoc.id);
        fetchNodes();
        return newDoc.id as string;
      }
    } catch (e) {
      console.error('Failed to create doc', e);
    }
  };

  const handleCreateFolder = async (parentId?: string) => {
    try {
      const res = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新建文件夹', parentId })
      });
      if (res.ok) {
        const newFolder = await res.json();
        setNodes(prev => [...prev, { ...newFolder, type: 'folder' }]);
        fetchNodes();
        return newFolder.id as string;
      }
    } catch (e) {
      console.error('Failed to create folder', e);
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('确定要删除该文档吗？')) return;
    try {
      const res = await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentDocId === id) setCurrentDocId(null);
        fetchNodes();
      }
    } catch (e) {
      console.error('Failed to delete doc', e);
    }
  };

  const handleDeleteFolder = async (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定要删除文件夹“${title || '未命名文件夹'}”及其内部包含的全部子内容吗？此操作不可撤销。`)) return;
    try {
      const res = await fetch(`/api/folders/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchNodes();
      }
    } catch (e) {
      console.error('Failed to delete folder', e);
    }
  };

  const handleRenameNode = async (id: string, type: 'folder' | 'doc', newTitle: string) => {
    // Optimistically update nodes in local state
    setNodes(prev => prev.map(n => n.id === id ? { ...n, title: newTitle } : n));
    if (type === 'doc' && currentDocId === id && currentDoc) {
      setCurrentDoc(prev => prev ? { ...prev, title: newTitle } : null);
    }
    try {
      const endpoint = type === 'folder' ? `/api/folders/${id}` : `/api/docs/${id}`;
      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      if (res.ok) {
        fetchNodes();
      }
    } catch (e) {
      console.error('Failed to rename node', e);
    }
  };

  const handleContentChange = async (content: string) => {
    if (!currentDocId || !currentDoc) return;
    try {
      const res = await fetch(`/api/docs/${currentDocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: currentDoc.title, content })
      });
      if (res.ok) {
        setCurrentDoc(prev => prev ? { ...prev, content } : null);
      }
    } catch (e) {
      console.error('Failed to update doc', e);
    }
  };

  const handleInsertToEditor = (text: string) => {
    if (currentDoc) {
      const updated = (currentDoc.content || '') + '\n\n' + text;
      handleContentChange(updated);
    }
  };

  return (
    <div className="affine-app-container">
      <Sidebar
        nodes={nodes}
        currentDocId={currentDocId}
        onSelectDoc={setCurrentDocId}
        onCreateDoc={handleCreateDoc}
        onCreateFolder={handleCreateFolder}
        onDeleteDoc={handleDeleteDoc}
        onDeleteFolder={handleDeleteFolder}
        onRenameNode={handleRenameNode}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
        {currentDocId && currentDoc ? (
          <>
            <DocHeader
              docId={currentDocId}
              docTitle={currentDoc.title || ''}
              published={currentDoc.published}
              publishedAt={currentDoc.publishedAt}
              onPublished={fetchNodes}
            />
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <VditorEditor
                value={currentDoc.content || ''}
                onChange={handleContentChange}
                onSelectText={setSelectedText}
              />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--affine-text-secondary)' }}>
            请选择或新建一篇笔记开始编辑
          </div>
        )}
      </div>
      <AIPanel selectedText={selectedText} onInsertToEditor={handleInsertToEditor} />
    </div>
  );
};

export default App;
