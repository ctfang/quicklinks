import { Link } from 'react-router-dom';
import { useState } from 'react';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Button, Card, Empty, Skeleton, Typography } from 'antd';
import { AuthModal } from '../components/AuthModal';
export function Knowledge() {
  const { user, teams, isLoading } = useAppContext();
  const [loginOpen, setLoginOpen] = useState(false);
  return <div className="knowledge-workspace workspace-page w-full">
    <div className="workspace-heading mb-10"><p>KNOWLEDGE</p><h1>知识库</h1><span>文档、表格与自由画布，汇聚团队知识。</span></div>
    <div className="knowledge-library-heading"><h2>团队知识库</h2><span>选择团队查看和维护已有内容</span></div>
    {isLoading ? <Skeleton active /> : !user ? <Empty description="登录后查看您加入的团队知识库。"><Button type="primary" onClick={() => setLoginOpen(true)}>登录知识库</Button></Empty> : teams.length === 0 ? <Empty description="暂无团队，请创建或加入团队后使用知识库。"><Link to="/manage?tab=teams"><Button>创建或加入团队</Button></Link></Empty> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{teams.map(team => <Link to={`/wiki/${team.id}`} key={team.id}>
      <Card hoverable className="h-full"><div className="flex justify-between text-blue-400 mb-8"><BookOpen size={28} /><ArrowUpRight size={20} /></div><Typography.Title level={4}>{team.name}</Typography.Title><Typography.Text type="secondary">{team.description || '进入团队知识库'}</Typography.Text></Card>
    </Link>)}</div>}
    <AuthModal isOpen={loginOpen} onClose={() => { setLoginOpen(false); }} />
  </div>;
}
