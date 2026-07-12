import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./sidebar";
import ProfileMenu from "./profile-menu";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ricco Chat",
  description: "Ricco Chat — atendimento inteligente",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="font-sans antialiased">
        <div className="flex h-screen overflow-hidden bg-[#f4f7fb]">
          <Sidebar />
          <div className="min-w-0 flex-1 overflow-y-auto">{children}</div>
          <ProfileMenu />
        </div>
      </body>
    </html>
  );
}
