import asyncio
import websockets
import json
from escpos.printer import Win32Raw
from datetime import datetime

# --- CONFIGURACIÓN DE LA IMPRESORA ---
#reemplazar estos valores con los de la impresora Epson
PRINTER_NAME = "POS-58"

def print_ticket(data):
    """Imprime un ticket abriendo y cerrando la conexión en cada llamada."""
    
    printer = None # Definimos la variable printer aquí
    try:
        # 2. INICIAMOS LA CONEXIÓN DENTRO DE LA FUNCIÓN
        printer = Win32Raw(PRINTER_NAME)
        print(f"✅ Conexión establecida con '{PRINTER_NAME}' para imprimir ticket.")
        
        print(f"📄 Imprimiendo ticket para el turno: {data.get('turno')}")

        # --- Lógica de Impresión (sin cambios) ---
        printer.set(align='center', font='a', bold=True, width=1, height=1)
        printer.textln("NOTARIA TERCERA\n")

        printer.set(align='center', font='a', bold=False, width=1, height=1)
        printer.textln("Su turno es:\n")

        printer.set(align='center', font='a', bold=True, width=3, height=3)
        printer.textln(f"{data.get('turno', 'N/A')}\n")

        printer.set(align='center', font='a', bold=False, width=1, height=1)
        printer.textln(f"Servicio: {data.get('servicio', '')}\n")
        
        now = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        printer.textln(f"{now}\n")

        printer.textln("Por favor, espere su llamado.")
        printer.ln(2)

        printer.cut()
        print(f"✅ Ticket para {data.get('turno')} enviado a la cola de impresión.")

    except Exception as e:
        print(f"❌ Error durante la impresión: {e}")
    finally:
        # 3. ¡EL PASO MÁS IMPORTANTE!
        #    Cerramos la conexión, lo que fuerza la impresión inmediata.
        #    El 'finally' asegura que esto se ejecute incluso si hay un error.
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