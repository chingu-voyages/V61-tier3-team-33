"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"

export interface PillOption<T> {
  /** Full pill content — pass an icon + text as a fragment for icon pills. */
  label: React.ReactNode
  value: T
}

interface PillGroupProps<T> {
  label: string
  options: PillOption<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * A labeled row of mutually-exclusive pill buttons — the shape shared by
 * every single-select choice on PlayDashboard (opponent, difficulty,
 * color). Generic over the option's value type so callers get type-safe
 * onChange without each picker reimplementing the same markup.
 */
export function PillGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: PillGroupProps<T>) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">
        {label}
      </span>
      <div className="flex gap-2">
        {options.map((option) => (
          <Button
            key={option.value}
            type="button"
            size="sm"
            variant={option.value === value ? "default" : "outline"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  )
}
