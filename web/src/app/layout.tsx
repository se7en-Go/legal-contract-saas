import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Legal AI Contracts Dashboard',
  description: 'Upload contracts, monitor tasks and review AI findings.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang=\"en\">
      <body className=\"min-h-screen bg-slate-50 text-slate-900\">
        <div className=\"border-b bg-white shadow-sm\">
          <div className=\"mx-auto flex max-w-5xl items-center justify-between px-4 py-3\">
            <Link href=\"/\" className=\"text-lg font-semibold\">
              Legal AI Review
            </Link>
            <nav className=\"flex gap-4 text-sm\">
              <Link className=\"hover:text-blue-600\" href=\"/contracts\">
                Contracts
              </Link>
              <Link className=\"hover:text-blue-600\" href=\"/upload\">
                Upload
              </Link>
            </nav>
          </div>
        </div>
        <main className=\"mx-auto max-w-5xl px-4 py-10\">{children}</main>
      </body>
    </html>
  );
}
