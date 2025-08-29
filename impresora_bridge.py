import asyncio
import websockets
import json
from escpos.printer import Win32Raw
from datetime import datetime
from PIL import Image

# --- CONFIGURACIÓN ---
#reemplazar estos valores con los de la impresora Epson
PRINTER_NAME = "POS-58"
LOGO_PATH = "logo_dimensionado.jpg"

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

# --- FUNCIÓN DE IMPRESIÓN PRECISA
def print_ticket(data):
    """Imprime un ticket abriendo y cerrando la conexión en cada llamada."""
    printer = None 
    try:
        printer = Win32Raw(PRINTER_NAME)
        print(f"✅ Conexión establecida con '{PRINTER_NAME}' para imprimir ticket.")
        #print(f"📄 Imprimiendo ticket para el turno: {data.get('turno')}")
        
        #=================================================
        #INICIO DE LA MAGIA: CONTROL DE PRECISIÓN
        #se reducirá el espacio entre líneaas al mínimo posible
        #la idea es compactar el ticket
        printer._raw(b'\x1b\x33\x00')
        #=================================================
        # --- Logo de la Notaría ---
        if NOTARIA_LOGO:
            printer.set(align='center') # Centra la imagen
            printer.image(NOTARIA_LOGO) # Imprime el logo
        else:
            # Si no hay logo, imprime el nombre como antes
            printer.set(align='center', font='a', bold=True, width=2, height=2)
            printer.textln("NOTARIA TERCERA DE VALLEDUPAR")
        printer.textln("--------------------------------")
        # --- Texto "Su turno es:" (normal) ---
        printer.set(align='center', font='a', bold=False, width=1, height=1)
        printer.textln("Su turno es:")

        # --- Número del Turno (MÁS GRANDE POSIBLE) ---
        printer.set(align='center', font='b', bold=True, width=8, height=8) 
        printer.textln(f"{data.get('turno', 'N/A')}")

        # --- Servicio Solicitado (normal) ---
        printer.set(align='center',font='a',bold=False,width=1,height=1)
        printer.textln(f"{data.get('servicio', '')}")
        printer.textln("--------------------------------")
        # --- Fecha y Hora ---
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        printer.textln(f"{now}\n")
        # --- Pie de página ---
        printer.textln("Por favor, espere su llamado.")
        printer.textln("Gracias por su visita.")
        # ======================================================================
        # FIN DE LA MAGIA: CORTE PRECISO
        # El comando 'ESC J n' avanza el papel n/203 pulgadas.
        # Para avanzar ~2mm, necesitamos avanzar unos 16 "puntos" (8 dots/mm * 2mm).
        # El valor 16 en hexadecimal es \x10.
        printer._raw(b'\x1b\x4a\x10')
        # ======================================================================
        
        printer.cut()
        # Reseteamos el espacio entre líneas al valor por defecto para futuros trabajos
        printer._raw(b'\x1b\x32')
        print(f"✅ Ticket para {data.get('turno')} enviado a la cola de impresión.")

    except Exception as e:
        print(f"❌ Error durante la impresión: {e}")
    finally:
        if printer:
            printer.close()
            print("✅ Conexión con la impresora cerrada.")



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