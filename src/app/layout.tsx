import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-poppins' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Catalogue eSIM en chiffres · MyBestSim',
  description: 'Tableau de bord des offres eSIM de 18 fournisseurs : prix, data, répartition et comparatif.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${poppins.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
