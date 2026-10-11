import { NavigationContent } from '../components/NavigationContent';
import { useAppContext } from '../context/AppContext';

export function Home() {
  const { user, currentTeam } = useAppContext();
  return <NavigationContent key={`${user?.id || 'guest'}_${currentTeam?.id || 'personal'}`} />;
}
