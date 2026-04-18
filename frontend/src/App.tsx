import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Wiki } from './pages/Wiki';
import { ResetPassword } from './pages/ResetPassword';

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="wiki/:id" element={<Wiki />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
