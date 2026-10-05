import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google"; 
import "./globals.css";
import { PlayerProvider } from "@/contexts/PlayerContext";
import Sidebar from "@/components/Sidebar";
import PlayerBar from '@/reusable/player/PlayerBar';

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://muse.abhiyank.in"),
  title: {
    default: "Muse Music | Premium Ad-Free Music Player by Abhiyank",
    template: "%s | Muse Music"
  },
  description: "Muse Music by Abhiyank. A high-performance, ad-free music streaming experience. Listen to top trending songs, discover new artists, and enjoy seamless playback on India's best premium music app.",
  keywords: [
    "muse", 
    "muse music", 
    "abhiyank muse", 
    "muse by abhiyank", 
    "music player", 
    "ad-free music", 
    "listen music online", 
    "premium streaming", 
    "best music app", 
    "hindi songs", 
    "trending music"
  ],
  authors: [{ name: "Abhiyank", url: "https://muse.abhiyank.in" }],
  creator: "Abhiyank",
  publisher: "Muse Music",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    title: "Muse Music",
    statusBarStyle: "black-translucent",
    capable: true,
  },
  applicationName: "Muse Music",
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://muse.abhiyank.in", 
    siteName: "Muse Music",
    title: "Muse Music | Premium Ad-Free Audio Experience by Abhiyank",
    description: "Stream millions of songs ad-free with Muse Music. Curated playlists, top trends, and a high-end UI crafted by Abhiyank.",
    images: [{
      url: "https://muse.abhiyank.in/og-image.png", 
      width: 1200,
      height: 630,
      alt: "Muse Music - Premium Ad-Free Music Streaming",
      type: "image/png",
    }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Muse Music by Abhiyank - Ad-Free Streaming",
    description: "The ultimate premium music player experience. Listen without limits.",
    creator: "@abhiyank", 
    images: [{
      url: "https://muse.abhiyank.in/og-image.png",
      width: 1200,
      height: 630,
      alt: "Muse Music - Premium Ad-Free Music Streaming",
    }],
  }
};

import { AuthProvider } from "@/contexts/AuthContext";
import { UIProvider } from "@/contexts/UIContext";
import { ToastProvider } from "@/contexts/ToastContext";
import PWAInstallPrompt from '@/platform/web/PWAInstallPrompt';
import OfflineDetector from "@/components/OfflineDetector";
import MobileNav from "@/components/MobileNav";
import MobileMenuButton from "@/components/MobileMenuButton";
import { BugReportContainer } from '@/features/bug-report/BugReportContainer';
import NotificationPopup from '@/components/NotificationPopup';
import DeepLinkInit from '@/core/platform/DeepLinkInit';
import LoginModal from '@/components/LoginModal';
import ProSubscriptionPopup from '@/components/ProSubscriptionPopup';
import ProExpiryBanner from '@/components/ProExpiryBanner';
import PushNotificationInit from '@/components/PushNotificationInit';
import { ColabProvider } from "@/contexts/ColabContext";
import FloatingReactionsOverlay from "@/components/colab/FloatingReactionsOverlay";
import ColabActiveBanner from "@/components/colab/ColabActiveBanner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${inter.className} bg-[#0a0a0a] text-white overflow-hidden`}
        suppressHydrationWarning
      >
        <AuthProvider>
          <UIProvider>
            <ToastProvider>
              <PlayerProvider>
                <ColabProvider>
                  <div className="flex h-screen w-full">
                    <Sidebar />
                    <main className="flex-1 overflow-y-auto hide-scrollbar relative bg-gradient-to-br from-black via-[#121212] to-[#1a1a1a]">
                      {children}
                      <div className="h-36 md:h-32" /> {/* Spacer for floating player & nav */}
                    </main>
                  </div>
                  <PlayerBar />
                  <MobileNav />
                  <PWAInstallPrompt />
                  <OfflineDetector />
                  <BugReportContainer />
                  <NotificationPopup />
                  <DeepLinkInit />
                  <LoginModal />
                  <ProSubscriptionPopup />
                  <ProExpiryBanner />
                  <PushNotificationInit />
                  <FloatingReactionsOverlay />
                  <ColabActiveBanner />
                </ColabProvider>
              </PlayerProvider>
            </ToastProvider>
          </UIProvider>
        </AuthProvider>

        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                var isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                if (isLocal) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for (var i = 0; i < registrations.length; i++) {
                      registrations[i].unregister();
                    }
                  });
                  if ('caches' in window) {
                    caches.keys().then(function(names) {
                      for (var i = 0; i < names.length; i++) {
                        caches.delete(names[i]);
                      }
                    });
                  }
                } else {
                  window.addEventListener('load', function() {
                    navigator.serviceWorker.register('/sw.js').then(
                      function(registration) {
                        registration.update();
                      },
                      function(err) {
                        console.warn('ServiceWorker registration failed: ', err);
                      }
                    );
                  });
                }
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
