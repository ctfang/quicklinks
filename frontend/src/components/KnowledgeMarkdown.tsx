import { useEffect, useRef, useState } from 'react';
import MDEditor, { commands } from '@uiw/react-md-editor';
import rehypeSanitize from 'rehype-sanitize';
import { useAppContext } from '../context/AppContext';
import { useNavigationAppearance } from '../lib/navigationAppearance';

const labels: Record<string, string> = {
  bold: '粗体', italic: '斜体', strikethrough: '删除线', title: '标题',
  title1: '一级标题', title2: '二级标题', title3: '三级标题', title4: '四级标题', title5: '五级标题', title6: '六级标题',
  link: '链接', quote: '引用', code: '行内代码', codeBlock: '代码块', comment: '注释',
  image: '图片', unorderedListCommand: '无序列表', orderedListCommand: '有序列表',
  checkedListCommand: '任务列表', table: '表格', hr: '分隔线',
  heading1: '一级标题', heading2: '二级标题', heading3: '三级标题',
  'unordered-list': '无序列表', 'ordered-list': '有序列表', 'checked-list': '任务列表',
};

const editorCommands = [
  commands.bold, commands.italic, commands.strikethrough, commands.divider,
  commands.title, commands.divider, commands.link, commands.quote, commands.code,
  commands.codeBlock, commands.image, commands.divider, commands.unorderedListCommand,
  commands.orderedListCommand, commands.checkedListCommand, commands.table, commands.hr,
].map(command => ({
  ...command,
  buttonProps: { ...command.buttonProps, title: labels[command.name] || command.buttonProps?.title, 'aria-label': labels[command.name] || command.buttonProps?.['aria-label'] },
}));

const previewOptions = { rehypePlugins: [rehypeSanitize] };

export function KnowledgeMarkdown({ value, editing = false, preview = false, disabled = false, onChange, onSave }: {
  value: string;
  editing?: boolean;
  preview?: boolean;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onSave?: () => void;
}) {
  const { user, currentTeam } = useAppContext();
  const scope = currentTeam ? `team_${currentTeam.id}` : user ? `user_${user.id}` : 'guest';
  const [appearance] = useNavigationAppearance(scope);
  const container = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(500);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (!editing || !container.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.max(120, Math.floor(entry.contentRect.height)));
      setCompact(entry.contentRect.width < 720);
    });
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [editing]);

  return <div className={`knowledge-markdown${editing ? ' is-editing' : ''}${compact ? ' is-compact' : ''}`} data-color-mode={appearance.style === 'midnight' ? 'dark' : 'light'}
    onKeyDown={event => {
      if (editing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!disabled) onSave?.();
      }
    }}>
    {editing && <div className={`knowledge-markdown-labels${preview || compact ? ' is-single' : ''}`}>
      {!preview && <span>Markdown 输入区 <small>在此输入正文</small></span>}
      {(preview || !compact) && <span>效果预览 <small>只读</small></span>}
    </div>}
    <div ref={container} className="knowledge-markdown-body">{editing ? <MDEditor value={value} onChange={next => onChange?.(next || '')}
      height={height} minHeight={120} visibleDragbar={false}
      preview={preview ? 'preview' : compact ? 'edit' : 'live'} commands={editorCommands} extraCommands={[]}
      previewOptions={previewOptions}
      textareaProps={{ disabled, 'aria-label': '知识库文档内容', placeholder: '开始编写文档，支持 Markdown…', spellCheck: false }}
    /> : <MDEditor.Markdown source={value} rehypePlugins={previewOptions.rehypePlugins} />}</div>
  </div>;
}
