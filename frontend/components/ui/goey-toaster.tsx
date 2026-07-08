"use client"

import { GooeyToaster as GooeyToasterPrimitive, gooeyToast } from "goey-toast"
import type { GooeyToasterProps } from "goey-toast"
import { useTheme } from "next-themes"
import "goey-toast/styles.css"

export { gooeyToast }
export type { GooeyToasterProps }
export type {
  GooeyToastOptions,
  GooeyPromiseData,
  GooeyToastAction,
  GooeyToastClassNames,
  GooeyToastTimings,
} from "goey-toast"

function GooeyToaster(props: GooeyToasterProps) {
  const { resolvedTheme } = useTheme()
  return (
    <GooeyToasterPrimitive
      position="bottom-right"
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      {...props}
    />
  )
}

export { GooeyToaster }
