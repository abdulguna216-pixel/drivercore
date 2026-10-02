import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../frontend/src/components/Providers';
import { Loading } from '../frontend/src/components/UI';
import Layout from './Layout';
import Login from './Login';
import Dashboard from './pages/Dashboard';
import Requests from './pages/Requests';
import RequestDetail from './pages/RequestDetail';
import Calendar from './pages/Calendar';
import Directory from './pages/Directory';
import EntityDetail from './pages/EntityDetail';
import Orders, { OrderDetail } from './pages/Orders';
import Finance from './pages/Finance';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Security from './pages/Security';
function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? children : <Navigate to="/crm/login" replace />;
}
export default function CRM() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="clients" element={<Directory kind="clients" />} />
        <Route path="clients/:id" element={<EntityDetail kind="clients" />} />
        <Route path="cars" element={<Directory kind="cars" />} />
        <Route path="cars/:id" element={<EntityDetail kind="cars" />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="users" element={<Directory kind="users" />} />
        <Route path="services" element={<Directory kind="services" />} />
        <Route path="finance" element={<Finance />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="security" element={<Security />} />
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Route>
    </Routes>
  );
}
