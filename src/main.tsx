// ARQUIVO: src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";
import "leaflet/dist/leaflet.css";

class AppErrorBoundary extends React.Component<{children: React.ReactNode}, {error: string}> {
  state = { error: "" };
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
  render() {
    if (this.state.error) {
      return <div style={{padding:32,fontFamily:"Arial,sans-serif"}}>
        <h2>Erro ao carregar Águia Express</h2>
        <p>{this.state.error}</p>
      </div>;
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>
);
