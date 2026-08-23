// AppRoutes.tsx — Rotas principais do site Águia Express

import { Navigate, Route, Routes } from 'react-router-dom';

import PublicLayout from '../layouts/PublicLayout';
import PanelLayout from '../layouts/PanelLayout';

import Inicio from '../pages/Inicio';
import Rastreamento from '../pages/Rastreamento';
import Login from '../pages/Login';

import Dashboard from '../pages/Dashboard';
import Operacao from '../pages/Operacao';
import Empresas from '../pages/Empresas';

export default function AppRoutes() {
  return (
    <Routes>

      {/* =========================
          SITE PÚBLICO
      ========================== */}

      <Route element={<PublicLayout />}>
        <Route path="/" element={<Inicio />} />

        <Route
          path="/rastreamento"
          element={<Rastreamento />}
        />
      </Route>

      {/* =========================
          LOGIN
      ========================== */}

      <Route
        path="/login"
        element={<Login />}
      />

      {/* =========================
          ADMIN / DASHBOARD
      ========================== */}

      <Route
        path="/admin"
        element={
          <PanelLayout
            title="Administração"
            subtitle="Controle completo da Águia Express"
          />
        }
      >
        <Route index element={<Dashboard />} />
      </Route>

      {/* =========================
          OPERAÇÃO
      ========================== */}

      <Route
        path="/operacao"
        element={
          <PanelLayout
            title="Operação"
            subtitle="Controle operacional"
          />
        }
      >
        <Route index element={<Operacao />} />
      </Route>

      {/* =========================
          EMPRESAS
      ========================== */}

      <Route
        path="/empresa"
        element={
          <PanelLayout
            title="Portal da Empresa"
            subtitle="Acompanhe seus pacotes"
          />
        }
      >
        <Route index element={<Empresas />} />
      </Route>

      {/* =========================
          ROTA NÃO ENCONTRADA
      ========================== */}

      <Route
        path="*"
        element={<Navigate to="/" replace />}
      />

    </Routes>
  );
}
