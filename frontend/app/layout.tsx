import { Inter, Outfit } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/context/app/AppProvider";

const outfitHeading = Outfit({
  subsets: ["latin"],
  variable: "--font-heading",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        "font-sans",
        inter.variable,
        outfitHeading.variable
      )}
    >
      <body>
          <AppProvider>
            {children}
          </AppProvider>
      </body>
    </html>
  );
}
