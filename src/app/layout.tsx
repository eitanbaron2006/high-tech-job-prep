import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "High Tech Job Prep",
  description: "AlgoBuddy - algorithms interview prep",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body>
        {children}
      </body>
    </html>
  );
}
