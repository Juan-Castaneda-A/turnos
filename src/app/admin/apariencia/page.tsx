'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from '@supabase/ssr'
import { toast } from 'sonner'
import { Loader2, Upload, Palette } from 'lucide-react'

export default function AparienciaPage() {
  const [color, setColor] = useState('#2563EB')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const handleSave = async () => {
    setLoading(true)
    try {
        let logoUrl = null

        // 1. Subir Logo si existe
        if (logoFile) {
            const fileName = `logo-${Date.now()}.png`
            const { data, error } = await supabase.storage
                .from('branding')
                .upload(fileName, logoFile, { upsert: true })
            
            if (error) throw error
            
            // Obtener URL pública
            const { data: urlData } = supabase.storage.from('branding').getPublicUrl(fileName)
            logoUrl = urlData.publicUrl
        }

        // 2. Obtener config actual para no borrar lo que ya existe
        const { data: currentOrg } = await supabase
            .from('organizaciones')
            .select('configuracion')
            .eq('id_organizacion', 1)
            .single()
        
        const currentConfig = currentOrg?.configuracion || {}

        // 3. Guardar en JSONB
        const newConfig = {
            ...currentConfig,
            apariencia: {
                color_hex: color,
                // Si no subió logo nuevo, mantenemos el anterior (si existe)
                logo_url: logoUrl || currentConfig.apariencia?.logo_url
            }
        }

        const { error: updateError } = await supabase
            .from('organizaciones')
            .update({ configuracion: newConfig })
            .eq('id_organizacion', 1)

        if (updateError) throw updateError

        toast.success("Apariencia actualizada. Recarga para ver cambios.")
        window.location.reload() // Recarga para aplicar CSS variables

    } catch (e: any) {
        toast.error("Error: " + e.message)
    } finally {
        setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-3xl font-bold text-white">Personalización de Marca</h2>
      
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
            <CardTitle className="text-white flex gap-2"><Palette /> Color Principal</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex gap-4 items-center">
                <input 
                    type="color" 
                    value={color} 
                    onChange={(e) => setColor(e.target.value)}
                    className="h-14 w-14 rounded-lg cursor-pointer bg-transparent border-0"
                />
                <div className="text-slate-400">
                    <p className="text-sm">Elige el color de tu marca.</p>
                    <p className="text-xs mt-1">Se aplicará a botones, bordes y énfasis.</p>
                </div>
            </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
            <CardTitle className="text-white flex gap-2"><Upload /> Logotipo</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">
                <Input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="bg-slate-800 border-slate-700 text-white"
                />
                <p className="text-xs text-slate-500">Recomendado: PNG transparente, máx 2MB.</p>
            </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="w-full bg-brand-600 hover:bg-brand-500 text-white font-bold h-12 text-lg">
        {loading ? <Loader2 className="animate-spin mr-2" /> : 'Guardar y Aplicar Cambios'}
      </Button>
    </div>
  )
}