import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Geist Mono is not used by any Phase 1 UI — it is wired here so Phase 3's
// timecode display can consume it without touching font config again.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "My Audiobooks",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "My Audiobooks",
  },
  other: {
    // Next 16's appleWebApp.capable resolver only emits the newer,
    // prefix-less `mobile-web-app-capable` tag. iOS versions before 17.4
    // still key standalone-launch detection off the legacy
    // `apple-mobile-web-app-capable` name (PITFALLS.md Pitfall 1), so it
    // is declared explicitly here alongside Next's auto-generated tag.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0A0A0A",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body
        className="min-h-dvh flex flex-col bg-[#0A0A0A]"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        {children}
      </body>
    </html>
  );
}
