import { useEffect } from 'react';
import { Button } from 'antd';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TableKit } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import DOMPurify from 'dompurify';
import { serializeKnowledgeDocument } from '../lib/knowledgeDocument';

export function KnowledgeWord({ html, editing, disabled, onChange }: {
  html: string; editing: boolean; disabled: boolean; onChange: (value: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit, TableKit.configure({ table: { resizable: true } }), Image.configure({ allowBase64: true })],
    content: DOMPurify.sanitize(html), editable: editing && !disabled, shouldRerenderOnTransaction: true,
    editorProps: { attributes: { 'aria-label': 'Word 文档内容', class: 'knowledge-word-content' } },
    onUpdate: ({ editor }) => onChange(serializeKnowledgeDocument({ kind: 'word', html: editor.getHTML() })),
  });
  useEffect(() => { editor?.setEditable(editing && !disabled); }, [editor, editing, disabled]);
  if (!editor) return null;
  const buttons = [
    { label: '正文', run: () => editor.chain().focus().setParagraph().run(), active: editor.isActive('paragraph') },
    { label: '标题一', run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(), active: editor.isActive('heading', { level: 1 }) },
    { label: '标题二', run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive('heading', { level: 2 }) },
    { label: '粗体', run: () => editor.chain().focus().toggleBold().run(), active: editor.isActive('bold') },
    { label: '斜体', run: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive('italic') },
    { label: '下划线', run: () => editor.chain().focus().toggleUnderline().run(), active: editor.isActive('underline') },
    { label: '无序列表', run: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive('bulletList') },
    { label: '有序列表', run: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive('orderedList') },
    { label: '引用', run: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive('blockquote') },
    { label: '插入表格', run: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: '撤销', run: () => editor.chain().focus().undo().run() },
    { label: '重做', run: () => editor.chain().focus().redo().run() },
  ];
  return <div className={`knowledge-word${editing ? ' is-editing' : ''}${editor.isEmpty ? ' is-empty' : ''}`}>
    {editing && <div className="knowledge-word-toolbar" role="toolbar" aria-label="文档格式">
      {buttons.map(button => <Button key={button.label} type={button.active ? 'primary' : 'text'} size="small" htmlType="button" disabled={disabled} aria-pressed={Boolean(button.active)} onClick={button.run}>{button.label}</Button>)}
    </div>}
    <div className="knowledge-word-stage">
      <div className="knowledge-word-page-label">{editing ? '正文编辑区 · 点击纸张输入' : '文档正文'}</div>
      <EditorContent editor={editor} className="knowledge-word-editor" />
    </div>
  </div>;
}
