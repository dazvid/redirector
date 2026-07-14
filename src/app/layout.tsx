import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { getViewer } from "@/lib/auth";
import "./globals.css";

// Self-hosted at build time by next/font — no runtime request to Google Fonts.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "go/links",
  description: "Keyword shortcuts that redirect to saved URLs",
};

// Runs before paint so the saved (or system) theme applies with no flash.
// Defaults to dark — Nocturne is a dark-ground system.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var theme = stored || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {}
})();
`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getViewer();

  return (
    <html lang="en" className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <header className="site">
          <div className="inner">
            <Link href="/" className="brand">
              <span className="brandmark brandmark-sm">go</span>
              <span>
                go<span className="brand-muted">/links</span>
              </span>
            </Link>
            <nav className="site-nav">
              {viewer ? (
                <>
                  <Link href="/admin">Manage</Link>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link href="/login">Sign in</Link>
                  <Link href="/signup">Sign up</Link>
                </>
              )}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
