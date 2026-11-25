import type { Metadata, Viewport } from "next";
import "./globals.css";

const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Clarity Coaching";

export const metadata: Metadata = {
  title: `${brand} · AI Coach`,
  description: "Your personal AI coaching assistant.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2f5d50",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
