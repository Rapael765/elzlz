import type { Metadata } from "next";
import "./globals.css";

export const viewport = { width: "device-width", initialScale: 1 };
export const metadata: Metadata = {
  title: "setanwawa",
  description: "Dashboard pengelolaan toko dan promosi WhatsApp berbasis persetujuan pelanggan."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
