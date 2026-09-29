import type { Metadata } from "next";
import { Suspense } from "react";
import { Montserrat } from "next/font/google";
import { Nav } from "@/components/Nav";
import { NavigationPulse } from "@/components/NavigationPulse";
import { PendingInviteGate } from "@/components/PendingInviteGate";
import "./globals.css";

const sans = Montserrat({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "OneLegends",
  description:
    "OneLegends — applications for the Legends circuit. One team profile, checkboxes for every competition.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <Nav />
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
              </a>
              . #journeytothecrown · Payment is external.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
