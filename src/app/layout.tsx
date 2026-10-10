import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { Nav } from "@/components/Nav";
import { ThemeSelect } from "@/components/ThemeSelect";
import { NavigationPulse } from "@/components/NavigationPulse";
import { PendingInviteGate } from "@/components/PendingInviteGate";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const graphik = localFont({
  src: [
    { path: "./fonts/Graphik-Thin.otf", weight: "100", style: "normal" },
    { path: "./fonts/Graphik-Extralight.otf", weight: "200", style: "normal" },
    { path: "./fonts/Graphik-Light.otf", weight: "300", style: "normal" },
    { path: "./fonts/Graphik-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/Graphik-Medium.otf", weight: "500", style: "normal" },
    { path: "./fonts/Graphik-Medium.otf", weight: "600", style: "normal" },
    { path: "./fonts/Graphik-Medium.otf", weight: "700", style: "normal" },
    { path: "./fonts/Graphik-Black.otf", weight: "800", style: "normal" },
    { path: "./fonts/Graphik-Black.otf", weight: "900", style: "normal" },
  ],
  variable: "--font-graphik",
  display: "swap",
});

const pontiac = localFont({
  src: "./fonts/Pontiac-Inline-Regular.otf",
  variable: "--font-pontiac",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "OneLegends",
  description:
    "OneLegends — applications for the Legends circuit. One team profile, checkboxes for every competition.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${graphik.variable} ${pontiac.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <Nav />
        <ThemeSelect />
        <NavigationPulse />
        <Suspense fallback={null}>
          <PendingInviteGate />
        </Suspense>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-line bg-blush">
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs tracking-wide text-muted sm:flex-row sm:items-center sm:justify-between">
            <p>
              <span className="font-semibold text-ink">OneLegends</span>
              {" · "}
              For{" "}
              <a
                href="https://legends.desidancenetwork.org/"
                className="text-accent underline"
                target="_blank"
                rel="noreferrer"
              >
                Legends Dance Championship
              </a>{". #journeytothecrown · Payment is external."}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
