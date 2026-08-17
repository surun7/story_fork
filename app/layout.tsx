import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "故事岔口 StoryFork · AI 分支式故事共创",
  description:
    "AI 负责发散，人负责选择。输入一个故事开头，让 AI 为你分岔出三种截然不同的命运。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-cream font-sans text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
