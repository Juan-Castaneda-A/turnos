import asyncio
import websockets
import json
from escpos.printer import Win32Raw
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

# --- CONFIGURACIÓN ---
#reemplazar estos valores con los de la impresora Epson
PRINTER_NAME = "POS-58"
LOGO_PATH = "logo_dimensionado.jpg"
FONT_PATH = "ARLRDBD.TTF" 

#función para cargar y preparar el logo
def load_logo():
    try:
        #abrir la imagen
        img = Image.open(LOGO_PATH)
        img = img.convert("1")
        return img
    except FileNotFoundError:
        print(f"Error: El archivo no se encontró")
        return None
    except Exception as e:
        print(f"Error al cargar o procesar el logo: {e}")
        return None
    
NOTARIA_LOGO = load_logo() # Carga el logo al inicio del script

# ======================================================================
# ¡NUEVA FUNCIÓN PARA CREAR UNA IMAGEN A PARTIR DE TEXTO!
# ======================================================================
def create_text_image(text, font_path, font_size):
    try:
        # Carga la fuente con el tamaño que queramos
        font = ImageFont.truetype(font_path, font_size)
        
        # Calculamos el tamaño que ocupará el texto para crear un lienzo perfecto
        # .textbbox devuelve (izquierda, arriba, derecha, abajo)
        bbox = font.getbbox(text)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]

        # Creamos la imagen en blanco (modo '1' es blanco y negro)
        image = Image.new('1', (text_width, text_height), color=255)
        
        # Creamos un objeto para poder "dibujar" en la imagen
        draw = ImageDraw.Draw(image)
        
        # Dibujamos el texto en la imagen (fill=0 es color negro)
        draw.text((0, 0), text, font=font, fill=0)
        
        return image, text_height
    except Exception as e:
        print(f"❌ Error al crear la imagen del texto: {e}")
        return None

# --- FUNCIÓN DE IMPRESIÓN PRECISA
def print_ticket(data):
    """Imprime un ticket con la información recibida, usando avance de papel inteligente."""
    
    printer = None 
    try:
        printer = Win32Raw(PRINTER_NAME)
        
        printer._raw(b'\x1b\x33\x00') # Compactación vertical

        # --- Logo de la Notaría ---
        if NOTARIA_LOGO:
            printer.set(align='center')
            printer.image(NOTARIA_LOGO)
        else:
            printer.set(align='center', font='a', bold=True, width=2, height=2)
            printer.textln("NOTARIA TERCERA")
        
        # --- Número del Turno (IMPRESO COMO IMAGEN) ---
        turno_texto = data.get('turno', 'N/A')
        font_size_turno = 80 # Ajusta este valor si es necesario
        
        # 1. AHORA CAPTURAMOS LA IMAGEN Y SU ALTURA
        turno_imagen, turno_altura = create_text_image(turno_texto, FONT_PATH, font_size_turno)
        
        if turno_imagen:
            printer.set(align='center')
            printer.image(turno_imagen) # Imprimimos la imagen

            # 2. ¡LA MAGIA! Avanzamos el papel la altura de la imagen + 10 puntos de margen
            # El comando 'ESC J n' avanza el papel n puntos.
            # Le pasamos la altura exacta de la imagen para crear el espacio perfecto.
            printer._raw(b'\x1b\x4a' + bytes([turno_altura + 10]))

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
        
        # Avanzamos el papel ~2mm antes de cortar
        printer._raw(b'\x1b\x4a\x10')
        
        printer.cut()
        
        # Reseteamos el espacio entre líneas al valor por defecto
        printer._raw(b'\x1b\x32')

        print(f"✅ Ticket para {data.get('turno')} impreso con precisión.")

    except Exception as e:
        print(f"❌ Error durante la impresión: {e}")
    finally:
        if printer:
            printer.close()



# El resto del código (handler, main) no necesita cambios
async def handler(websocket, path):
    print("Cliente web conectado.")
    try:
        async for message in websocket:
            try:
                ticket_data = json.loads(message)
                print_ticket(ticket_data) 
            except json.JSONDecodeError:
                print("Error: Mensaje recibido no es un JSON válido.")
    except websockets.exceptions.ConnectionClosed:
        print("Cliente web desconectado.")

async def main():
    print("🚀 Iniciando servidor de impresión WebSocket en ws://localhost:8765")
    # Ya no intentamos conectar con la impresora al inicio
    async with websockets.serve(handler, "localhost", 8765):
        await asyncio.Future()

if __name__ == "__main__":
    asyncio.run(main())