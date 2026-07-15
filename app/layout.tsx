import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "大專教育價筆電挑選器",
  description: "用 Excel 內的限定機型快速篩選、比較與更新教育價筆電。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
