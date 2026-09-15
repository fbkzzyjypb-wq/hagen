import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { TabBar } from "@/components/tab-bar";
import { ServiceWorkerRegistration } from "@/components/sw-register";
import { Bootstrap } from "@/components/bootstrap";
import { asset } from "@/lib/base-path";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hagen",
  description: "Oversikt over hagen: planter, kart, bilder og oppgaver gjennom året.",
  applicationName: "Hagen",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Hagen",
  },
  icons: {
    icon: asset("/icons/icon-192.png"),
    apple: asset("/icons/apple-touch-icon.png"),
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f8f4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="nb" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="flex-1 pb-safe-tabbar">{children}</div>
        <TabBar />
        <ServiceWorkerRegistration />
        <Bootstrap />
      </body>
    </html>
  );
}
