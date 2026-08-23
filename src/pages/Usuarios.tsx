// ARQUIVO: src/pages/Usuarios.tsx
//
// REGRA DE ACESSO:
// - Apenas usuário autenticado com tipo "admin" acessa esta página.
// - Verifica primeiro usuarios/{uid}.
// - Se não encontrar, verifica usuarios/{email}.
// - Mesma regra utilizada no Dashboard.
// - O restante da página permanece igual.

import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  updatePassword,
} from "firebase/auth";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  Shield,
  UserCog,
  Users,
  X,
} from "lucide-react";

import PageHeader from "../components/ui/PageHeader";
import { auth, db } from "../services/firebase/firebase";

const GOLD = "#C9A227";

type TipoUsuario = "admin" | "operador" | "entregador";

type Permissoes = {
  usuarios: boolean;
  empresas: boolean;
  financeiro: boolean;
  coleta: boolean;
  comunicados: boolean;
  pesquisa: boolean;
  devolucao: boolean;
  editarPacote: boolean;
  finalizados: boolean;
  roleta: boolean;
};

type UsuarioData = {
  id: string;
  email?: string;
  nome?: string;
  cpf?: string;
  telefone?: string;
  rua?: string;
  bairro?: string;
  cep?: string;
  numero?: string;
  endereco?: string;
  lat?: number | null;
  lng?: number | null;
  pix?: string;
  banco?: string;
  favorecido?: string;
  regiao?: string;
  tipo?: TipoUsuario;
  permissoes?: Partial<Permissoes>;
};

type FormData = {
  usuario: string;
  senha: string;
  nome: string;
  cpf: string;
  telefone: string;
  rua: string;
  bairro: string;
  cep: string;
  numero: string;
  pix: string;
  banco: string;
  favorecido: string;
  regiao: string;
  ml: string;
  shopee: string;
  avulso: string;
  tipo: TipoUsuario;
  permissoes: Permissoes;
};

const permissoesVazias = (): Permissoes => ({
  usuarios: false,
  empresas: false,
  financeiro: false,
  coleta: false,
  comunicados: false,
  pesquisa: false,
  devolucao: false,
  editarPacote: false,
  finalizados: false,
  roleta: false,
});

const novoFormulario = (): FormData => ({
  usuario: "",
  senha: "",
  nome: "",
  cpf: "",
  telefone: "",
  rua: "",
  bairro: "",
  cep: "",
  numero: "",
  pix: "",
  banco: "",
  favorecido: "",
  regiao: "",
  ml: "",
  shopee: "",
  avulso: "",
  tipo: "entregador",
  permissoes: permissoesVazias(),
});

const LABELS: Record<keyof Permissoes, string> = {
  usuarios: "Usuários",
  empresas: "Empresas",
  financeiro: "Financeiro",
  coleta: "Coleta",
  comunicados: "Comunicados",
  pesquisa: "Pesquisa",
  devolucao: "Devolução",
  editarPacote: "Editar Pacote",
  finalizados: "Finalizados",
  roleta: "Roleta de Prêmios",
};

const formatarEmail = (usuario: string) => {
  const valor = usuario.trim().toLowerCase();

  if (!valor) return "";

  if (valor.includes("@")) return valor;

  return `${valor}@gavioes.com`;
};

const numero = (valor: string) => {
  const texto = valor.trim().replace(",", ".");
  return Number.parseFloat(texto) || 0;
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioData[]>([]);
  const [loading, setLoading] = useState(true);

  // MESMA REGRA DO DASHBOARD
  const [permissao, setPermissao] =
    useState<"loading" | "ok" | "denied">("loading");

  const [busca, setBusca] = useState("");

  const [modal, setModal] = useState<"novo" | "editar" | null>(null);
  const [usuarioSelecionado, setUsuarioSelecionado] =
    useState<UsuarioData | null>(null);

  // ============================================================
  // PERMISSÃO
  // MESMA REGRA UTILIZADA NO DASHBOARD
  // ============================================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (user) => {
        if (!user) {
          setPermissao("denied");
          return;
        }

        try {
          // PRIMEIRA TENTATIVA:
          // documento pelo UID
          let userDoc = await getDoc(
            doc(db, "usuarios", user.uid)
          );

          // SEGUNDA TENTATIVA:
          // documento pelo EMAIL
          if (!userDoc.exists() && user.email) {
            userDoc = await getDoc(
              doc(
                db,
                "usuarios",
                user.email.toLowerCase()
              )
            );
          }

          // USUÁRIO NÃO ENCONTRADO
          if (!userDoc.exists()) {
            setPermissao("denied");
            return;
          }

          const userData = userDoc.data();

          // SOMENTE ADMIN
          if (userData?.tipo === "admin") {
            setPermissao("ok");
          } else {
            setPermissao("denied");
          }
        } catch (error) {
          console.error(
            "Erro ao verificar permissão:",
            error
          );

          setPermissao("denied");
        }
      }
    );

    return () => unsubscribe();
  }, []);

  // ============================================================
  // CARREGAR USUÁRIOS
  // SOMENTE DEPOIS DA PERMISSÃO
  // ============================================================

  useEffect(() => {
    if (permissao !== "ok") return;

    const unsubscribe = onSnapshot(
      collection(db, "usuarios"),
      (snapshot) => {
        const lista = snapshot.docs
          .map(
            (item) =>
              ({
                id: item.id,
                ...item.data(),
              }) as UsuarioData
          )
          .sort((a, b) =>
            (a.nome || a.id).localeCompare(
              b.nome || b.id,
              "pt-BR"
            )
          );

        setUsuarios(lista);
        setLoading(false);
      },
      () => {
        setUsuarios([]);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [permissao]);

  const filtrados = useMemo(() => {
    const texto = busca.trim().toLowerCase();

    if (!texto) return usuarios;

    return usuarios.filter((usuario) => {
      return [
        usuario.id,
        usuario.email,
        usuario.nome,
        usuario.telefone,
        usuario.regiao,
        usuario.tipo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(texto);
    });
  }, [usuarios, busca]);

  // ============================================================
  // VERIFICANDO
  // ============================================================

  if (permissao === "loading") {
    return (
      <div className="empty">
        <Loader2 size={24} />
        Verificando permissão...
      </div>
    );
  }

  // ============================================================
  // ACESSO NEGADO
  // ============================================================

  if (permissao === "denied") {
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
            <Shield size={30} />
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
              Você não possui permissão para acessar
              a tela de usuários.
            </p>
          </div>
        </section>
      </div>
    );
  }

  // ============================================================
  // PÁGINA NORMAL
  // ============================================================

  return (
    <div>
      <PageHeader
        title="Usuários"
        subtitle={`${filtrados.length} usuário(s) encontrado(s).`}
        action={
          <div className="header-actions">
            <button
              className="secondary"
              onClick={() => setLoading(true)}
              title="Atualizar"
            >
              <RefreshCw size={16} />
              Atualizar
            </button>

            <button
              className="primary"
              onClick={() => {
                setUsuarioSelecionado(null);
                setModal("novo");
              }}
            >
              <Plus size={17} />
              Novo usuário
            </button>
          </div>
        }
      />

      <section className="card">
        <div
          className="search"
          style={{ marginBottom: 18 }}
        >
          <Search size={17} />

          <input
            value={busca}
            onChange={(e) =>
              setBusca(e.target.value)
            }
            placeholder="Buscar por nome, usuário, telefone, região ou tipo..."
          />
        </div>

        {loading ? (
          <div className="empty">
            <Loader2 size={25} />
            Carregando usuários...
          </div>
        ) : filtrados.length === 0 ? (
          <div className="empty">
            <Users size={42} />

            <div>
              <strong>
                Nenhum usuário cadastrado
              </strong>

              <p>
                Crie um novo usuário para começar.
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {filtrados.map((usuario) => {
              const nome =
                usuario.nome?.trim() ||
                usuario.id;

              const inicial =
                nome.charAt(0).toUpperCase() ||
                "?";

              return (
                <button
                  key={usuario.id}
                  type="button"
                  onClick={() => {
                    setUsuarioSelecionado(usuario);
                    setModal("editar");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    width: "100%",
                    padding: 14,
                    background: "#fff",
                    border:
                      "1px solid #e5e7eb",
                    borderRadius: 12,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      minWidth: 46,
                      borderRadius: "50%",
                      display: "grid",
                      placeItems: "center",
                      background: "#fff8e1",
                      color: GOLD,
                      border:
                        "1px solid #ead38b",
                      fontWeight: 800,
                      fontSize: 17,
                    }}
                  >
                    {inicial}
                  </div>

                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {nome}
                    </div>

                    <div
                      style={{
                        fontSize: 13,
                        color: "#6b7280",
                        marginTop: 3,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {usuario.id}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 7,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 11,
                          padding:
                            "3px 8px",
                          borderRadius: 999,
                          background:
                            "#f3f4f6",
                          color: "#374151",
                        }}
                      >
                        {usuario.tipo ||
                          "entregador"}
                      </span>

                      {usuario.regiao && (
                        <span
                          style={{
                            fontSize: 11,
                            padding:
                              "3px 8px",
                            borderRadius: 999,
                            background:
                              "#eff6ff",
                            color: "#2563eb",
                          }}
                        >
                          {usuario.regiao}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight
                    size={20}
                    color="#9ca3af"
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {modal && (
        <UsuarioModal
          modo={modal}
          usuario={usuarioSelecionado}
          onClose={() => {
            setModal(null);
            setUsuarioSelecionado(null);
          }}
        />
      )}
    </div>
  );
}

function UsuarioModal({
  modo,
  usuario,
  onClose,
}: {
  modo: "novo" | "editar";
  usuario: UsuarioData | null;
  onClose: () => void;
}) {
  const [form, setForm] =
    useState<FormData>(novoFormulario());

  const [salvando, setSalvando] =
    useState(false);

  const [buscandoCep, setBuscandoCep] =
    useState(false);

  const [senhaVisivel, setSenhaVisivel] =
    useState(false);

  const [mensagem, setMensagem] =
    useState("");

  useEffect(() => {
    if (modo === "novo") {
      setForm(novoFormulario());
      return;
    }

    if (!usuario) return;

    const carregarGanhos = async () => {
      let ganhos: any = {};

      try {
        const snap = await getDoc(
          doc(
            db,
            "config_ganhos",
            usuario.id
          )
        );

        ganhos = snap.exists()
          ? snap.data()
          : {};
      } catch {
        ganhos = {};
      }

      setForm({
        usuario: usuario.id,
        senha: "",
        nome: usuario.nome || "",
        cpf: usuario.cpf || "",
        telefone: usuario.telefone || "",
        rua: usuario.rua || "",
        bairro: usuario.bairro || "",
        cep: usuario.cep || "",
        numero: usuario.numero || "",
        pix: usuario.pix || "",
        banco: usuario.banco || "",
        favorecido:
          usuario.favorecido || "",
        regiao: usuario.regiao || "",
        ml:
          ganhos.ml !== undefined
            ? String(ganhos.ml)
            : "",
        shopee:
          ganhos.shopee !== undefined
            ? String(ganhos.shopee)
            : "",
        avulso:
          ganhos.avulso !== undefined
            ? String(ganhos.avulso)
            : "",
        tipo:
          usuario.tipo || "entregador",
        permissoes: {
          ...permissoesVazias(),
          ...(usuario.permissoes || {}),
        },
      });
    };

    carregarGanhos();
  }, [modo, usuario]);

  const atualizar = (
    campo: keyof Omit<
      FormData,
      "permissoes"
    >,
    valor: any
  ) => {
    setForm((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  };

  const atualizarPermissao = (
    chave: keyof Permissoes,
    valor?: boolean
  ) => {
    setForm((anterior) => ({
      ...anterior,
      permissoes: {
        ...anterior.permissoes,
        [chave]:
          valor ??
          !anterior.permissoes[chave],
      },
    }));
  };

  const buscarCEP = async () => {
    const cep =
      form.cep.replace(/\D/g, "");

    if (cep.length !== 8) return;

    setBuscandoCep(true);

    try {
      const resposta =
        await fetch(
          `https://viacep.com.br/ws/${cep}/json/`
        );

      const data =
        await resposta.json();

      if (!data.erro) {
        setForm((anterior) => ({
          ...anterior,
          rua:
            data.logradouro ||
            anterior.rua,
          bairro:
            data.bairro ||
            anterior.bairro,
        }));
      }
    } catch {
      setMensagem(
        "Não foi possível buscar o CEP."
      );
    }

    setBuscandoCep(false);
  };

  const abrirWhatsApp = () => {
    const telefone =
      form.telefone.replace(
        /\D/g,
        ""
      );

    if (!telefone) {
      setMensagem(
        "Informe um telefone primeiro."
      );
      return;
    }

    window.open(
      `https://wa.me/55${telefone}`,
      "_blank"
    );
  };

  const salvar = async () => {
    setMensagem("");

    if (modo === "novo") {
      if (
        !form.usuario.trim() ||
        !form.senha.trim()
      ) {
        setMensagem(
          "Preencha usuário e senha."
        );
        return;
      }
    }

    setSalvando(true);

    try {
      const email =
        modo === "novo"
          ? formatarEmail(form.usuario)
          : usuario?.id ||
            form.usuario;

      const enderecoCompleto = [
        form.rua,
        form.numero,
        form.bairro,
      ]
        .filter(Boolean)
        .join(", ");

      const dadosUsuario = {
        email,
        nome: form.nome.trim(),
        cpf: form.cpf.trim(),
        telefone:
          form.telefone.trim(),
        rua: form.rua.trim(),
        bairro: form.bairro.trim(),
        cep: form.cep.trim(),
        numero:
          form.numero.trim(),
        endereco:
          enderecoCompleto,
        pix: form.pix.trim(),
        banco: form.banco.trim(),
        favorecido:
          form.favorecido.trim(),
        regiao:
          form.regiao.trim(),
        tipo: form.tipo,
        permissoes:
          form.tipo === "operador"
            ? form.permissoes
            : {},
      };

      if (modo === "novo") {
        await createUserWithEmailAndPassword(
          auth,
          email,
          form.senha.trim()
        );

        await setDoc(
          doc(
            db,
            "usuarios",
            email
          ),
          {
            ...dadosUsuario,
            dataCriacao:
              serverTimestamp(),
          }
        );
      } else {
        await updateDoc(
          doc(
            db,
            "usuarios",
            email
          ),
          dadosUsuario
        );

        if (
          form.senha.trim() &&
          auth.currentUser
        ) {
          await updatePassword(
            auth.currentUser,
            form.senha.trim()
          );
        }
      }

      await setDoc(
        doc(
          db,
          "config_ganhos",
          email
        ),
        {
          ml: numero(form.ml),
          shopee:
            numero(form.shopee),
          avulso:
            numero(form.avulso),
        },
        { merge: true }
      );

      setMensagem(
        modo === "novo"
          ? "Usuário criado com sucesso."
          : "Cadastro atualizado com sucesso."
      );

      setTimeout(
        onClose,
        800
      );
    } catch (error: any) {
      setMensagem(
        `Erro: ${
          error?.message ||
          error
        }`
      );
    }

    setSalvando(false);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background:
          "rgba(17,24,39,.45)",
        overflowY: "auto",
        padding: 20,
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "20px auto",
          background: "#fff",
          borderRadius: 18,
          boxShadow:
            "0 20px 60px rgba(0,0,0,.2)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding:
              "18px 22px",
            borderBottom:
              "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>
              {modo === "novo"
                ? "Criar usuário"
                : "Cadastro de usuário"}
            </h2>

            <small
              style={{
                color: "#6b7280",
              }}
            >
              Dados, permissões e
              valores por pacote.
            </small>
          </div>

          <button
            className="secondary"
            onClick={onClose}
            style={{ padding: 8 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 22 }}>
          {mensagem && (
            <div
              style={{
                padding: 12,
                marginBottom: 18,
                borderRadius: 10,
                background:
                  mensagem.startsWith(
                    "Erro"
                  )
                    ? "#fef2f2"
                    : "#f0fdf4",
                color:
                  mensagem.startsWith(
                    "Erro"
                  )
                    ? "#b91c1c"
                    : "#166534",
              }}
            >
              {mensagem}
            </div>
          )}

          <Secao titulo="Acesso">
            <div className="form-grid">
              <Campo
                label={
                  modo === "novo"
                    ? "Usuário"
                    : "Usuário / E-mail"
                }
                value={
                  form.usuario
                }
                disabled={
                  modo === "editar"
                }
                placeholder={
                  modo === "novo"
                    ? "Exemplo: joao"
                    : ""
                }
                onChange={(v) =>
                  atualizar(
                    "usuario",
                    v
                  )
                }
                help={
                  modo === "novo"
                    ? "Será criado com @gavioes.com automaticamente."
                    : undefined
                }
              />

              <CampoSenha
                label={
                  modo === "novo"
                    ? "Senha"
                    : "Nova senha (opcional)"
                }
                value={form.senha}
                visible={
                  senhaVisivel
                }
                onVisible={() =>
                  setSenhaVisivel(
                    (v) => !v
                  )
                }
                onChange={(v) =>
                  atualizar(
                    "senha",
                    v
                  )
                }
              />

              <Campo
                label="Região de entrega"
                value={
                  form.regiao
                }
                onChange={(v) =>
                  atualizar(
                    "regiao",
                    v
                  )
                }
              />
            </div>
          </Secao>

          <Secao titulo="Dados pessoais">
            <div className="form-grid">
              <Campo
                label="Nome"
                value={form.nome}
                onChange={(v) =>
                  atualizar(
                    "nome",
                    v
                  )
                }
              />

              <Campo
                label="CPF"
                value={form.cpf}
                inputMode="numeric"
                onChange={(v) =>
                  atualizar(
                    "cpf",
                    v
                  )
                }
              />

              <div>
                <label className="field-label">
                  Telefone / WhatsApp
                </label>

                <div
                  style={{
                    display:
                      "flex",
                    gap: 8,
                  }}
                >
                  <input
                    value={
                      form.telefone
                    }
                    onChange={(e) =>
                      atualizar(
                        "telefone",
                        e.target.value
                      )
                    }
                    placeholder="Telefone"
                    style={{
                      flex: 1,
                    }}
                  />

                  <button
                    type="button"
                    onClick={
                      abrirWhatsApp
                    }
                    style={{
                      minWidth: 48,
                      border: 0,
                      borderRadius: 9,
                      background:
                        "#25D366",
                      color: "#fff",
                      cursor:
                        "pointer",
                    }}
                    title="Abrir WhatsApp"
                  >
                    <MessageCircle
                      size={20}
                    />
                  </button>
                </div>
              </div>
            </div>
          </Secao>

          <Secao titulo="Endereço">
            <div className="form-grid">
              <div>
                <label className="field-label">
                  CEP
                </label>

                <div
                  style={{
                    display:
                      "flex",
                    gap: 8,
                  }}
                >
                  <input
                    value={
                      form.cep
                    }
                    inputMode="numeric"
                    onChange={(e) =>
                      atualizar(
                        "cep",
                        e.target.value
                      )
                    }
                    onBlur={
                      buscarCEP
                    }
                    placeholder="00000000"
                    style={{
                      flex: 1,
                    }}
                  />

                  <button
                    type="button"
                    className="secondary"
                    onClick={
                      buscarCEP
                    }
                    disabled={
                      buscandoCep
                    }
                  >
                    {buscandoCep ? (
                      <Loader2
                        size={16}
                      />
                    ) : (
                      <Search
                        size={16}
                      />
                    )}
                  </button>
                </div>
              </div>

              <Campo
                label="Rua"
                value={form.rua}
                onChange={(v) =>
                  atualizar(
                    "rua",
                    v
                  )
                }
              />

              <Campo
                label="Número"
                value={
                  form.numero
                }
                onChange={(v) =>
                  atualizar(
                    "numero",
                    v
                  )
                }
              />

              <Campo
                label="Bairro"
                value={
                  form.bairro
                }
                onChange={(v) =>
                  atualizar(
                    "bairro",
                    v
                  )
                }
              />
            </div>
          </Secao>

          <Secao titulo="Financeiro">
            <div className="form-grid">
              <Campo
                label="Pix"
                value={form.pix}
                onChange={(v) =>
                  atualizar(
                    "pix",
                    v
                  )
                }
              />

              <Campo
                label="Banco"
                value={form.banco}
                onChange={(v) =>
                  atualizar(
                    "banco",
                    v
                  )
                }
              />

              <Campo
                label="Favorecido"
                value={
                  form.favorecido
                }
                onChange={(v) =>
                  atualizar(
                    "favorecido",
                    v
                  )
                }
              />
            </div>
          </Secao>

          <Secao titulo="Valores por pacote">
            <div className="form-grid">
              <Campo
                label="Mercado Livre (R$ por pacote)"
                value={form.ml}
                inputMode="decimal"
                onChange={(v) =>
                  atualizar(
                    "ml",
                    v
                  )
                }
              />

              <Campo
                label="Shopee (R$ por pacote)"
                value={
                  form.shopee
                }
                inputMode="decimal"
                onChange={(v) =>
                  atualizar(
                    "shopee",
                    v
                  )
                }
              />

              <Campo
                label="Avulso (R$ por pacote)"
                value={
                  form.avulso
                }
                inputMode="decimal"
                onChange={(v) =>
                  atualizar(
                    "avulso",
                    v
                  )
                }
              />
            </div>
          </Secao>

          <Secao titulo="Tipo e permissões">
            <div
              style={{
                display:
                  "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              <TipoBotao
                ativo={
                  form.tipo ===
                  "admin"
                }
                icone={
                  <Shield
                    size={20}
                  />
                }
                titulo="Administrador"
                onClick={() =>
                  atualizar(
                    "tipo",
                    "admin"
                  )
                }
              />

              <TipoBotao
                ativo={
                  form.tipo ===
                  "operador"
                }
                icone={
                  <UserCog
                    size={20}
                  />
                }
                titulo="Operador"
                onClick={() =>
                  atualizar(
                    "tipo",
                    "operador"
                  )
                }
              />

              <TipoBotao
                ativo={
                  form.tipo ===
                  "entregador"
                }
                icone={
                  <Users
                    size={20}
                  />
                }
                titulo="Entregador"
                onClick={() =>
                  atualizar(
                    "tipo",
                    "entregador"
                  )
                }
              />
            </div>

            {form.tipo ===
              "admin" && (
              <InfoTipo
                texto="Acesso total ao aplicativo. Não precisa de permissões individuais."
              />
            )}

            {form.tipo ===
              "entregador" && (
              <InfoTipo
                texto="Acesso apenas ao painel de entregas."
              />
            )}

            {form.tipo ===
              "operador" && (
              <div
                style={{
                  marginTop: 18,
                  padding: 16,
                  border:
                    "1px solid #e5e7eb",
                  borderRadius: 12,
                  background:
                    "#fafafa",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    alignItems:
                      "center",
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <strong>
                      Permissões de acesso
                    </strong>

                    <div
                      style={{
                        fontSize: 12,
                        color:
                          "#6b7280",
                        marginTop: 3,
                      }}
                    >
                      Cada item corresponde a uma opção do Menu Admin.
                    </div>
                  </div>

                  <div
                    style={{
                      display:
                        "flex",
                      gap: 10,
                    }}
                  >
                    <button
                      type="button"
                      className="link"
                      onClick={() => {
                        setForm(
                          (
                            anterior
                          ) => ({
                            ...anterior,
                            permissoes:
                              Object.keys(
                                anterior.permissoes
                              ).reduce(
                                (
                                  resultado,
                                  chave
                                ) => ({
                                  ...resultado,
                                  [chave]:
                                    true,
                                }),
                                {} as Permissoes
                              ),
                          })
                        );
                      }}
                    >
                      Todas
                    </button>

                    <button
                      type="button"
                      className="link"
                      onClick={() =>
                        setForm(
                          (
                            anterior
                          ) => ({
                            ...anterior,
                            permissoes:
                              permissoesVazias(),
                          })
                        )
                      }
                    >
                      Nenhuma
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  {(
                    Object.keys(
                      LABELS
                    ) as (
                      | keyof Permissoes
                    )[]
                  ).map(
                    (chave) => {
                      const ativo =
                        form
                          .permissoes[
                          chave
                        ];

                      return (
                        <button
                          key={
                            chave
                          }
                          type="button"
                          onClick={() =>
                            atualizarPermissao(
                              chave
                            )
                          }
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 9,
                            padding:
                              "11px 12px",
                            textAlign:
                              "left",
                            cursor:
                              "pointer",
                            border:
                              `1px solid ${
                                ativo
                                  ? "#d8bd5b"
                                  : "#e5e7eb"
                              }`,
                            background:
                              ativo
                                ? "#fff9e5"
                                : "#fff",
                          }}
                        >
                          <span
                            style={{
                              width: 19,
                              height: 19,
                              display:
                                "grid",
                              placeItems:
                                "center",
                              borderRadius:
                                5,
                              background:
                                ativo
                                  ? GOLD
                                  : "#fff",
                              border:
                                `1px solid ${
                                  ativo
                                    ? GOLD
                                    : "#9ca3af"
                                }`,
                              color:
                                "#000",
                            }}
                          >
                            {ativo && (
                              <Check
                                size={
                                  13
                                }
                              />
                            )}
                          </span>

                          <span
                            style={{
                              fontSize:
                                13,
                              color:
                                ativo
                                  ? "#111827"
                                  : "#6b7280",
                            }}
                          >
                            {
                              LABELS[
                                chave
                              ]
                            }
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>
            )}
          </Secao>

          <div
            style={{
              display:
                "flex",
              justifyContent:
                "flex-end",
              gap: 10,
              marginTop: 28,
              paddingTop: 20,
              borderTop:
                "1px solid #e5e7eb",
            }}
          >
            <button
              type="button"
              className="secondary"
              onClick={
                onClose
              }
              disabled={
                salvando
              }
            >
              Cancelar
            </button>

            <button
              type="button"
              className="primary"
              onClick={
                salvar
              }
              disabled={
                salvando
              }
            >
              {salvando ? (
                <>
                  <Loader2
                    size={16}
                  />
                  Salvando...
                </>
              ) : modo ===
                "novo" ? (
                <>
                  <Plus
                    size={16}
                  />
                  Criar usuário
                </>
              ) : (
                <>
                  <Edit3
                    size={16}
                  />
                  Alterar cadastro
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Secao({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        marginBottom: 26,
      }}
    >
      <h3
        style={{
          color: GOLD,
          fontSize: 12,
          letterSpacing: 1.2,
          textTransform:
            "uppercase",
          margin:
            "0 0 12px",
        }}
      >
        {titulo}
      </h3>

      {children}
    </section>
  );
}

function Campo({
  label,
  value,
  onChange,
  placeholder,
  help,
  disabled,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (
    valor: string
  ) => void;
  placeholder?: string;
  help?: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <div>
      <label className="field-label">
        {label}
      </label>

      <input
        value={value}
        placeholder={
          placeholder
        }
        disabled={
          disabled
        }
        inputMode={
          inputMode
        }
        onChange={(e) =>
          onChange(
            e.target.value
          )
        }
      />

      {help && (
        <small
          style={{
            display:
              "block",
            marginTop: 4,
            color:
              "#6b7280",
          }}
        >
          {help}
        </small>
      )}
    </div>
  );
}

function CampoSenha({
  label,
  value,
  visible,
  onVisible,
  onChange,
}: {
  label: string;
  value: string;
  visible: boolean;
  onVisible: () => void;
  onChange: (
    valor: string
  ) => void;
}) {
  return (
    <div>
      <label className="field-label">
        {label}
      </label>

      <div
        style={{
          display:
            "flex",
          gap: 8,
        }}
      >
        <input
          type={
            visible
              ? "text"
              : "password"
          }
          value={value}
          onChange={(e) =>
            onChange(
              e.target.value
            )
          }
          style={{
            flex: 1,
          }}
        />

        <button
          type="button"
          className="secondary"
          onClick={
            onVisible
          }
          title={
            visible
              ? "Ocultar senha"
              : "Mostrar senha"
          }
        >
          {visible ? (
            <EyeOff
              size={17}
            />
          ) : (
            <Eye
              size={17}
            />
          )}
        </button>
      </div>
    </div>
  );
}

function TipoBotao({
  ativo,
  icone,
  titulo,
  onClick,
}: {
  ativo: boolean;
  icone: React.ReactNode;
  titulo: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 14,
        borderRadius: 10,
        cursor:
          "pointer",
        border:
          `1px solid ${
            ativo
              ? GOLD
              : "#e5e7eb"
          }`,
        background:
          ativo
            ? "#fff9e5"
            : "#fff",
        color:
          ativo
            ? "#8a6d00"
            : "#6b7280",
      }}
    >
      <div
        style={{
          display:
            "flex",
          flexDirection:
            "column",
          alignItems:
            "center",
          gap: 7,
        }}
      >
        {icone}

        <strong
          style={{
            fontSize: 12,
          }}
        >
          {titulo}
        </strong>
      </div>
    </button>
  );
}

function InfoTipo({
  texto,
}: {
  texto: string;
}) {
  return (
    <div
      style={{
        marginTop: 15,
        padding: 13,
        borderRadius: 10,
        background:
          "#f9fafb",
        border:
          "1px solid #e5e7eb",
        color:
          "#4b5563",
        fontSize: 13,
      }}
    >
      {texto}
    </div>
  );
}