import { useRef } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import { serializeKnowledgeDocument, type KnowledgeDocument } from '../lib/knowledgeDocument';

type CanvasDocument = Extract<KnowledgeDocument, { kind: 'canvas' }>;

Object.assign(window, { EXCALIDRAW_ASSET_PATH: new URL('/excalidraw-assets/', window.location.origin).href });

export function KnowledgeCanvas({ document, editing, disabled, onChange }: {
  document: CanvasDocument; editing: boolean; disabled: boolean; onChange: (value: string) => void;
}) {
  const initial = useRef(document.scene);
  const last = useRef(JSON.stringify(initial.current));
  return <div className="knowledge-canvas">
    <Excalidraw initialData={initial.current} langCode="zh-CN" viewModeEnabled={!editing || disabled}
      validateEmbeddable={false} UIOptions={{ canvasActions: { loadScene: editing && !disabled, saveToActiveFile: false, export: { saveFileToDisk: true }, toggleTheme: false } }}
      onChange={(elements, appState, files) => {
        if (!editing || disabled) return;
        const scene = { elements: [...elements], appState: { viewBackgroundColor: appState.viewBackgroundColor }, files };
        const next = JSON.stringify(scene);
        if (next === last.current) return;
        last.current = next;
        onChange(serializeKnowledgeDocument({ kind: 'canvas', scene }));
      }} />
  </div>;
}
