import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from '../src/context/AppContext';
import { DesignProvider } from '../src/components/DesignProvider';
import { KnowledgeDocumentView } from '../src/components/KnowledgeDocumentView';
import { createKnowledgeDocument, knowledgeSearchText, type DocumentKind } from '../src/lib/knowledgeDocument';
import '../src/index.css';

function Preview() {
  const [kind, setKind] = useState<DocumentKind>('word');
  const [value, setValue] = useState(createKnowledgeDocument('word'));
  const [saved, setSaved] = useState('');
  const [editing, setEditing] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [count, setCount] = useState(0);
  return <div className="homepage-shell theme-aurora style-light knowledge-workspace" style={{ height: '100dvh', display: 'flex', flexDirection: 'column' }}>
    <div style={{ padding: 12, display: 'flex', gap: 20 }}>
      {(['word', 'sheet', 'canvas', 'markdown'] as const).map(item => <button key={item} onClick={() => { setKind(item); setValue(createKnowledgeDocument(item)); setSaved(''); setEditing(true); setGeneration(previous => previous + 1); setCount(0); }}>{item}</button>)}
      <button onClick={() => setSaved(value)}>保存快照</button>
      <button onClick={() => { if (saved) { setValue(saved); setGeneration(previous => previous + 1); } }}>恢复快照</button>
      <button onClick={() => { setEditing(previous => !previous); setGeneration(previous => previous + 1); }}>切换阅读</button>
      <span role="status">变更 {count} 次</span>
      <span aria-label="文档文字">{knowledgeSearchText(value).slice(0, 120)}</span>
    </div>
    <div className="knowledge-document-area" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
      <KnowledgeDocumentView key={`${kind}_${generation}`} value={value} editing={editing} preview={false} disabled={false}
        onChange={next => { setValue(next); setCount(previous => previous + 1); }} onSave={() => setSaved(value)} />
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<AppProvider><BrowserRouter><DesignProvider><Preview /></DesignProvider></BrowserRouter></AppProvider>);
