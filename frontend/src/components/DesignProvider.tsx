import { ConfigProvider, theme } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { useLocation } from 'react-router-dom';
import type { PropsWithChildren } from 'react';
import { StyleProvider } from '@ant-design/cssinjs';

// 所有组件共用设计令牌；路由只决定明暗，不再各自配置控件外观。
export function DesignProvider({ children }: PropsWithChildren) {
  const { pathname } = useLocation();
  const dark = pathname !== '/' && !pathname.startsWith('/manage');
  return <StyleProvider layer><ConfigProvider locale={zhCN} componentSize="large" theme={{
    cssVar: { key: dark ? 'quicklinks-dark' : 'quicklinks-light' },
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: '#2563eb',
      colorInfo: '#2563eb',
      borderRadius: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif',
      fontSize: 14,
      controlHeight: 44,
      ...(dark ? {
        colorBgBase: '#141414',
        colorBgLayout: '#020617',
        colorBgContainer: '#1e293b',
        colorBgElevated: '#0f172a',
        colorText: '#e2e8f0',
        colorTextSecondary: '#94a3b8',
        colorBorder: '#334155',
        colorLink: '#60a5fa',
        colorLinkHover: '#93c5fd',
      } : { colorBgLayout: '#f5f7fa' }),
    },
    components: { Modal: { borderRadiusLG: 20 }, Card: { borderRadiusLG: 16 } },
  }}>{children}</ConfigProvider></StyleProvider>;
}
