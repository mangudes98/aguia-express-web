// ARQUIVO: src/App.tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import AppLayout from "./components/layout/AppLayout";
import Inicio from "./pages/Inicio";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Empresas from "./pages/Empresas";
import Usuarios from "./pages/Usuarios";
import Operacao from "./pages/Operacao";
import Mapa from "./pages/Mapa";
import Financeiro from "./pages/Financeiro";
import Configuracoes from "./pages/Configuracoes";
import PacoteDetalhe from "./pages/PacoteDetalhe";
import Coleta from "./pages/Coleta";
import Rastreamento from "./pages/Rastreamento";

function LoginRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader">Carregando Águia Express...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Login />;
}

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="screen-loader">Carregando Águia Express...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Inicio />} />
        <Route path="/login" element={<LoginRedirect />} />
        <Route element={<Protected />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pacotes/:id" element={<PacoteDetalhe />} />
          <Route path="/empresas" element={<Empresas />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/operacao" element={<Operacao />} />
          <Route path="/coletas/*" element={<Coleta />} />
          <Route path="/mapa" element={<Mapa />} />
          <Route path="/rastreamento" element={<Rastreamento />} />
          <Route path="/financeiro" element={<Financeiro />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
