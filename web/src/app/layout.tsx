import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus_Jakarta_Sans, Playfair_Display } from 'next/font/google';
import './globals.css';
import { NavUser } from '@/components/nav-user';

const sans = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });
const serif = Playfair_Display({ subsets: ['latin'], weight: ['600'], variable: '--font-serif' });

export const metadata: Metadata = {
  title: 'LexiGuard AI',
  description: 'Legal AI SaaS for contract review, risk detection and governance.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={${sans.variable} }>
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        <div className="relative min-h-screen bg-gradient-to-b from-slate-950 via-slate-930 to-slate-900">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.2),_transparent_60%)]" />
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
              <div className="flex items-center gap-10">
                <Link href="/" className="text-2xl font-semibold text-white transition hover:text-cyan-300">
                  Lexi<span className="text-cyan-300">Guard</span>
                </Link>
                <nav className="hidden items-center gap-6 text-sm text-slate-200 md:flex">
                  <Link className="hover:text-cyan-300" href="/contracts">
                    合同监控
                  </Link>
                  <Link className="hover:text-cyan-300" href="/upload">
                    上传审阅
                  </Link>
                </nav>
              </div>
              {/* @ts-expect-error Async Server Component */}
              <NavUser />
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-6 py-12">{children}</main>
        </div>
      </body>
    </html>
  );
}
