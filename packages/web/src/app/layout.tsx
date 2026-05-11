import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Paracosm Agent",
  description: "Autonomous agent platform with world modeling, simulation, and strategy evolution",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-paracosm-dark text-gray-200 font-sans antialiased min-h-screen">
        <div className="flex min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
