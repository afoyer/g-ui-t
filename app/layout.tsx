import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "G-ui-t",
  description: "Design together without learning Git.",
};

// Applies the "Show Git terms" preference before first paint.
const hintsScript = `try{if(localStorage.getItem("guit-hints")==="off")document.documentElement.dataset.hints="off"}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: hintsScript }} />
      </head>
      <body className="h-full">{children}</body>
    </html>
  );
}
