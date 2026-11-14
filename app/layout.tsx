import type { Metadata, Viewport } from "next";
import { EnregistrerSw } from "@/components/pwa/enregistrer-sw";
import { InstallerPwa } from "@/components/pwa/installer-pwa";
import { urlSite } from "@/lib/vitrine/site";
import "./globals.css";

const base = urlSite();

export const metadata: Metadata = {
  ...(base && { metadataBase: new URL(base) }),
  title: "Kaya",
  description:
    "Gérez le stock, les ventes, les crédits et la caisse de votre quincaillerie, même à distance.",
  applicationName: "Kaya",
  appleWebApp: { capable: true, title: "Kaya", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#ff7900",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <InstallerPwa />
        <EnregistrerSw />
      </body>
    </html>
  );
}
