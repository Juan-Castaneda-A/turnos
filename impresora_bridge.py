import asyncio
import websockets
import json
from escpos.printer import Win32Raw
from escpos.capabilities import get_profile
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

# --- CONFIGURACIÓN ---
PRINTER_NAME = "POS-58"
LOGO_PATH = "logo_dimensionado.jpg"
FONT_PATH = "ARLRDBD.TTF" 

# --- Carga del Logo ---
def load_logo():
    try:
        img = Image.open(LOGO_PATH).convert("1")
        return img
    except Exception as e:
        print(f"❌ Advertencia: No se pudo cargar el logo. Causa: {e}")
        return None

NOTARIA_LOGO = load_logo()

# ======================================================================
# ¡NUEVA FUNCIÓN MEJORADA PARA CREAR IMAGEN CON PADDING!
# ======================================================================
def create_text_image(text, font_path, font_size, padding=10):
    """Crea una imagen a partir de texto, añadiendo un margen blanco alrededor."""
    try:
        font = ImageFont.truetype(font_path, font_size)
        bbox = font.getbbox(text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # 1. Creamos un lienzo más grande, añadiendo el padding
        canvas_width = text_width + (padding * 2)
        canvas_height = text_height + (padding * 2)
        
        image = Image.new('1', (canvas_width, canvas_height), color=255) # 255 es blanco
        draw = ImageDraw.Draw(image)
        
        # 2. Dibujamos el texto en el lienzo, desplazado por el padding
        draw.text((padding, padding), text, font=font, fill=0) # 0 es negro
        
        return image
    except Exception as e:
        print(f"❌ Error al crear la imagen del texto: {e}")
        return None

# --- FUNCIÓN DE IMPRESIÓN PRECISA (ACTUALIZADA Y SIMPLIFICADA) ---
def print_ticket(data):
    printer = None 
    try:
        profile = get_profile("TEP-220M")
        printer = Win32Raw(PRINTER_NAME, profile=profile)
        
        printer._raw(b'\x1b\x33\x00') # Compactación vertical

        # --- Logo de la Notaría ---
        if NOTARIA_LOGO:
            printer.set(align='center')
            printer.image(NOTARIA_LOGO)
        else:
            printer.set(align='center', font='a', bold=True, width=2, height=2)
            printer.textln("NOTARIA TERCERA")
        
        printer.ln()

        # --- Número del Turno (IMPRESO COMO IMAGEN CON PADDING) ---
        turno_texto = data.get('turno', 'N/A')
        # Puedes volver a probar con un tamaño grande, como 80
        font_size_turno = 80 
        
        turno_imagen = create_text_image(turno_texto, FONT_PATH, font_size_turno)
        
        if turno_imagen:
            printer.set(align='center')
            printer.image(turno_imagen) # Imprimimos la imagen con padding
            printer.ln() # Añadimos un pequeño salto de línea después
        else: # Fallback
            printer.set(align='center', font='a', bold=True, width=4, height=4) 
            printer.textln(turno_texto)
            printer.ln()

        # --- El resto del ticket no cambia ---
        printer.set(align='center', font='a', bold=False, width=1, height=1)
        printer.textln(f"{data.get('servicio', '')}")
        printer.textln("--------------------------------")
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        printer.textln(f"{now}")
        
        printer._raw(b'\x1b\x4a\x10')
        printer.cut()
        printer._raw(b'\x1b\x32')

        print(f"✅ Ticket para {data.get('turno')} impreso con precisión.")

    except Exception as e:
        print(f"❌ Error durante la impresión: {e}")
    finally:
        if printer:
            printer.close()

# --- El resto del script (handler, main) no necesita cambios ---
async def handler(websocket, path):
    print("Cliente web conectado.")
    try:
        async for message in websocket:
            ticket_data = json.loads(message)
            print_ticket(ticket_data)
    except websockets.exceptions.ConnectionClosed:
        print("Cliente web desconectado.")
async def main():
    print("🚀 Iniciando servidor de impresión WebSocket en ws://localhost:8765")
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()
if __name__ == "__main__":
    asyncio.run(main())