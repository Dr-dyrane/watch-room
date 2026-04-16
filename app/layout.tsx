import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Private Watch Room',
  description: 'Single-room Netflix companion UI starter with Chrome extension handshake.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
