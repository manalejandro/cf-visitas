import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

const siteUrl = "https://visitas.manalejandro.com";
const siteName = "Visitas";
const description =
  "Privacy-first web analytics: client-side encrypted visits, fingerprint-based blocking and a real-time dashboard — powered by Cloudflare Workers and D1.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Visitas — Web Analytics",
    template: "%s · Visitas",
  },
  description,
  applicationName: siteName,
  keywords: ["web analytics", "privacy", "Cloudflare Workers", "D1", "fingerprinting", "visits"],
  authors: [{ name: "manalejandro", url: "https://github.com/manalejandro" }],
  creator: "manalejandro",
  publisher: "manalejandro",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName,
    title: "Visitas — Web Analytics",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Visitas — Web Analytics",
    description,
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "48x48" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#05070d" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

/** Reads the per-request CSP nonce so the theme bootstrap script is allowed. */
async function getScriptNonce(): Promise<string | undefined> {
  try {
    const requestHeaders = await headers();
    const policy =
      requestHeaders.get("content-security-policy") ?? requestHeaders.get("content-security-policy-report-only") ?? "";
    return /'nonce-([^']+)'/.exec(policy)?.[1];
  } catch {
    return undefined;
  }
}

const THEME_BOOTSTRAP = `try{if(localStorage.getItem("visitas-theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}`;

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = await getScriptNonce();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
