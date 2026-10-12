import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { StyleProvider } from '@ant-design/cssinjs';
import { useAppContext } from '../context/AppContext';
import { getThemePack, useNavigationAppearance } from '../lib/navigationAppearance';

// 所有页面共用当前空间的外观，控件同步明暗与强调色。
export function DesignProvider({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const { user, currentTeam } = useAppContext();
  const scope = currentTeam ? `team_${currentTeam.id}` : user ? `user_${user.id}` : 'guest';
  const [appearance] = useNavigationAppearance(scope);
  const pack = pathname === '/' ? getThemePack(appearance.themePack) : undefined;
  const dark = pathname === '/reset-password' || (pack ? pack.dark : appearance.style === 'midnight');
  const accent = pack?.accent || (appearance.theme === 'ocean' ? (dark ? '#6bd5c4' : '#188b84') : appearance.theme === 'sunset' ? (dark ? '#eeaf85' : '#b86846') : (dark ? '#8ab4ff' : '#2563eb'));
  return <StyleProvider layer><ConfigProvider locale={zhCN} componentSize="large" theme={{
    cssVar: { key: pack ? `quicklinks-${appearance.themePack}` : dark ? 'quicklinks-dark' : 'quicklinks-light' },
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: accent,
      colorInfo: accent,
      borderRadius: pack?.radius || 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
      fontSize: 14,
      controlHeight: 44,
      ...(dark ? {
        colorBgBase: '#10141c',
        colorBgLayout: '#10141c',
        colorBgContainer: '#1c2330',
        colorBgElevated: '#1c2330',
        colorText: '#e2e8f0',
        colorTextSecondary: '#94a3b8',
        colorBorder: '#334155',
        colorLink: '#60a5fa',
        colorLinkHover: '#93c5fd',
      } : { colorBgLayout: '#f5f7fa' }),
      ...(pack ? { colorBgBase: pack.bg, colorBgLayout: pack.bg, colorBgContainer: pack.card, colorBgElevated: pack.card, colorText: pack.text, colorTextSecondary: pack.muted, colorBorder: pack.line, colorLink: pack.accent } : {}),
    },
    components: { Modal: { borderRadiusLG: pack?.radius || 20 }, Card: { borderRadiusLG: pack?.radius || 16 } },
  }}>{children}</ConfigProvider></StyleProvider>;
}
