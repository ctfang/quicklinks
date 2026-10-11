import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { lazy, Suspense } from 'react';
import { KnowledgeLayout } from './components/KnowledgeLayout';
import { Home } from './pages/Home';
import { DesignProvider } from './components/DesignProvider';

const Management = lazy(() => import('./pages/Management').then(module => ({ default: module.Management })));
const Knowledge = lazy(() => import('./pages/Knowledge').then(module => ({ default: module.Knowledge })));
const Wiki = lazy(() => import('./pages/Wiki').then(module => ({ default: module.Wiki })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then(module => ({ default: module.ResetPassword })));

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <DesignProvider>
        <Suspense fallback={<div role="status" className="min-h-screen bg-slate-950 text-slate-300 grid place-items-center">正在加载页面…</div>}>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="manage" element={<Management />} />
          </Route>
          <Route path="/wiki" element={<KnowledgeLayout />}>
            <Route index element={<Knowledge />} />
            <Route path=":id" element={<Wiki />} />
          </Route>
        </Routes>
        </Suspense>
        </DesignProvider>
      </BrowserRouter>
    </AppProvider>
  );
}
