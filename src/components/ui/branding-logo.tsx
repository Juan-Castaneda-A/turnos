'use client'

import { useBranding } from '@/components/providers/BrandingProvider'

interface Props {
  className?: string
  fallbackClass?: string
}

export default function BrandingLogo({ className = "h-12 w-auto", fallbackClass = "h-10 w-10" }: Props) {
  const { logoUrl } = useBranding()

  if (logoUrl) {
    return (
      <img 
        src={logoUrl} 
        alt="Logo Institucional" 
        className={`object-contain ${className}`} 
      />
    )
  }

  // Fallback si no han subido logo aun
  return (
    <div className={`bg-brand-600 rounded-xl flex items-center justify-center font-bold text-white ${fallbackClass}`}>
      N
    </div>
  )
}