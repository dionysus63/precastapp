import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getAppSettings } from "@/lib/app-settings";
import {
  companyLogoApiUrl,
  getCompanyLogoUpdatedAt,
} from "@/lib/company-logo";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
