import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WaOPS — Wasync Operations Platform',
  description: 'SaaS multi-tenant de observabilidade e operações',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
