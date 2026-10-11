import { useCallback, useRef } from 'react';
import type { Sheet } from '@fortune-sheet/core';
import { Workbook } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { serializeKnowledgeDocument, type KnowledgeDocument } from '../lib/knowledgeDocument';

export function KnowledgeSheet({ document, editing, disabled, onChange }: {
  document: Extract<KnowledgeDocument, { kind: 'sheet' }>; editing: boolean; disabled: boolean; onChange: (value: string) => void;
}) {
  const initial = useRef(structuredClone(document.sheets));
  const previous = useRef<string | null>(null);
  const handleChange = useCallback((sheets: Sheet[]) => {
    const value = serializeKnowledgeDocument({ kind: 'sheet', sheets });
    if (previous.current === null || !editing || disabled) { previous.current = value; return; }
    if (value === previous.current) return;
    previous.current = value;
    onChange(value);
  }, [editing, disabled, onChange]);
  return <div className="knowledge-sheet">
    <Workbook data={initial.current} lang="zh" allowEdit={editing && !disabled} showToolbar={editing} showFormulaBar
      onChange={handleChange} />
  </div>;
}
