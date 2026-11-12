import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getAppSettings } from "@/lib/app-settings";
import {
  companyLogoApiUrl,
  getCompanyLogoUpdatedAt,
} from "@/lib/company-logo";
import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_TEXT_SIZE, resolveTextSize } from "@/lib/text-size";
import { AppProviders } from "@/components/ui/app-providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getAppSettings();
    const logoUpdatedAt = await getCompanyLogoUpdatedAt(settings.companyLogoPath);
    const logoUrl = logoUpdatedAt ? companyLogoApiUrl(logoUpdatedAt) : null;

    return {
      title: settings.appTitle,
      description: settings.appSubtitle,
      ...(logoUrl
        ? {
            icons: {
              icon: logoUrl,
              apple: logoUrl,
            },
          }
        : {}),
    };
  } catch {
    return {
      title: "Precast Ops",
      description: "Quoting & Inventory",
    };
  }
}

/**
 * The signed-in user's Text Size choice (My Preferences). Normal when nobody
 * is signed in (the login page) or the lookup fails: a text size must never
 * be the reason a page doesn't load.
 */
async function currentTextSize() {
  try {
    const user = await getCurrentUser();
    return resolveTextSize(user?.textSize);
  } catch {
    return DEFAULT_TEXT_SIZE;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const textSize = await currentTextSize();

  return (
    <html
      lang="en"
      data-text-size={textSize}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased [color-scheme:light] text-slate-900`}
    >
      <body className="min-h-full flex flex-col font-sans text-slate-900">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
