import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { DataProvider } from "@/components/data-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const noto = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "シフト・部屋管理(モック)",
  description: "複数店舗向けシフト管理・部屋管理システムの操作モック",
  applicationName: "シフト管理",
  appleWebApp: { capable: true, title: "シフト管理", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#2f4a6d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${noto.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        <DataProvider>{children}</DataProvider>
        <Toaster />
      </body>
    </html>
  );
}
