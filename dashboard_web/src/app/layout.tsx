import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthProvider } from "@/app/context/AuthContext"; // <-- IMPORTAR

export const metadata: Metadata = {
  title: "Dashboard Transporte",
  description: "Monitoreo y gestión de flota",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        {/* ENVOLVER AQUÍ */}
        <AuthProvider>
          {children}
        </AuthProvider>
        {/* FIN ENVOLTURA */}
      </body>
    </html>
  );
}
    
