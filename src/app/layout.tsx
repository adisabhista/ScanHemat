import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "ScanHemat",
  description: "Aplikasi pencatat pengeluaran dari struk belanja."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
