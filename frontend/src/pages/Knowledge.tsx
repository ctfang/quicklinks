import { Link } from 'react-router-dom';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Card, Empty, Skeleton, Typography } from 'antd';

export function Knowledge() {
  const { user, teams, isLoading } = useAppContext();
  return <div className="w-full max-w-6xl mx-auto px-6 pt-12 pb-28">
    <p className="text-indigo-300 text-sm mb-3">KNOWLEDGE</p><h1 className="text-3xl font-semibold">知识库</h1><p className="text-white/60 mt-3 mb-10">沉淀团队经验，让知识有处可寻。</p>
    {isLoading ? <Skeleton active /> : !user ? <Empty description="登录后查看您加入的团队知识库。" /> : teams.length === 0 ? <Empty description="暂无团队，请在管理中心创建或加入团队后使用知识库。" /> : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{teams.map(team => <Link to={`/wiki/${team.id}`} key={team.id}>
      <Card hoverable className="h-full"><div className="flex justify-between text-blue-400 mb-8"><BookOpen size={28} /><ArrowUpRight size={20} /></div><Typography.Title level={4}>{team.name}</Typography.Title><Typography.Text type="secondary">{team.description || '进入团队知识库'}</Typography.Text></Card>
    </Link>)}</div>}
  </div>;
}
