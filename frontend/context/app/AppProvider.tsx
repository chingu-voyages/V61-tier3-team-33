"use client"

import { GooeyToaster } from "@/components/ui/goey-toaster"
import { ThemeProvider } from "@/context/theme/ThemeProvider"
import { ChessThemeProvider } from "@/context/theme/ChessThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AudioProvider } from "@/audio/provider"
import { GuestProvider } from "@/context/guest/GuestProvider"
import { Providers } from "./Providers"

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
    <ThemeProvider>
      <ChessThemeProvider>
        <TooltipProvider>
          <GooeyToaster
            position="top-center"
            closeButton="top-right"
            showProgress
          />
          <AudioProvider>
            <GuestProvider>
              {children}
            </GuestProvider>
          </AudioProvider>
        </TooltipProvider>
      </ChessThemeProvider>
    </ThemeProvider>
    </Providers>
  )
}
