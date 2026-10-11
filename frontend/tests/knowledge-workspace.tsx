import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { Wiki } from '../src/pages/Wiki';
import '../src/index.css';
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/wiki/qa-team']}><ConfigProvider locale={zhCN}><div className="homepage-shell theme-aurora style-light knowledge-shell"><main className="knowledge-workspace workspace-page knowledge-editor-workspace"><div className="knowledge-breadcrumb">团队知识库 · 浏览器验证（仅内存数据）</div><Routes><Route path="/wiki/:id" element={<Wiki />} /></Routes></main></div></ConfigProvider></MemoryRouter>);
