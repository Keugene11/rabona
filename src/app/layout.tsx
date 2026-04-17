import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Rabona",
  description: "The social network for Stony Brook University students",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "StonyLoop",
  },
};

export const viewport: Viewport = {
  themeColor: "#c13545",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('theme')==='dark')document.documentElement.classList.add('dark')}catch(e){}` }} />
      </head>
      <body className="min-h-full"><Providers>{children}</Providers></body>
    </html>
  );
}
