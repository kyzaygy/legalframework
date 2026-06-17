import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TopBar } from "@/components/TopBar";

const siteUrl = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "Legal Framework",
  title: {
    default: "Кодексы и Конституция РФ — бесплатно, в действующей редакции",
    template: "%s — Кодексы РФ",
  },
  description:
    "Все действующие кодексы Российской Федерации и Конституция в актуальной редакции. Поиск статьи по номеру и по слову из закона.",
  appleWebApp: {
    capable: true,
    title: "Legal Framework",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/app-icon-512.png",
    apple: "/app-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#6E2433",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <TopBar />
        <main>{children}</main>
        <footer className="foot">
          <span className="foot-note">
            Источник текстов — официальный портал pravo.gov.ru, действующая редакция.
          </span>
          <span className="foot-note">
            Сайт не является официальным опубликованием правовых актов. При принятии решений
            сверяйтесь с первоисточником.
          </span>
          <span className="foot-copy">© 2026 Legal Framework · дизайн и оформление</span>
        </footer>
      </body>
    </html>
  );
}
