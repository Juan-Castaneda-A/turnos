'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

// Valores por defecto (Azul Notaría)
const defaultBranding = {
  logoUrl: './logo_not.png', // Tu logo local por defecto
  primaryColor: '#2563EB', // Blue-600
}

const BrandingContext = createContext(defaultBranding)

export const useBranding = () => useContext(BrandingContext)

export default function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState(defaultBranding)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  useEffect(() => {
    const fetchBranding = async () => {
      // Leemos de la tabla 'organizaciones' (asumiendo ID 1 para single-tenant)
      const { data } = await supabase
        .from('organizaciones')
        .select('configuracion')
        .eq('id_organizacion', 1) // O usa tu lógica de organización
        .single()

      if (data?.configuracion?.apariencia) {
        const { logo_url, color_hex } = data.configuracion.apariencia
        setBranding({
          logoUrl: logo_url || defaultBranding.logoUrl,
          primaryColor: color_hex || defaultBranding.primaryColor
        })
        
        // --- LA MAGIA: Convertir HEX a HSL y aplicarlo al CSS ---
        if (color_hex) {
            const hsl = hexToHSL(color_hex) // Necesitamos esta función auxiliar
            document.documentElement.style.setProperty('--brand-hue', hsl.h.toString())
            document.documentElement.style.setProperty('--brand-sat', hsl.s + '%')
            // La luminosidad la maneja Tailwind en el config (50%, 60%, etc.)
        }
      }
    }

    fetchBranding()
  }, [])

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  )
}

// Función auxiliar: HEX (#2563EB) -> HSL Object
function hexToHSL(hex: string) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt("0x" + hex[1] + hex[1]);
    g = parseInt("0x" + hex[2] + hex[2]);
    b = parseInt("0x" + hex[3] + hex[3]);
  } else if (hex.length === 7) {
    r = parseInt("0x" + hex[1] + hex[2]);
    g = parseInt("0x" + hex[3] + hex[4]);
    b = parseInt("0x" + hex[5] + hex[6]);
  }
  r /= 255; g /= 255; b /= 255;
  let cmin = Math.min(r,g,b), cmax = Math.max(r,g,b), delta = cmax - cmin, h = 0, s = 0, l = 0;

  if (delta == 0) h = 0;
  else if (cmax == r) h = ((g - b) / delta) % 6;
  else if (cmax == g) h = (b - r) / delta + 2;
  else h = (r - g) / delta + 4;

  h = Math.round(h * 60);
  if (h < 0) h += 360;
  l = (cmax + cmin) / 2;
  s = delta == 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  s = +(s * 100).toFixed(1);
  l = +(l * 100).toFixed(1);

  return { h, s, l };
}