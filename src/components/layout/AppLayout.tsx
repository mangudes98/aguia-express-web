// ARQUIVO: src/components/layout/AppLayout.tsx

import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Package,
  Settings,
  Truck,
  Users,
  X,
} from "lucide-react";

import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { db } from "../../services/firebase/firebase";
import logoIcon from "../../assets/icon.png";

type Permissoes = {
  usuarios?: boolean;
  empresas?: boolean;
  financeiro?: boolean;
  coleta?: boolean;
  comunicados?: boolean;
  pesquisa?: boolean;
  devolucao?: boolean;
  editarPacote?: boolean;
  finalizados?: boolean;
  roleta?: boolean;
};

type LinkItem = readonly [
  string,
  string,
  typeof LayoutDashboard,
];

const links: LinkItem[] = [
  ["Dashboard", "/dashboard", LayoutDashboard],
  ["Empresas", "/empresas", Building2],
  ["Usuários", "/usuarios", Users],
  ["Operação", "/operacao", Truck],
  ["Coletas", "/coletas", Package],
  ["Rastreamento", "/rastreamento", MapPin],
  ["Mapa", "/mapa", Map],
  ["Financeiro", "/financeiro", CircleDollarSign],
  ["WhatsApp", "/whatsapp", MessageCircle],
  ["Configurações", "/configuracoes", Settings],
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);

  const [linksVisiveis, setLinksVisiveis] = useState<LinkItem[]>([]);

  const { user, logout } = useAuth();

  const nomeUsuario =
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Administrador";

  const inicial =
    nomeUsuario.charAt(0).toUpperCase();

  useEffect(() => {
    let ativo = true;

    const carregarPermissoes = async () => {
      if (!user) {
        if (ativo) {
          setLinksVisiveis([]);
        }
        return;
      }

      try {
        let userDoc = await getDoc(
          doc(db, "usuarios", user.uid)
        );

        if (!userDoc.exists() && user.email) {
          userDoc = await getDoc(
            doc(
              db,
              "usuarios",
              user.email.toLowerCase()
            )
          );
        }

        if (!userDoc.exists()) {
          if (ativo) {
            setLinksVisiveis([]);
          }
          return;
        }

        const dados = userDoc.data();

        const tipo = String(
          dados?.tipo || ""
        ).toLowerCase();

        const permissoes =
          (dados?.permissoes || {}) as Permissoes;

        // ============================================================
        // ADMIN
        // ACESSO TOTAL
        // ============================================================

        if (tipo === "admin") {
          if (ativo) {
            setLinksVisiveis(links);
          }
          return;
        }

        // ============================================================
        // OPERADOR / EMPRESA / OUTROS
        // MOSTRA SOMENTE O QUE POSSUI PERMISSÃO
        // ============================================================

        const permitidos = links.filter(
          ([label]) => {
            switch (label) {
              // SOMENTE ADMIN
              case "Dashboard":
                return tipo === "admin" || permissoes.finalizados === true;
              // PERMISSÃO empresas
              case "Empresas":
                return permissoes.empresas === true;

              // PERMISSÃO usuarios
              case "Usuários":
                return permissoes.usuarios === true;

              // OPERAÇÃO USA A MESMA PERMISSÃO DE FINALIZADOS
              case "Operação":
                return permissoes.finalizados === true;

              // PERMISSÃO coleta
              case "Coletas":
                return permissoes.coleta === true;

              // PERMISSÃO pesquisa
              case "Rastreamento":
                return permissoes.pesquisa === true;

              // ADMIN E OPERADOR
              case "Mapa":
                return tipo === "admin" || permissoes.finalizados === true;
              // PERMISSÃO financeiro
              case "Financeiro":
                return permissoes.financeiro === true;


                
              case "WhatsApp":
                return tipo === "admin" || permissoes.finalizados === true;

              // SOMENTE ADMIN
              case "Configurações":
                return false;

              default:
                return false;
            }
          }
        );

        if (ativo) {
          setLinksVisiveis(permitidos);
        }
      } catch (error) {
        console.error(
          "Erro ao carregar permissões:",
          error
        );

        if (ativo) {
          setLinksVisiveis([]);
        }
      }
    };

    carregarPermissoes();

    return () => {
      ativo = false;
    };
  }, [user]);

  return (
    <div className="app-shell">

      <style>{`
        html,
        body,
        #root {
          margin: 0;
          width: 100%;
          min-width: 0;
          overflow-x: hidden;
        }

        * {
          box-sizing: border-box;
        }

        .app-shell {
          width: 100%;
          min-height: 100vh;
          display: flex;
          background: #f6f7f9;
          overflow: hidden;
        }

        /* =========================
           SIDEBAR
        ========================= */

        .sidebar {
          position: fixed;
          top: 0;
          left: 0;
          bottom: 0;

          width: 260px;
          height: 100vh;

          z-index: 1000;

          display: flex;
          flex-direction: column;

          background:
            linear-gradient(
              180deg,
              #08121f 0%,
              #0c1725 100%
            );

          border-right:
            1px solid
            rgba(255,255,255,.06);

          box-shadow:
            12px 0 35px
            rgba(0,0,0,.08);

          transition:
            width .25s ease,
            transform .25s ease;

          overflow: visible;
        }

        .sidebar.collapsed {
          width: 100px;
        }

        /* =========================
           LOGO
        ========================= */

        .brand {
          flex: 0 0 94px;

          width: 100%;
          height: 94px;

          padding: 0 18px;

          display: flex;
          align-items: center;
          gap: 13px;

          border-bottom:
            1px solid
            rgba(255,255,255,.06);

          overflow: hidden;
        }

        .brand-mark {
          width: 64px;
          height: 64px;

          flex: 0 0 64px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 16px;

          background:
            rgba(255,255,255,.035);

          overflow: hidden;
        }

        .brand-mark img {
          width: 100%;
          height: 100%;

          display: block;

          object-fit: contain;
          object-position: center;

          border-radius: 16px;
        }

        .sidebar.collapsed .brand {
          padding: 0;
          justify-content: center;
        }

        .sidebar.collapsed .brand-mark {
          width: 70px;
          height: 70px;

          flex: 0 0 70px;

          border-radius: 17px;
        }

        .sidebar.collapsed .brand-mark img {
          border-radius: 17px;
        }

        /* =========================
           NOME DA ÁGUIA
        ========================= */

        .brand-text {
          min-width: 0;

          display: flex;
          flex-direction: column;

          line-height: 1;
          white-space: nowrap;
        }

        .brand-text b {
          color: #fff;

          font-size: 17px;
          letter-spacing: 2px;
        }

        .brand-text small {
          margin-top: 6px;

          color: #c9a227;

          font-size: 9px;
          font-weight: 900;

          letter-spacing: 3.5px;
        }

        .sidebar.collapsed .brand-text {
          display: none;
        }

        /* =========================
           MENU
        ========================= */

        .main-navigation {
          flex: 1 1 auto;

          width: 100%;
          min-height: 0;

          padding: 14px 0;

          overflow: hidden;

          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .main-navigation::-webkit-scrollbar {
          display: none;
        }

        .nav-title {
          padding:
            0 20px 8px;

          color: #667085;

          font-size: 9px;
          font-weight: 900;

          letter-spacing: 1.2px;
        }

        .nav-item {
          position: relative;

          width: calc(100% - 20px);
          height: 44px;

          margin:
            0 10px 4px;

          padding:
            0 10px;

          display: flex;
          align-items: center;

          gap: 11px;

          border-radius: 11px;

          color: #98a2b3;

          text-decoration: none;

          font-size: 12px;
          font-weight: 700;

          overflow: hidden;

          transition:
            background .18s ease,
            color .18s ease;
        }

        .sidebar.collapsed .nav-item {
          width: 100%;
          height: 48px;

          margin:
            0 0 5px;

          padding: 0;

          justify-content: center;

          border-radius: 0;
        }

        .nav-item:hover {
          color: #fff;

          background:
            rgba(255,255,255,.07);
        }

        .nav-item.active {
          color: #fff;

          background:
            linear-gradient(
              90deg,
              rgba(201,162,39,.24),
              rgba(201,162,39,.10)
            );

          box-shadow:
            inset 4px 0 0 #c9a227;
        }

        /* =========================
           ÍCONES
        ========================= */

        .nav-icon {
          width: 28px;
          height: 28px;

          flex: 0 0 28px;

          display: flex;
          align-items: center;
          justify-content: center;

          color: #8491a2;
        }

        .nav-icon svg {
          width: 21px;
          height: 21px;
        }

        .sidebar.collapsed .nav-icon {
          width: 32px;
          height: 32px;

          flex: 0 0 32px;
        }

        .sidebar.collapsed .nav-icon svg {
          width: 23px;
          height: 23px;
        }

        .nav-item:hover .nav-icon,
        .nav-item.active .nav-icon {
          color: #d6b33a;
        }

        .nav-label {
          min-width: 0;
          flex: 1;

          white-space: nowrap;

          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* =========================
           EMPRESAS
        ========================= */

        .nav-item.empresas-link {
          margin-top: 4px;

          background:
            rgba(201,162,39,.06);

          border:
            1px solid
            rgba(201,162,39,.12);
        }

        .nav-item.empresas-link:hover {
          background:
            rgba(201,162,39,.13);
        }

        .nav-item.empresas-link.active {
          background:
            linear-gradient(
              90deg,
              rgba(201,162,39,.27),
              rgba(201,162,39,.10)
            );
        }

        .nav-highlight {
          flex: 0 0 auto;

          padding:
            3px 6px;

          border-radius: 5px;

          background:
            rgba(201,162,39,.14);

          color: #d6b33a;

          font-size: 7px;
          font-weight: 900;

          text-transform: uppercase;
        }

        /* =========================
           RODAPÉ
        ========================= */

        .sidebar-footer {
          flex: 0 0 auto;

          width: 100%;

          padding:
            9px 10px;

          border-top:
            1px solid
            rgba(255,255,255,.06);
        }

        .sidebar.collapsed .sidebar-footer {
          padding: 9px 0;
        }

        .logout-button {
          width: 100%;
          height: 42px;

          padding: 0 10px;

          display: flex;
          align-items: center;
          gap: 11px;

          border: 0;
          border-radius: 10px;

          background:
            rgba(255,255,255,.035);

          color: #98a2b3;

          cursor: pointer;

          font-size: 11px;
          font-weight: 700;
        }

        .sidebar.collapsed .logout-button {
          justify-content: center;
          padding: 0;
          border-radius: 0;
        }

        .logout-button:hover {
          color: #fff;

          background:
            rgba(220,38,38,.11);
        }

        /* =========================
           SETA
        ========================= */

        .collapse-btn {
          position: absolute;

          top: 105px;
          right: -15px;

          width: 30px;
          height: 30px;

          z-index: 1200;

          display: flex;
          align-items: center;
          justify-content: center;

          padding: 0;

          border:
            1px solid #d0d5dd;

          border-radius: 50%;

          background: #fff;
          color: #475467;

          cursor: pointer;

          box-shadow:
            0 4px 12px
            rgba(16,24,40,.18);
        }

        .collapse-btn:hover {
          color: #a38319;

          border-color:
            #c9a227;

          background:
            #fffdf5;
        }

        /* =========================
           ÁREA PRINCIPAL
        ========================= */

        .main-area {
          width:
            calc(100% - 260px);

          min-width: 0;

          margin-left: 260px;

          overflow: hidden;

          transition:
            width .25s ease,
            margin-left .25s ease;
        }

        .sidebar.collapsed ~ .main-area {
          width:
            calc(100% - 100px);

          margin-left: 100px;
        }

        /* =========================
           TOPBAR
        ========================= */

        .topbar {
          position: sticky;
          top: 0;

          z-index: 900;

          width: 100%;
          height: 76px;

          padding:
            0 28px;

          display: flex;
          align-items: center;

          gap: 20px;

          background:
            rgba(255,255,255,.95);

          border-bottom:
            1px solid #eaecf0;

          backdrop-filter:
            blur(16px);

          overflow: hidden;
        }

        .topbar-title {
          min-width: 0;
          margin-right: auto;
        }

        .topbar-title-main {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .topbar-title-main b {
          color: #101828;
          font-size: 14px;
          white-space: nowrap;
        }

        .topbar-title small {
          display: block;

          margin-top: 3px;

          color: #98a2b3;

          font-size: 10px;
          white-space: nowrap;
        }

        .online-status {
          display: inline-flex;
          align-items: center;
          gap: 5px;

          padding: 4px 7px;

          border-radius: 20px;

          background: #ecfdf3;
          color: #15803d;

          font-size: 8px;
          font-weight: 800;
        }

        .online-dot {
          width: 6px;
          height: 6px;

          border-radius: 50%;

          background: #22c55e;
        }

        .top-user {
          flex: 0 0 auto;

          display: flex;
          align-items: center;

          gap: 10px;

          padding-left: 15px;

          border-left:
            1px solid #eaecf0;
        }

        .avatar {
          width: 38px;
          height: 38px;

          flex: 0 0 38px;

          display: flex;
          align-items: center;
          justify-content: center;

          border-radius: 11px;

          background:
            linear-gradient(
              135deg,
              #c9a227,
              #e1c458
            );

          color: #111827;

          font-size: 13px;
          font-weight: 900;
        }

        .user-info {
          min-width: 0;

          display: flex;
          flex-direction: column;
        }

        .user-info strong {
          max-width: 170px;

          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;

          color: #344054;

          font-size: 11px;
          font-weight: 800;
        }

        .user-info small {
          margin-top: 3px;

          color: #98a2b3;

          font-size: 8px;
        }

        /* =========================
           CONTEÚDO
        ========================= */

        .content {
          width: 100%;
          min-width: 0;

          min-height:
            calc(100vh - 76px);

          padding: 28px;

          background:
            #f6f7f9;

          overflow-x: hidden;
        }

        .mobile-close,
        .mobile-menu {
          display: none;
        }

        /* =========================
           MOBILE
        ========================= */

        @media (max-width: 900px) {

          .sidebar {
            width: 260px;

            transform:
              translateX(-100%);
          }

          .sidebar.collapsed {
            width: 260px;
          }

          .sidebar.mobile-open {
            transform:
              translateX(0);
          }

          .sidebar.collapsed .brand {
            justify-content: flex-start;
            padding: 0 18px;
          }

          .sidebar.collapsed .brand-mark {
            width: 64px;
            height: 64px;
            flex-basis: 64px;
          }

          .sidebar.collapsed .nav-item {
            width: calc(100% - 20px);
            height: 44px;

            margin:
              0 10px 4px;

            padding:
              0 10px;

            justify-content: flex-start;

            border-radius: 11px;
          }

          .sidebar.collapsed .nav-icon {
            width: 28px;
            height: 28px;
            flex-basis: 28px;
          }

          .sidebar.collapsed .nav-icon svg {
            width: 21px;
            height: 21px;
          }

          .sidebar.collapsed .sidebar-footer {
            padding: 9px 10px;
          }

          .sidebar.collapsed .logout-button {
            justify-content: flex-start;
            padding: 0 10px;
            border-radius: 10px;
          }

          .sidebar.collapsed ~ .main-area {
            width: 100%;
            margin-left: 0;
          }

          .collapse-btn {
            display: none;
          }

          .mobile-menu {
            width: 40px;
            height: 40px;

            display: flex;
            align-items: center;
            justify-content: center;

            border:
              1px solid #eaecf0;

            border-radius: 9px;

            background: #fff;
            color: #344054;

            cursor: pointer;
          }

          .mobile-close {
            position: absolute;

            top: 25px;
            right: 14px;

            width: 38px;
            height: 38px;

            display: flex;
            align-items: center;
            justify-content: center;

            border:
              1px solid
              rgba(255,255,255,.08);

            border-radius: 9px;

            background:
              rgba(255,255,255,.05);

            color: #98a2b3;

            cursor: pointer;
          }
        }

        @media (max-width: 600px) {

          .topbar {
            padding:
              0 15px;
          }

          .topbar-title-main b {
            font-size: 12px;
          }

          .online-status {
            display: none;
          }

          .topbar-title small {
            font-size: 8px;
          }

          .user-info {
            display: none;
          }

          .top-user {
            padding-left: 0;
            border-left: 0;
          }

          .content {
            padding: 17px;
          }
        }
      `}</style>

      {/* =========================
          SIDEBAR
      ========================= */}

      <aside
        className={`sidebar ${
          collapsed ? "collapsed" : ""
        } ${
          mobile ? "mobile-open" : ""
        }`}
      >

        {/* LOGO */}

        <div className="brand">

          <div className="brand-mark">

            <img
              src={logoIcon}
              alt="Águia Express"
            />

          </div>

          <div className="brand-text">

            <b>ÁGUIA</b>

            <small>
              EXPRESS
            </small>

          </div>

        </div>

        {/* MENU */}

        <nav className="main-navigation">

          {!collapsed && (
            <div className="nav-title">
              MENU PRINCIPAL
            </div>
          )}

          {linksVisiveis.map(
            ([label, to, Icon]) => (

              <NavLink
                key={to}
                to={to}
                end={
                  to === "/dashboard"
                }
                onClick={() =>
                  setMobile(false)
                }
                className={({ isActive }) =>
                  `nav-item ${
                    isActive
                      ? "active"
                      : ""
                  } ${
                    to === "/empresas"
                      ? "empresas-link"
                      : ""
                  }`
                }
              >

                <span className="nav-icon">
                  <Icon size={21} />
                </span>

                {!collapsed && (
                  <span className="nav-label">
                    {label}
                  </span>
                )}

                {!collapsed &&
                  to === "/empresas" && (
                    <span className="nav-highlight">
                      Gestão
                    </span>
                  )}

              </NavLink>

            )
          )}

        </nav>

        {/* SAIR */}

        <div className="sidebar-footer">

          <button
            type="button"
            className="logout-button"
            onClick={() => logout()}
          >

            <LogOut size={18} />

            {!collapsed && (
              <span>
                Sair da conta
              </span>
            )}

          </button>

        </div>

        {/* SETA */}

        <button
          type="button"
          className="collapse-btn"
          onClick={() =>
            setCollapsed(
              (value) => !value
            )
          }
          aria-label={
            collapsed
              ? "Expandir menu"
              : "Recolher menu"
          }
        >

          {collapsed ? (
            <ChevronRight size={17} />
          ) : (
            <ChevronLeft size={17} />
          )}

        </button>

        {/* MOBILE */}

        <button
          type="button"
          className="mobile-close"
          onClick={() =>
            setMobile(false)
          }
          aria-label="Fechar menu"
        >

          <X size={21} />

        </button>

      </aside>

      {/* =========================
          ÁREA PRINCIPAL
      ========================= */}

      <div className="main-area">

        <header className="topbar">

          <button
            type="button"
            className="mobile-menu"
            onClick={() =>
              setMobile(true)
            }
            aria-label="Abrir menu"
          >
            <Menu size={22} />
          </button>

          <div className="topbar-title">

            <div className="topbar-title-main">

              <b>
                Painel Águia Express
              </b>

              <span className="online-status">

                <span className="online-dot" />

                Sistema online

              </span>

            </div>

            <small>
              Gestão operacional de entregas
            </small>

          </div>

          <div className="top-user">

            <div className="avatar">
              {inicial}
            </div>

            <div className="user-info">

              <strong>
                {nomeUsuario}
              </strong>

              <small>
                Administrador
              </small>

            </div>

          </div>

        </header>

        <main className="content">
          <Outlet />
        </main>

      </div>

    </div>
  );
}