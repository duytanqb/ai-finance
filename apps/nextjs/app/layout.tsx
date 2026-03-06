import type { Metadata } from "next";
import { Sora } from "next/font/google";
import type { ReactElement, ReactNode } from "react";
import Providers from "../common/providers";
import "./global.css";

import { Analytics } from "@vercel/analytics/next";
import "@packages/ui/globals.css";
import { Toaster } from "@packages/ui/index";
import { getLocale } from "next-intl/server";

const sora = Sora({ subsets: ["latin"] });

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={sora.className}>
        <Providers>
          {children}
          <Toaster richColors position="top-left" />
        </Providers>
      </body>
      <Analytics />
    </html>
  );
}

export const metadata: Metadata = {
  title: {
    default: "AI Finance - Vietnam Stock Market Intelligence",
    template: "%s | AI Finance",
  },
  description:
    "AI-powered stock analysis platform for Vietnam market (HOSE, HNX, UPCOM). Portfolio tracking, market watch, stock screening, and deep research reports.",
  applicationName: "AI Finance",
};
