// Google Fonts removed to resolve Internal Server Error (font fetching failure)

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EarNnLearn",
  description: "Standardizing Identity through Decentralized Learning",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
