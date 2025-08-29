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

def create_text_image(text, font_path, font_size):
    try:
        font = ImageFont.truetype(font_path, font_size)
        bbox = font.getbbox(text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        image = Image.new('1', (text_width, text_height), color=255)
        draw = ImageDraw.Draw(image)
        draw.text((0, 0), text, font=font, fill=0)
        return image
    except Exception as e:
        print(f"❌ Error al crear la imagen del texto: {e}")
        return None
    
# ======================================================================
# ¡NUEVA FUNCIÓN "REBANADORA" DE IMÁGENES!
# ======================================================================
def print_image_sliced(printer, image, max_height=255):
    """
    Imprime una imagen alta rebanándola en pedazos horizontales
    para evitar los límites de altura del firmware de la impresora.
    """
    width, height = image.size
    y = 0
    while y < height:
        slice_height = min(max_height, height - y)
        box = (0, y, width, y + slice_height)
        slice_img = image.crop(box)
        
        printer.set(align='center')
        printer.image(slice_img)
        
        y += slice_height

def print_ticket(data):
    printer = None 
    try:
        #profile = get_profile("TEP-220M")
        printer = Win32Raw(PRINTER_NAME)
        
        # Compactación vertical
        printer._raw(b'\x1b\x33\x00') 

        # --- Logo de la Notaría ---
        if NOTARIA_LOGO:
            print_image_sliced(printer, NOTARIA_LOGO)
        else:
            printer.set(align='center', font='a', bold=True, width=2, height=2)
            printer.textln("NOTARIA TERCERA DE VALLEDUPAR")
        
        # --- Número del Turno (IMPRESO COMO IMAGEN) ---
        turno_texto = data.get('turno', 'N/A')
        font_size_turno = 80
        turno_imagen = create_text_image(turno_texto, FONT_PATH, font_size_turno)
        
        if turno_imagen:
           print_image_sliced(printer, turno_imagen)
            #printer._raw(b'\x1b\x4a\x3c')
            # =======================================================
            
        else: # Fallback si la imagen no se pudo crear
            printer.set(align='center', font='a', bold=True, width=4, height=4) 
            printer.textln(turno_texto)
        
        printer.ln()

        # --- Servicio (Letra normal) ---
        printer.set(align='center', font='a', bold=False, width=1, height=1)
        printer.textln(f"{data.get('servicio', '')}")
        printer.textln("--------------------------------")

        # --- Fecha y Hora ---
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        printer.textln(f"{now}")
        
        # Corte preciso
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