import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI夢ノート",
  description: "夢を目標に変え、目標を今日の行動につなげるMVPアプリ"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
