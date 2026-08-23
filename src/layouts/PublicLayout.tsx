import { Outlet, Link } from 'react-router-dom';
import { ROUTES } from '../routes/paths';

export default function PublicLayout() {
  return (
    <div>
      <header>
        <Link to={ROUTES.public.home}>
          <strong>ÁGUIA EXPRESS</strong>
        </Link>

        <nav>
          <Link to={ROUTES.public.home}>Início</Link>
          <Link to={ROUTES.public.servicos}>Serviços</Link>
          <Link to={ROUTES.public.rastreamento}>
            Rastreamento
          </Link>
          <Link to={ROUTES.public.blog}>Blog</Link>
          <Link to={ROUTES.public.contato}>Contato</Link>
          <Link to={ROUTES.auth.login}>Entrar</Link>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        <strong>Águia Express</strong>
        <span>Logística e entregas</span>
      </footer>
    </div>
  );
}