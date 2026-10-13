import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Oferta Tech AI — Ofertas para WhatsApp', description: 'Organize links de afiliados, revise produtos e prepare ofertas de tecnologia para seu grupo.', manifest: '/manifest.webmanifest', icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' }, appleWebApp: { capable: true, title: 'Oferta Tech AI', statusBarStyle: 'black-translucent' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#0c1220' };
export default function Layout({ children }: {
    children: React.ReactNode;
}) { return <html lang="pt-BR"><body>{children}</body></html>; }

