import asyncio
import websockets
import json
from escpos.printer import Usb

# --- CONFIGURACIÓN DE LA IMPRESORA ---
#reemplazar estos valores con los de la impresora Epson
ID_VENDOR = 0x04b8 
ID_PRODUCT = 0x0e28 

try:
    # Inicializa la conexión con la impresora
    printer = Usb(ID_VENDOR, ID_PRODUCT)
    print("✅ Impresora conectada y lista.")
except Exception as e:
    print(f"❌ Error al conectar con la impresora: {e}")
    print("Asegúrate de que la impresora esté conectada y los IDs de Vendor/Product son correctos.")
    printer = None

async def print_ticket(data):
    if not printer:
        print("Impresora no disponible, no se puede imprimir.")
        return

    try:
        print(f"Imprimiendo ticket: {data}")

        # --- Lógica de Impresión ESC/POS ---
        printer.set(align='center', text_type='B', width=2, height=2)
        printer.textln("NOTARIA TERCERA\n") # `textln` imprime y añade un salto de línea

        printer.set(align='center', text_type='A', width=1, height=1)
        printer.textln("Su turno es:\n")

        printer.set(align='center', text_type='B', width=3, height=3)
        printer.textln(f"{data.get('turno', 'N/A')}\n")

        printer.set(align='center', text_type='A', width=1, height=1)
        printer.textln(f"Servicio: {data.get('servicio', '')}\n")

        # Imprime la fecha y hora
        from datetime import datetime
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        printer.textln(f"{now}\n")

        printer.textln("Por favor, espere su llamado.")

        # Corta el papel
        printer.cut()

    except Exception as e:
        print(f"Error durante la impresión: {e}")

async def handler(websocket, path):
    print("Cliente web conectado.")
    try:
        async for message in websocket:
            try:
                ticket_data = json.loads(message)
                await print_ticket(ticket_data)
            except json.JSONDecodeError:
                print("Error: Mensaje recibido no es un JSON válido.")
    except websockets.exceptions.ConnectionClosed:
        print("Cliente web desconectado.")
    finally:
        print("Esperando nueva conexión...")

async def main():
    # Inicia el servidor de WebSockets en localhost, puerto 8765
    async with websockets.serve(handler, "localhost", 8765):
        print("🚀 Servidor de impresión WebSocket iniciado en ws://localhost:8765")
        await asyncio.Future()  # Corre indefinidamente

if __name__ == "__main__":
    asyncio.run(main())