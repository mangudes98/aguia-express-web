import { Outlet } from 'react-router-dom';

interface PanelLayoutProps {
  title: string;
  subtitle?: string;
}

export default function PanelLayout({
  title,
  subtitle,
}: PanelLayoutProps) {
  return (
    <div>
      <header>
        <strong>ÁGUIA EXPRESS</strong>

        <div>
          <h1>{title}</h1>

          {subtitle && <p>{subtitle}</p>}
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}