import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useNavigationAppearance } from '../lib/navigationAppearance';
import { Layout } from './Layout';

export function KnowledgeLayout() {
  useEffect(() => {
    const previous = document.title;
    document.title = '知识库 · Quicklinks';
    return () => { document.title = previous; };
  }, []);
  const { user, currentTeam, teams, setCurrentTeam } = useAppContext();
  const scope = currentTeam ? `team_${currentTeam.id}` : user ? `user_${user.id}` : 'guest';
  const [appearance] = useNavigationAppearance(scope);
  const location = useLocation();
  const isEditor = location.pathname.startsWith('/wiki/');
  const team = teams.find(item => location.pathname === `/wiki/${item.id}`);
  useEffect(() => {
    if (team) setCurrentTeam(team);
  }, [team, setCurrentTeam]);
  if (!isEditor) return <Layout />;
  return <div className={`knowledge-shell homepage-shell theme-${appearance.theme} style-${appearance.style} min-h-screen`}>
    <main className={`knowledge-workspace workspace-page${isEditor ? ' knowledge-editor-workspace' : ''}`}>
      <Outlet key={location.pathname} />
    </main>
  </div>;
}
