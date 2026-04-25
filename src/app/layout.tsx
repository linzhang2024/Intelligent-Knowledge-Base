import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智能知识库",
  description: "公司内部智能知识库系统",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
