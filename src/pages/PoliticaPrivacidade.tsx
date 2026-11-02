import { useEffect } from "react";
import { Link } from "react-router-dom";
import "./PoliticaPrivacidade.css";

const sections = [
  { id: "responsavel", label: "Responsável e escopo" },
  { id: "dados", label: "Dados tratados" },
  { id: "finalidades", label: "Como usamos os dados" },
  { id: "localizacao", label: "Localização" },
  { id: "armazenamento", label: "Armazenamento e segurança" },
  { id: "compartilhamento", label: "Compartilhamento" },
  { id: "retencao", label: "Retenção e exclusão" },
  { id: "direitos", label: "Seus direitos" },
];

export default function PoliticaPrivacidade() {
  useEffect(() => {
    document.title = "Política de Privacidade | Águia Express";

    let description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    );
    const created = !description;
    if (!description) {
      description = document.createElement("meta");
      description.name = "description";
      document.head.appendChild(description);
    }
    const previousDescription = description.content;
    description.content =
      "Saiba como o aplicativo Águia Express trata dados de usuários, entregas, localização e comprovantes.";

    return () => {
      document.title = "Águia Express";
      if (description) {
        if (created) description.remove();
        else description.content = previousDescription;
      }
    };
  }, []);

  return (
    <main className="privacy-page">
      <header className="privacy-header">
        <Link className="privacy-brand" to="/" aria-label="Águia Express — início">
          <span className="privacy-brand-mark" aria-hidden="true">Á</span>
          <span>
            <strong>ÁGUIA EXPRESS</strong>
            <small>LOGÍSTICA E ENTREGAS</small>
          </span>
        </Link>
        <Link className="privacy-home-link" to="/">
          Voltar ao site
        </Link>
      </header>

      <section className="privacy-hero">
        <div className="privacy-hero-inner">
          <span className="privacy-eyebrow">TRANSPARÊNCIA E PROTEÇÃO DE DADOS</span>
          <h1>Política de Privacidade</h1>
          <p>
            Entenda quais informações são tratadas nos aplicativos Águia
            Express, por que são necessárias e como você pode solicitar acesso,
            correção ou exclusão.
          </p>
          <div className="privacy-updated">
            <span className="privacy-status-dot" />
            Última atualização: 2 de novembro de 2026
          </div>
        </div>
      </section>

      <div className="privacy-layout">
        <aside className="privacy-toc" aria-label="Nesta política">
          <strong>Nesta política</strong>
          <nav>
            {sections.map((section) => (
              <a key={section.id} href={`#${section.id}`}>
                {section.label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="privacy-content">
          <div className="privacy-intro">
            <span className="privacy-intro-icon" aria-hidden="true">i</span>
            <p>
              Esta política se aplica aos aplicativos Águia Express usados nas
              operações de entrega e coleta, incluindo os recursos de
              rastreamento, comprovantes e ocorrências. O tratamento é limitado
              ao necessário para prestar e administrar esses serviços.
            </p>
          </div>

          <section id="responsavel">
            <h2>1. Responsável e escopo</h2>
            <p>
              A Águia Express é responsável pelo tratamento dos dados pessoais
              realizado no contexto de suas operações e aplicativos. Esta
              política abrange entregadores, operadores, administradores,
              empresas atendidas e pessoas que recebem encomendas.
            </p>
            <p>
              Os aplicativos são ferramentas operacionais. Os dados podem ser
              inseridos pelo próprio usuário, registrados durante uma entrega
              ou coleta, ou recebidos de empresas que encaminham encomendas
              para a operação.
            </p>
          </section>

          <section id="dados">
            <h2>2. Dados que podem ser tratados</h2>
            <ul>
              <li>
                <strong>Conta e acesso:</strong> nome, e-mail, telefone,
                identificador de usuário, função, permissões e informações
                necessárias para autenticação e segurança da conta.
              </li>
              <li>
                <strong>Operação e encomendas:</strong> códigos e identificadores
                de pacotes, empresa e transportadora, status, datas, horários,
                pastas, histórico de movimentações e informações de rota.
              </li>
              <li>
                <strong>Destinatários:</strong> nome e, quando necessário para
                confirmar a entrega, contato, documento ou outras informações
                fornecidas no comprovante.
              </li>
              <li>
                <strong>Fotos e comprovantes:</strong> imagens registradas para
                comprovar uma entrega, coleta, devolução ou ocorrência, além dos
                dados informados junto ao comprovante, como recebedor e
                observações.
              </li>
              <li>
                <strong>Localização:</strong> posição do dispositivo e dados
                relacionados à rota, quando o recurso de mapa ou navegação é
                usado e a permissão de localização foi concedida.
              </li>
              <li>
                <strong>Dados técnicos:</strong> informações necessárias ao
                funcionamento do aplicativo, como identificadores de sessão e
                dispositivo, registros de falhas e token de notificações.
              </li>
            </ul>
          </section>

          <section id="finalidades">
            <h2>3. Como usamos os dados</h2>
            <p>Os dados são usados para:</p>
            <ul>
              <li>criar e proteger contas e aplicar permissões de acesso;</li>
              <li>organizar coletas, entregas, devoluções e transferências;</li>
              <li>localizar encomendas e apresentar seu status e histórico;</li>
              <li>planejar rotas e apoiar a execução das entregas;</li>
              <li>
                registrar e verificar comprovantes, identificar o recebedor e
                tratar ocorrências ou divergências;
              </li>
              <li>
                prestar suporte, enviar avisos operacionais e manter a
                segurança, a integridade e a auditoria da operação;
              </li>
              <li>
                cumprir obrigações legais, regulatórias e contratuais e exercer
                direitos em processos administrativos ou judiciais.
              </li>
            </ul>
            <p>
              O tratamento pode se basear na execução de serviços e contratos,
              no cumprimento de obrigações legais, no legítimo interesse
              relacionado à segurança e à operação, ou no consentimento quando
              ele for necessário, como para permissões do dispositivo.
            </p>
          </section>

          <section id="localizacao">
            <h2>4. Localização e rastreamento</h2>
            <p>
              O aplicativo pode solicitar acesso à localização para exibir a
              posição atual, apoiar navegação e planejamento de rotas e
              relacionar eventos da operação ao trajeto. A coleta depende das
              permissões do sistema e do uso do recurso correspondente.
            </p>
            <p>
              Quando a navegação estiver em execução, o aplicativo pode receber
              atualizações de posição para manter a rota funcional. Você pode
              revisar ou revogar a permissão nas configurações do dispositivo;
              isso pode limitar os recursos que dependem da localização.
            </p>
            <p>
              O rastreamento de encomendas usa principalmente seus códigos,
              status e registros de movimentação. A localização do entregador
              não é apresentada como rastreamento público da encomenda, salvo
              quando um recurso operacional específico indicar isso.
            </p>
          </section>

          <section id="armazenamento">
            <h2>5. Armazenamento e segurança</h2>
            <p>
              Os aplicativos utilizam serviços Firebase/Google, incluindo
              Firebase Authentication para acesso, Cloud Firestore para dados
              operacionais e Firebase Storage para arquivos como fotos e
              comprovantes. As configurações do projeto determinam a região e
              os controles aplicáveis a esses serviços.
            </p>
            <p>
              A Águia Express adota controles técnicos e administrativos
              compatíveis com o uso do sistema, incluindo autenticação e
              permissões por função. O acesso a informações operacionais deve
              ficar restrito a pessoas que precisam delas para suas atividades.
              Nenhum sistema é capaz de garantir segurança absoluta.
            </p>
          </section>

          <section id="compartilhamento">
            <h2>6. Compartilhamento de dados</h2>
            <p>
              Os dados podem ser compartilhados somente na medida necessária:
            </p>
            <ul>
              <li>
                com entregadores e operadores responsáveis pela encomenda ou
                pela ocorrência;
              </li>
              <li>
                com a empresa remetente ou atendida, para acompanhar a operação,
                confirmar resultados e tratar divergências;
              </li>
              <li>
                com Firebase/Google e outros fornecedores que apoiem
                hospedagem, armazenamento, autenticação, mapas ou notificações;
              </li>
              <li>
                com autoridades ou terceiros, quando houver obrigação legal,
                ordem válida ou necessidade de proteger direitos e segurança.
              </li>
            </ul>
            <p>
              A Águia Express não vende dados pessoais. Os fornecedores
              tecnológicos recebem apenas o acesso necessário para prestar os
              serviços contratados e podem tratar dados conforme seus próprios
              termos e políticas.
            </p>
          </section>

          <section id="retencao">
            <h2>7. Retenção e exclusão</h2>
            <p>
              Os dados são mantidos pelo tempo necessário para executar a
              operação, conservar o histórico de entregas, prestar suporte,
              investigar ocorrências e cumprir obrigações legais ou contratuais.
              O prazo pode variar conforme o tipo de registro e as regras
              aplicáveis.
            </p>
            <p>
              Quando não houver mais necessidade de uso, os dados serão
              excluídos ou anonimizados, observadas as obrigações de conservação
              e os prazos técnicos de expiração de cópias de segurança.
            </p>
            <p>
              Para solicitar exclusão ou encerramento de conta, entre em contato
              pelo canal oficial de atendimento da Águia Express utilizado no
              seu cadastro ou atendimento. Informe o e-mail ou identificador da
              conta e o tipo de solicitação; nunca envie sua senha. Alguns
              registros operacionais poderão ser conservados quando a lei ou a
              defesa de direitos exigir.
            </p>
          </section>

          <section id="direitos">
            <h2>8. Seus direitos</h2>
            <p>
              De acordo com a legislação aplicável, inclusive a Lei Geral de
              Proteção de Dados (LGPD), você pode solicitar confirmação do
              tratamento, acesso, correção de dados incompletos ou
              desatualizados, informação sobre compartilhamento, portabilidade
              quando aplicável, anonimização, bloqueio ou exclusão de dados
              desnecessários, além de revogar consentimentos quando essa for a
              base do tratamento.
            </p>
            <p>
              Para proteger os titulares, poderemos solicitar informações
              suficientes para confirmar a identidade e a legitimidade do
              pedido. A resposta pode estar sujeita a limites legais e à
              preservação de registros necessários à operação.
            </p>
          </section>

          <section id="terceiros">
            <h2>9. Dados de outras pessoas</h2>
            <p>
              Usuários que registram dados de destinatários ou de terceiros
              devem fazê-lo apenas para fins da entrega, coleta ou atendimento
              relacionado. Essas informações não devem ser reutilizadas para
              finalidades incompatíveis com a operação.
            </p>
          </section>

          <section id="alteracoes">
            <h2>10. Alterações nesta política</h2>
            <p>
              Esta política poderá ser atualizada para refletir mudanças nos
              aplicativos, nos serviços ou nas exigências legais. A versão
              vigente estará disponível nesta página, com a data da última
              atualização.
            </p>
          </section>

          <div className="privacy-footer-note">
            <strong>Águia Express</strong>
            <span>Esta página é pública e pode ser consultada sem entrar na conta.</span>
          </div>
        </article>
      </div>

      <footer className="privacy-footer">
        <span>© Águia Express</span>
        <Link to="/">Página inicial</Link>
      </footer>
    </main>
  );
}
