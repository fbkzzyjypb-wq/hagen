import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/sw-register";
import { Bootstrap } from "@/components/bootstrap";
import { asset } from "@/lib/base-path";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hagen",
  description: "Oversikt over hagen: planter, plasseringer, kart og bilder gjennom året.",
  applicationName: "Hagen",
  appleWebApp: {
    capable: true,
    // Innholdet går under statuslinjen, så kameraet fyller hele skjermen. Teksten i linjen er da hvit; lyse sider får
    // en grønn stripe bak den (se `StatusBarStrip`).
    statusBarStyle: "black-translucent",
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
        <div className="flex-1 pb-safe">{children}</div>
        {/* Stripen bak statuslinjen på lyse sider. Skallet setter `data-camera` på <html> mens kameraet vises, og da er den borte. */}
        <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-60 h-(--safe-top) bg-primary transition-colors [[data-camera]_&]:bg-transparent" />
        <ServiceWorkerRegistration />
        <Bootstrap />
      </body>
    </html>
  );
}
