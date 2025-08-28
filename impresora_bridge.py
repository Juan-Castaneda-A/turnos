import asyncio
import websockets
import json
from escpos.printer import Win32Raw
from datetime import datetime
from PIL import Image

# --- CONFIGURACIÓN DE LA IMPRESORA ---
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


def print_ticket(data):
    """Imprime un ticket abriendo y cerrando la conexión en cada llamada."""
    
    printer = None 
    try:
        printer = Win32Raw(PRINTER_NAME)
        print(f"✅ Conexión establecida con '{PRINTER_NAME}' para imprimir ticket.")
        
        print(f"📄 Imprimiendo ticket para el turno: {data.get('turno')}")

        # --- Logo de la Notaría ---
        if NOTARIA_LOGO:
            printer.set(align='center') # Centra la imagen
            printer.image(NOTARIA_LOGO) # Imprime el logo
        # else:
        #     # Si no hay logo, imprime el nombre como antes
        #     printer.set(align='center', font='a', bold=True, width=1, height=1)
        #     printer.textln("NOTARIA TERCERA DE VALLEDUPAR")
        # printer.textln("--------------------------------")
        # --- Texto "Su turno es:" (normal) ---
        printer.set(align='center', font='a', bold=False, width=1, height=1)
        printer.textln("Su turno es:") 
        printer.textln() # Salto de línea

        # --- Número del Turno (MÁS GRANDE) ---
        # Aumentamos el ancho y alto a 4 para que sea mucho más grande
        printer.set(align='center', font='a', bold=True, width=4, height=4) 
        printer.textln(f"{data.get('turno', 'N/A')}")
        printer.textln() # Salto de línea después del número grande

        # --- Servicio Solicitado (normal) ---
        printer.textln("Servicio:")
        printer.textln(data.get('servicio', ''))
        printer.textln("--------------------------------")
        # --- Fecha y Hora ---
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        printer.textln(f"{now}\n")
        # --- Pie de página ---
        printer.textln("Por favor, espere su llamado.")
        printer.textln("Gracias por su visita.")
        printer.cut()
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