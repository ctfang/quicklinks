const team = { id: 'qa-team', name: '产品研发团队', description: '验证数据' };
export const useAppContext = () => ({ teams: [team], user: null, currentTeam: team, setCurrentTeam: () => {} });
