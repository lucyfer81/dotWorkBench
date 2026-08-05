import React, { useState } from 'react';
import { Sparkles, Send, ArrowRightToLine } from 'lucide-react';

interface AIPanelProps {
  selectedText: string;
  onInsertToEditor: (text: string) => void;
}

export const AIPanel: React.FC<AIPanelProps> = ({ selectedText, onInsertToEditor }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'ai'; text: string }>>([
    { sender: 'ai', text: '你好！我是你的 AI 工作台助手。选中编辑器中的文本或直接在下方输入对话指令。' },
  ]);

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setMessages((prev) => [...prev, { sender: 'user', text: userMsg }]);
    setInput('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, context: selectedText }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { sender: 'ai', text: data.reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { sender: 'ai', text: '请求 AI 服务出现错误。' }]);
    }
  };

  return (
    <div style={{
      width: '320px',
      backgroundColor: 'var(--affine-background-secondary)',
      borderLeft: '1px solid var(--affine-border-color)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--affine-border-color)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Sparkles size={18} color="var(--affine-brand-color)" /> AI 助手 Copilot
      </div>

      <div style={{ flex: 1, padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {selectedText && (
          <div style={{ padding: '8px 12px', backgroundColor: 'var(--affine-background-hover)', borderRadius: '6px', fontSize: '12px' }}>
            <strong>当前划词:</strong> "{selectedText.slice(0, 40)}..."
          </div>
        )}
        {messages.map((m, idx) => (
          <div key={idx} style={{
            alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start',
            backgroundColor: m.sender === 'user' ? 'var(--affine-brand-color)' : 'var(--affine-background-primary)',
            color: m.sender === 'user' ? '#fff' : 'var(--affine-text-primary)',
            padding: '10px 12px',
            borderRadius: '8px',
            fontSize: '13px',
            maxWidth: '85%',
            boxShadow: 'var(--affine-shadow-card)'
          }}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>
            {m.sender === 'ai' && idx > 0 && (
              <button
                onClick={() => onInsertToEditor(m.text)}
                style={{
                  marginTop: '8px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  backgroundColor: 'var(--affine-background-hover)',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <ArrowRightToLine size={12} /> 插入到编辑器
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '12px', borderTop: '1px solid var(--affine-border-color)', display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="问问 AI 助手..."
          style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--affine-border-color)', outline: 'none' }}
        />
        <button onClick={handleSend} style={{ border: 'none', backgroundColor: 'var(--affine-brand-color)', color: '#fff', borderRadius: '6px', padding: '8px 12px', cursor: 'pointer' }}>
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};
