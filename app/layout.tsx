import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, IBM_Plex_Serif } from "next/font/google";
import "./globals.css";

const sans  = IBM_Plex_Sans ({
  subsets: ["latin"],
  weight:  ["400", "500", "600", "700"],
  variable: "--font-sans",
});
const mono  = IBM_Plex_Mono ({
  subsets: ["latin"],
  weight:  ["400", "500", "600"],
  variable: "--font-mono",
});
const serif = IBM_Plex_Serif({
  subsets: ["latin"],
  weight:  ["400", "500", "600"],
  variable: "--font-serif",
});

export const metadata: Metadata = {
  title: "A11yBot",
  description: "VPAT 2.5 Accessibility Conformance Report generator",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FBFCFD" },
    { media: "(prefers-color-scheme: dark)",  color: "#0B1320" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var s=localStorage.getItem('a11ybot-theme');var p=window.matchMedia('(prefers-color-scheme: dark)').matches;var t=s||(p?'dark':'light');if(t==='dark')document.documentElement.classList.add('dark');document.documentElement.dataset.theme=t;}catch(e){}})();` }} />
      </head>
      <body className="min-h-screen bg-surface text-ink-2 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
