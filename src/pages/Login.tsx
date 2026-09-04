// ARQUIVO: src/pages/Login.tsx
import { FormEvent, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase/firebase";

const DOMINIO_LOGIN = "@gavioes.com";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setErro(""); setBusy(true);
    try {
  const identificador = email.trim().toLowerCase();
  const emailLogin = identificador.includes("@")
    ? identificador
    : `${identificador}${DOMINIO_LOGIN}`;

  await login(emailLogin, senha);

  const usuario = auth.currentUser;

  if (!usuario) {
    throw new Error("Usuário não encontrado.");
  }

  let userDoc = await getDoc(
    doc(db, "usuarios", usuario.uid)
  );

  if (!userDoc.exists() && usuario.email) {
    userDoc = await getDoc(
      doc(db, "usuarios", usuario.email.toLowerCase())
    );
  }

  if (!userDoc.exists()) {
    throw new Error("Cadastro do usuário não encontrado.");
  }

  const userData = userDoc.data();

  if (userData?.tipo === "admin") {
    navigate("/dashboard", { replace: true });
  } else if (userData?.tipo === "empresa") {
    navigate("/empresas", { replace: true });
  } else if (userData?.tipo === "operador") {
    navigate("/empresas", { replace: true });
  } else {
    navigate("/dashboard", { replace: true });
  }

}
    catch { setErro("E-mail ou senha inválidos."); }
    finally { setBusy(false); }
  }

  return <div className="login-screen">
     <div
       className="login-brand"
       style={{
         display: "flex",
         flexDirection: "column",
         alignItems: "center",
         textAlign: "center",
       }}
     >
       <div
         className="login-logo"
         style={{
           display: "flex",
           justifyContent: "center",
           width: "100%",
           height: "auto",
           position: "relative",
         }}
       >
         <img
           src={logo}
           alt="Águia Express"
           style={{
             display: "block",
             width: "280px",
             height: "280px",
             maxWidth: "90vw",
             flexShrink: 0,
             objectFit: "contain",
           }}
         />
       </div>
       <p
         style={{
           margin: "12px 0 0",
           position: "relative",
           zIndex: 1,
         }}
       >
         Gestão inteligente de entregas.
       </p>
     </div>
    <form className="login-card" onSubmit={submit}>
      <h2>Bem-vindo</h2><p>Acesse o painel da Águia Express.</p>
       <label>
         Usuário ou e-mail
         <input
           value={email}
           onChange={e => setEmail(e.target.value)}
           type="text"
           required
           autoComplete="username"
           placeholder="seu usuario aqui"
         />
       </label>
      <label>Senha<input value={senha} onChange={e => setSenha(e.target.value)} type="password" required placeholder="••••••••"/></label>
      {erro && <div className="error-box">{erro}</div>}
      <button className="primary full" disabled={busy}>{busy ? "Entrando..." : "Entrar"}</button>
    </form>
  </div>;
}
