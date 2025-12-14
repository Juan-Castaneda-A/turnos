"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

// Eliminamos la importación explícita de tipos que daba error.
// React.ComponentProps obtiene los tipos automáticamente.
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}