import { Component, lazy, Suspense, useEffect, useState, type PropsWithChildren } from 'react';
import { Alert, Spin } from 'antd';
import { KnowledgeMarkdown } from './KnowledgeMarkdown';
import { parseKnowledgeDocument } from '../lib/knowledgeDocument';

const KnowledgeWord = lazy(() => import('./KnowledgeWord').then(module => ({ default: module.KnowledgeWord })));
const KnowledgeSheet = lazy(() => import('./KnowledgeSheet').then(module => ({ default: module.KnowledgeSheet })));
const KnowledgeCanvas = lazy(() => import('./KnowledgeCanvas').then(module => ({ default: module.KnowledgeCanvas })));

class DocumentErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? <Alert type="error" showIcon title="文档编辑器加载失败，请刷新重试。原始内容未被修改，可通过导出备份。" /> : this.props.children;
  }
}

function FilePreview({ data, name, mime }: { data: string; name: string; mime: string }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const bytes = Uint8Array.from(atob(data.split(',')[1]), char => char.charCodeAt(0));
    const objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [data, mime]);
  return mime === 'application/pdf' ? <iframe className="knowledge-pdf" title={name} src={url} /> : <div className="knowledge-image"><img src={url} alt={name} /></div>;
}

export function KnowledgeDocumentView({ value, editing, preview, disabled, onChange, onSave }: {
  value: string; editing: boolean; preview: boolean; disabled: boolean; onChange: (value: string) => void; onSave: () => void;
}) {
  let document;
  try { document = parseKnowledgeDocument(value); }
  catch (error) { return <Alert type="error" showIcon title={error instanceof Error ? error.message : '文档解析失败'} />; }
  return <div className={`knowledge-document-frame document-${document.kind}`}>
    <div className="knowledge-document-body"><DocumentErrorBoundary><Suspense fallback={<div role="status" className="knowledge-loading"><Spin description="正在加载文档编辑器…" /></div>}>
    {document.kind === 'markdown' ? <KnowledgeMarkdown value={document.text} editing={editing} preview={preview} disabled={disabled} onChange={onChange} onSave={onSave} />
      : document.kind === 'word' ? <KnowledgeWord html={document.html} editing={editing && !preview} disabled={disabled} onChange={onChange} />
      : document.kind === 'sheet' ? <KnowledgeSheet document={document} editing={editing && !preview} disabled={disabled} onChange={onChange} />
      : document.kind === 'canvas' ? <KnowledgeCanvas document={document} editing={editing && !preview} disabled={disabled} onChange={onChange} />
      : <FilePreview {...document} />}
  </Suspense></DocumentErrorBoundary></div></div>;
}
