// Google Fonts removed to resolve Internal Server Error (font fetching failure)

import type { Metadata } from "next";
import { PLATFORM_NAME, PLATFORM_DESCRIPTION } from "@/lib/config";
import { InstallPrompt } from "@/components/InstallPrompt";
import "./globals.css";

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: PLATFORM_DESCRIPTION,
  manifest: "/manifest.json",
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
        <InstallPrompt />
      </body>
    </html>
  );
}
