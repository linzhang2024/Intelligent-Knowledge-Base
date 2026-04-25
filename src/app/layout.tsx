import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "智能知识库",
  description: "公司内部智能知识库系统",
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
