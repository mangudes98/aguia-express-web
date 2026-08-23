// ARQUIVO: src/pages/Configuracoes.tsx

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/ui/PageHeader";
import { useAuth } from "../context/AuthContext";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { LockKeyhole } from "lucide-react";
import { db, auth } from "../services/firebase/firebase";

function usePermission() {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!user) {
        setAllowed(false);
        setCheckingAccess(false);
        return;
      }

      try {
        // PRIMEIRA TENTATIVA: DOCUMENTO COM UID
        let userDoc = await getDoc(
          doc(db, "usuarios", user.uid)
        );

        // SEGUNDA TENTATIVA: DOCUMENTO COM EMAIL
        if (!userDoc.exists() && user.email) {
          userDoc = await getDoc(
            doc(db, "usuarios", user.email.toLowerCase())
          );
        }

        if (!userDoc.exists()) {
          setAllowed(false);
          setCheckingAccess(false);
          return;
        }

        const userData = userDoc.data();

        // EXATAMENTE A MESMA REGRA DO DASHBOARD:
        // SOMENTE ADMIN
        setAllowed(userData?.tipo === "admin");
      } catch (error) {
        console.error("Erro ao verificar permissão:", error);
        setAllowed(false);
      } finally {
        setCheckingAccess(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { checkingAccess, allowed };
}

export default function Configuracoes() {
  const { checkingAccess, allowed } = usePermission();

  const [dark, setDark] = useState(true);
  const [saindo, setSaindo] = useState(false);

  const navigate = useNavigate();
  const { logout } = useAuth();

  async function trocarUsuario() {
    try {
      setSaindo(true);

      await logout();

      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Erro ao sair:", error);
      setSaindo(false);
    }
  }

  // CARREGANDO PERMISSÃO
  if (checkingAccess) {
    return (
      <div>
        <PageHeader
          title="Configurações"
          subtitle="Verificando permissão de acesso..."
        />

        <section
          className="card"
          style={{
            minHeight: "300px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
          }}
        >
          Verificando acesso...
        </section>
      </div>
    );
  }

  // BLOQUEIO PARA NÃO ADMIN
  if (!allowed) {
    return (
      <div>
        <PageHeader
          title="Acesso restrito"
          subtitle="Área exclusiva para administradores."
        />

        <section
          className="card"
          style={{
            minHeight: "320px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "16px",
            textAlign: "center",
            padding: "30px",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              borderRadius: "18px",
              display: "grid",
              placeItems: "center",
              background: "#fff0f0",
              color: "#d92d20",
            }}
          >
            <LockKeyhole size={30} />
          </div>

          <div>
            <h2 style={{ margin: 0 }}>
              Acesso permitido somente para administradores
            </h2>

            <p
              style={{
                marginTop: "10px",
                color: "#667085",
              }}
            >
              Você não possui permissão para acessar Configurações.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Configurações"
        subtitle="Preferências do painel."
      />

      <section className="card settings">
        <label>
          Nome do painel
          <input defaultValue="Águia Express" />
        </label>

        <label>
          Região principal
          <input defaultValue="Barueri / 064, 065 e 066" />
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={dark}
            onChange={(e) => setDark(e.target.checked)}
          />
          <span>Usar tema escuro</span>
        </label>

        <button className="primary" type="button">
          Salvar configurações
        </button>

        {/* TROCAR USUÁRIO */}
        <div
          style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid #e5e7eb",
          }}
        >
          <h3
            style={{
              margin: "0 0 6px",
              fontSize: 16,
            }}
          >
            Trocar usuário
          </h3>

          <p
            style={{
              margin: "0 0 12px",
              color: "#64748b",
              fontSize: 13,
            }}
          >
            Sair da conta atual e voltar para a tela de login.
          </p>

          <button
            type="button"
            onClick={trocarUsuario}
            disabled={saindo}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 10,
              border: "1px solid #dc2626",
              background: "#fff",
              color: "#dc2626",
              fontWeight: 700,
              cursor: saindo ? "not-allowed" : "pointer",
              opacity: saindo ? 0.7 : 1,
            }}
          >
            {saindo ? "Saindo..." : "Sair e trocar usuário"}
          </button>
        </div>
      </section>
    </div>
  );
}