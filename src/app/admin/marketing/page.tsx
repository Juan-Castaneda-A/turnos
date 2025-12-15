'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Trash2, Upload, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { deleteAdAction, toggleAdAction } from '@/actions/admin-marketing'

export default function MarketingPage() {
  const [ads, setAds] = useState<any[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const loadAds = async () => {
    const { data } = await supabase.from('anuncios_tv').select('*').order('created_at', { ascending: false })
    if (data) setAds(data)
  }

  useEffect(() => { loadAds() }, [])

  const handleUpload = async () => {
    if (!file) return toast.error("Selecciona una imagen")
    setUploading(true)

    try {
        const fileName = `${Date.now()}-${file.name}`
        const { error: uploadError } = await supabase.storage.from('ads').upload(fileName, file)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('ads').getPublicUrl(fileName)

        await supabase.from('anuncios_tv').insert({
            imagen_url: urlData.publicUrl,
            titulo: title,
            activo: true
        })

        toast.success("Anuncio subido")
        setFile(null); setTitle('')
        loadAds()
    } catch (e: any) {
        toast.error(e.message)
    } finally {
        setUploading(false)
    }
  }

  const handleDelete = async (id: number, url: string) => {
      if(!confirm("¿Eliminar?")) return
      await deleteAdAction(id, url)
      loadAds()
      toast.success("Eliminado")
  }

  const handleToggle = async (id: number, current: boolean) => {
      await toggleAdAction(id, !current)
      loadAds()
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white">Marketing en TV</h2>
        <p className="text-slate-400">Sube imágenes para mostrar en el carrusel del visualizador.</p>
      </div>

      {/* FORMULARIO */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="pt-6 flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full">
                <label className="text-sm text-slate-400 block mb-1">Título (Opcional)</label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Promoción Diciembre" className="bg-slate-800 border-slate-700 text-white"/>
            </div>
            <div className="w-full">
                <label className="text-sm text-slate-400 block mb-1">Imagen (JPG/PNG)</label>
                <Input type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} className="bg-slate-800 border-slate-700 text-white cursor-pointer"/>
            </div>
            <Button onClick={handleUpload} disabled={uploading || !file} className="bg-brand-600 hover:bg-brand-500 text-white w-full md:w-auto">
                {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Subir
            </Button>
        </CardContent>
      </Card>

      {/* GRID DE ANUNCIOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ads.map((ad) => (
            <div key={ad.id} className={`relative group rounded-xl overflow-hidden border-2 transition-all ${ad.activo ? 'border-brand-500/50' : 'border-slate-800 opacity-60'}`}>
                <img src={ad.imagen_url} alt="Ad" className="w-full h-48 object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <Switch checked={ad.activo} onCheckedChange={() => handleToggle(ad.id, ad.activo)} />
                    <Button variant="destructive" size="icon" onClick={() => handleDelete(ad.id, ad.imagen_url)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                {ad.titulo && (
                    <div className="absolute bottom-0 w-full bg-black/70 p-2 text-center text-white text-sm font-bold truncate">
                        {ad.titulo}
                    </div>
                )}
            </div>
        ))}
      </div>
    </div>
  )
}