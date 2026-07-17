import { Inter, Outfit } from "next/font/google";
import { GoogleOAuthProvider } from "@react-oauth/google";

import "./globals.css";
import { cn } from "@/lib/utils";
import { AppProvider } from "@/context/app/AppProvider";
import { AuthProvider } from "@/context/auth/AuthProvider";

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
        <GoogleOAuthProvider
          clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!}
        >
          <AppProvider>
            <AuthProvider>
            {children}</AuthProvider>
          </AppProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}