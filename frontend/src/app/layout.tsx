import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { PLATFORM_NAME, PLATFORM_DESCRIPTION } from "@/lib/config";
import { InstallPrompt } from "@/components/InstallPrompt";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
    <html lang="en" suppressHydrationWarning className={`${inter.variable}`}>
      <body className={`antialiased font-sans ${inter.className}`}>
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
