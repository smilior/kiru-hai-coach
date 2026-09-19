import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const noto = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto",
});

export const metadata: Metadata = {
  title: "切る牌コーチ",
  description:
    "手牌から切る牌をJevが判定し、効率・安全・待ちの観点で日本語解説する麻雀コーチ。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fef3c7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${noto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-stone-100 font-sans text-stone-900">
        {children}
      </body>
    </html>
  );
}
