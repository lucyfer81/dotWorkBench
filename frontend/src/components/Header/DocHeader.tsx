import React, { useState } from 'react';
import './doc-header.css';

interface DocHeaderProps {
  docId: string | null;
  docTitle: string;
  published?: boolean;
  publishedAt?: string;
  onPublished?: () => void;
}

export const DocHeader: React.FC<DocHeaderProps> = ({ docId, docTitle, published, publishedAt, onPublished }) => {
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const handlePublish = async () => {
    if (!docId) return;
    setPublishing(true);
    try {
      const res = await fetch(`/api/docs/${docId}/publish`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', '🎉 发布成功！已推送至 GitHub，Cloudflare 正在自动部署');
        if (onPublished) onPublished();
      } else {
        showToast('error', `❌ 发布失败: ${data.detail || data.message || '未知错误'}`);
      }
    } catch (e: any) {
      showToast('error', `❌ 发布网络请求失败: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="doc-header">
      <div className="doc-header-title">
        {docTitle || '未命名文档'}
        {published ? (
          <span className="publish-badge published">
            已发布 {publishedAt ? new Date(publishedAt).toLocaleDateString() : ''}
          </span>
        ) : (
          <span className="publish-badge unpublished">
            未发布
          </span>
        )}
      </div>
      <div className="doc-header-actions">
        {docId && (
          <button
            className="publish-btn"
            onClick={handlePublish}
            disabled={publishing}
          >
            {publishing ? '✨ AI 分析与 Git 推送中...' : '🚀 发布到博客'}
          </button>
        )}
      </div>

      {toast && (
        <div className={`toast-msg toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};
