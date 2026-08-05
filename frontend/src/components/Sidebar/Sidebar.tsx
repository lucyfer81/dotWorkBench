import React from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';

export interface DocItem {
  id: string;
  title: string;
  parentId?: string;
  icon?: string;
}

interface SidebarProps {
  docs: DocItem[];
  currentDocId: string | null;
  onSelectDoc: (id: string) => void;
  onCreateDoc: () => void;
  onDeleteDoc: (id: string, e: React.MouseEvent) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  docs,
  currentDocId,
  onSelectDoc,
  onCreateDoc,
  onDeleteDoc,
}) => {
  return (
    <div style={{
      width: '260px',
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
      
      <div style={{ padding: '0 12px 12px 12px' }}>
        <button
          onClick={onCreateDoc}
          style={{
            width: '100%',
            padding: '8px 12px',
            backgroundColor: 'var(--affine-brand-color)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            fontWeight: 500
          }}
        >
          <Plus size={16} /> 新建笔记
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {docs.map((doc) => (
          <div
            key={doc.id}
            onClick={() => onSelectDoc(doc.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              marginBottom: '4px',
              backgroundColor: currentDocId === doc.id ? 'var(--affine-background-hover)' : 'transparent',
              color: 'var(--affine-text-primary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
              <FileText size={16} color="var(--affine-text-secondary)" />
              <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {doc.title || '未命名文档'}
              </span>
            </div>
            <button
              onClick={(e) => onDeleteDoc(doc.id, e)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', opacity: 0.6 }}
              title="删除文档"
            >
              <Trash2 size={14} color="var(--affine-text-secondary)" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
