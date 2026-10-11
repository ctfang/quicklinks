import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { BookOpen, ArrowLeft, Settings, LogIn } from 'lucide-react';
import { AuthModal } from './AuthModal';
import { useAppContext } from '../context/AppContext';

export function KnowledgeLayout() {
  useEffect(() => {
    const previous = document.title;
    document.title = '知识库 · Quicklinks';
    return () => { document.title = previous; };
  }, []);
  const { user, teams } = useAppContext();
  const [loginOpen, setLoginOpen] = useState(false);
  const location = useLocation();
  const team = teams.find(item => location.pathname === `/wiki/${item.id}`);
  return <div className="knowledge-workspace min-h-screen bg-slate-950 text-slate-200">
    <header className="flex flex-wrap items-center justify-between gap-4 px-5 md:px-8 py-4 border-b border-slate-800 bg-slate-900">
      <div className="flex items-center gap-5"><Link to="/wiki" className="flex items-center gap-3 font-semibold"><span className="p-2 bg-indigo-500/20 rounded-lg text-indigo-300"><BookOpen size={21} /></span>Quicklinks <span className="font-normal text-slate-500">/</span> 知识库</Link>{team && <span className="hidden md:inline text-sm text-slate-400">{team.name}</span>}</div>
      <div className="flex gap-5 items-center text-sm text-slate-400"><Link to="/" className="flex gap-2 items-center hover:text-white"><ArrowLeft size={16} />导航</Link><Link to="/manage" className="flex gap-2 items-center hover:text-white"><Settings size={16} />管理</Link>{user ? <span className="text-slate-200">{user.name}</span> : <button onClick={() => setLoginOpen(true)} className="flex gap-2 items-center text-indigo-300"><LogIn size={16} />登录</button>}</div>
    </header>
    {team && <div className="px-6 py-3 border-b border-slate-800 text-xs text-slate-500"><Link to="/wiki" className="hover:text-indigo-300">全部知识库</Link><span className="mx-3">/</span>{team.name}</div>}
    <main className="flex flex-col min-h-[calc(100vh-100px)]"><Outlet key={location.pathname} /></main>
    <AuthModal isOpen={loginOpen} onClose={() => setLoginOpen(false)} />
  </div>;
}
