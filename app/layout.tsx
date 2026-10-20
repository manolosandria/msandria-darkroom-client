import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@/src/ui/components/SessionProvider";
import { CuratorNotificationsProvider } from "@/src/ui/components/CuratorNotifications";
import { EditingWorkspace } from "@/src/ui/components/EditingWorkspace";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Manolo",
  description: "This is a collection of my works. Thank you for visiting, really hope you enjoy it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <CuratorNotificationsProvider><EditingWorkspace>{children}</EditingWorkspace></CuratorNotificationsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
