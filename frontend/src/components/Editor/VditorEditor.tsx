import React, { useEffect, useRef } from 'react';
import Vditor from 'vditor';
import 'vditor/dist/index.css';
import './vditor-affine.css';

interface VditorEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSelectText?: (text: string) => void;
}

export const VditorEditor: React.FC<VditorEditorProps> = ({ value, onChange, onSelectText }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const vditorInstance = useRef<Vditor | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    const vditor = new Vditor(editorRef.current, {
      height: '100%',
      mode: 'wysiwyg', // 锁定在所见即所得模式
      toolbarConfig: {
        hide: false,
        pin: true,
      },
      cache: {
        enable: false,
      },
      preview: {
        actions: [],
      },
      hint: {
        parse: true,
        extend: [
          {
            key: '/h1',
            hint: () => [
              {
                value: '# ',
                html: '<b># 一级标题</b> (H1)',
              },
            ],
          },
          {
            key: '/h2',
            hint: () => [
              {
                value: '## ',
                html: '<b>## 二级标题</b> (H2)',
              },
            ],
          },
          {
            key: '/todo',
            hint: () => [
              {
                value: '* [ ] ',
                html: '<b>* [ ] 待办事项</b> (Todo List)',
              },
            ],
          },
          {
            key: '/code',
            hint: () => [
              {
                value: '```\n\n```',
                html: '<b>``` 代码块</b> (Code Block)',
              },
            ],
          },
          {
            key: '/ai',
            hint: () => [
              {
                value: '',
                html: '<b>✨ 呼叫 AI 助手</b>',
              },
            ],
          },
        ],
      },
      input: (val) => {
        onChange(val);
      },
      after: () => {
        vditor.setValue(value);
        vditorInstance.current = vditor;
      },
    });

    return () => {
      try {
        vditor.destroy();
      } catch (e) {
        // ignore unmount errors
      }
    };
  }, []);

  // Sync content when switching document
  useEffect(() => {
    if (vditorInstance.current && value !== vditorInstance.current.getValue()) {
      vditorInstance.current.setValue(value);
    }
  }, [value]);

  const handleMouseUp = () => {
    if (onSelectText) {
      const selected = window.getSelection()?.toString() || '';
      if (selected.trim().length > 0) {
        onSelectText(selected);
      }
    }
  };

  return (
    <div className="vditor-affine-wrapper" onMouseUp={handleMouseUp}>
      <div ref={editorRef} style={{ minHeight: '500px' }} />
    </div>
  );
};
