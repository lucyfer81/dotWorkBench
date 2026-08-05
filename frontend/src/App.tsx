import React, { useEffect, useState } from 'react';
import './styles/affine-theme.css';
import { Sidebar, DocItem } from './components/Sidebar/Sidebar';
import { VditorEditor } from './components/Editor/VditorEditor';
import { AIPanel } from './components/AIPanel/AIPanel';

export const App: React.FC = () => {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [currentDocId, setCurrentDocId] = useState<string | null>(null);
  const [currentContent, setCurrentContent] = useState<string>('');
  const [selectedText, setSelectedText] = useState<string>('');

  const fetchDocs = async () => {
    try {
      const res = await fetch('/api/docs');
      const data = await res.json();
      setDocs(data);
      if (data.length > 0 && !currentDocId) {
        loadDoc(data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadDoc = async (id: string) => {
    setCurrentDocId(id);
    try {
      const res = await fetch(`/api/docs/${id}`);
      const data = await res.json();
      setCurrentContent(data.content || '');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateDoc = async () => {
    try {
      const res = await fetch('/api/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: '新笔记' }),
      });
      const newDoc = await res.json();
      await fetchDocs();
      loadDoc(newDoc.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteDoc = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/docs/${id}`, { method: 'DELETE' });
      await fetchDocs();
      if (currentDocId === id) {
        setCurrentDocId(null);
        setCurrentContent('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleContentChange = async (val: string) => {
    setCurrentContent(val);
    if (currentDocId) {
      fetch(`/api/docs/${currentDocId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: val }),
      }).catch(console.error);
    }
  };

  const handleInsertToEditor = (text: string) => {
    setCurrentContent((prev) => prev + '\n\n' + text);
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  return (
    <div className="affine-app-container">
      <Sidebar
        docs={docs}
        currentDocId={currentDocId}
        onSelectDoc={loadDoc}
        onCreateDoc={handleCreateDoc}
        onDeleteDoc={handleDeleteDoc}
      />
      <div style={{ flex: 1, height: '100%', overflowY: 'auto' }}>
        {currentDocId ? (
          <VditorEditor
            value={currentContent}
            onChange={handleContentChange}
            onSelectText={setSelectedText}
          />
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
