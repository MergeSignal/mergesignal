import type { Metadata } from "next";
import { EB_Garamond, Inter } from "next/font/google";
import localFont from "next/font/local";
import { auth } from "../auth";
import { getSiteOrigin } from "../lib/siteOrigin";
import { ClientSessionProvider } from "./components/shared/ClientSessionProvider/ClientSessionProvider";
import { MantineColorSchemeScript } from "./components/shared/MantineProviderWrapper/MantineColorSchemeScript";
import { MantineProviderWrapper } from "./components/shared/MantineProviderWrapper/MantineProviderWrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-brand",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  title: "MergeSignal - dependency risk before you merge",
  description:
    "MergeSignal analyzes dependency changes and surfaces runtime-impacting risks so you can merge with confidence.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* ColorSchemeScript sets data-mantine-color-scheme on <html> before React
            hydrates. suppressHydrationWarning on <html> prevents the resulting
            attribute mismatch from being treated as an error. */}
        <MantineColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body
        className={`${inter.variable} ${ebGaramond.variable} ${geistMono.variable}`}
      >
        <MantineProviderWrapper>
          <ClientSessionProvider session={session}>
            {children}
          </ClientSessionProvider>
        </MantineProviderWrapper>
      </body>
    </html>
  );
}
