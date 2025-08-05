# app.py
# Estructura Inicial de la Aplicación Flask para el Sistema de Turnos

from flask import Flask, render_template, request, redirect, url_for, session, flash
from supabase import create_client, Client
import os
from dotenv import load_dotenv
import logging
#import secrets

#secret_key = secrets.token_hex(32)
#print(secret_key)

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Cargar variables de entorno desde .env (para desarrollo local)
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'super_secret_key_default') # ¡Cambia esto en producción!

# Configuración de Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logging.error("Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están configuradas.")
    # Considera salir o manejar este error de forma más robusta en producción
    supabase = None
else:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logging.info("Conexión a Supabase establecida.")

# --- Rutas de la Aplicación ---

@app.route('/')
def index():
    """
    Ruta principal. Podría redirigir a la interfaz de solicitud de turnos
    o a una página de bienvenida.
    """
    logging.info("Acceso a la ruta /")
    # Ejemplo: Redirigir a la página de solicitud de turnos
    return redirect(url_for('solicitar_turno_ui'))

@app.route('/solicitar-turno')
def solicitar_turno_ui():
    """
    Interfaz para que los clientes soliciten un turno desde la PC táctil.
    Aquí se mostrarán los botones de servicio.
    """
    if supabase is None:
        flash("Error de configuración: No se pudo conectar a la base de datos.", "error")
        return render_template('error.html', message="Problema de configuración del sistema.")

    try:
        # Obtener los servicios disponibles desde Supabase
        response = supabase.table('servicios').select('id_servicio, nombre_servicio, prefijo_ticket').execute()
        
        if response.data:
            servicios = response.data
            logging.info(f"Servicios cargados para solicitar turno: {len(servicios)} servicios encontrados.")
        else:
            servicios = []
            logging.warning("No se encontraron servicios en la base de datos.")
            flash("No hay servicios configurados en este momento. Por favor, intente más tarde.", "warning")

        return render_template('solicitar_turno.html', servicios=servicios)
    except Exception as e:
        logging.error(f"Error al cargar servicios para solicitar turno: {e}")
        flash(f"Error al cargar los servicios: {e}. Por favor, intente de nuevo más tarde.", "error")
        return render_template('error.html', message="No se pudieron cargar los servicios.")



@app.route('/solicitar-turno', methods=['POST'])
def solicitar_turno_action():
    """
    Maneja la lógica cuando un cliente solicita un turno.
    Aquí se crearía el turno en la base de datos y se activaría la impresión.
    """
    if supabase is None:
        flash("Error de configuración: No se pudo conectar a la base de datos.", "error")
        return redirect(url_for('solicitar_turno_ui'))

    id_servicio = request.form.get('id_servicio')
    if not id_servicio:
        flash("Por favor, seleccione un servicio válido.", "warning")
        return redirect(url_for('solicitar_turno_ui'))

    try:
        # Obtener el prefijo del servicio
        service_response = supabase.table('servicios').select('prefijo_ticket').eq('id_servicio', id_servicio).single().execute()
        if not service_response.data:
            flash("Servicio no encontrado o inválido.", "error")
            return redirect(url_for('solicitar_turno_ui'))
        prefijo_ticket = service_response.data['prefijo_ticket']

        # Obtener el último número de turno para este prefijo y calcular el siguiente
        # IMPORTANTE: Esta lógica de secuencia es básica. Para producción, considera
        # usar funciones de base de datos de Supabase o bloqueos transaccionales
        # para evitar problemas de concurrencia en entornos de alto tráfico.
        last_turn_response = supabase.table('turnos') \
            .select('numero_turno') \
            .eq('prefijo_turno', prefijo_ticket) \
            .order('numero_turno', desc=True) \
            .limit(1) \
            .execute()

        last_turn_number = last_turn_response.data[0]['numero_turno'] if last_turn_response.data else 0
        nuevo_numero_turno = last_turn_number + 1

        # Insertar el nuevo turno en la base de datos
        new_turn_data = {
            'numero_turno': nuevo_numero_turno,
            'prefijo_turno': prefijo_ticket,
            'id_servicio': id_servicio,
            'estado': 'en espera'
        }
        insert_response = supabase.table('turnos').insert(new_turn_data).execute()
        
        if insert_response.data:
            logging.info(f"Nuevo turno creado: {insert_response.data[0]['prefijo_turno']}-{insert_response.data[0]['numero_turno']}")
            # Aquí se integraría la lógica para enviar la señal a la aplicación de escritorio
            # para imprimir el ticket.
            return render_template('ticket_confirmacion.html',
                                   turno_id=f"{prefijo_ticket}-{nuevo_numero_turno:03d}")
        else:
            flash("No se pudo crear el turno. Error desconocido.", "error")
            logging.error(f"Error desconocido al insertar turno: {insert_response.error}")
            return redirect(url_for('solicitar_turno_ui'))

    except Exception as e:
        logging.error(f"Error al solicitar turno: {e}")
        flash(f"Error al procesar su solicitud de turno: {e}. Por favor, intente de nuevo.", "error")
        return redirect(url_for('solicitar_turno_ui'))


@app.route('/visualizador')
def visualizador_ui():
    """
    Interfaz para las pantallas de visualización de turnos.
    Actualizaciones en tiempo real se manejarán con la suscripción de Supabase.
    """
    try:
        # Obtener el último turno llamado y el estado de los módulos
        # Esto se actualizará en tiempo real vía Supabase Realtime
        last_called_turn_data = {} # Se llenará con JS
        modules_status_data = [] # Se llenará con JS

        return render_template('visualizador.html',
                               supabase_url=SUPABASE_URL,
                               supabase_key=SUPABASE_KEY)
    except Exception as e:
        logging.error(f"Error al cargar visualizador: {e}")
        flash("Error al cargar el visualizador. Por favor, intente de nuevo más tarde.", "error")
        return render_template('error.html', message="No se pudo cargar el visualizador.")


@app.route('/funcionario/login', methods=['GET', 'POST'])
def funcionario_login():
    """
    Página de inicio de sesión para funcionarios.
    """
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        try:
            # En un sistema real, aquí se verificaría la contraseña hasheada
            # Por simplicidad, solo verificamos el nombre de usuario por ahora
            user_response = supabase.table('usuarios').select('id_usuario, nombre_completo, rol, id_modulo_asignado, contrasena').eq('nombre_usuario', username).single().execute()
            user_data = user_response.data

            if user_data and user_data['contrasena'] == password: # ¡REEMPLAZAR CON VERIFICACIÓN DE HASH!
                session['user_id'] = user_data['id_usuario']
                session['user_name'] = user_data['nombre_completo']
                session['user_role'] = user_data['rol']
                session['assigned_module_id'] = user_data['id_modulo_asignado']
                flash(f"Bienvenido, {user_data['nombre_completo']}!", "success")
                logging.info(f"Usuario {username} ha iniciado sesión.")
                if user_data['rol'] == 'administrador':
                    return redirect(url_for('admin_dashboard'))
                else:
                    return redirect(url_for('funcionario_panel'))
            else:
                flash("Usuario o contraseña incorrectos.", "danger")
                logging.warning(f"Intento de inicio de sesión fallido para {username}.")
        except Exception as e:
            logging.error(f"Error en el inicio de sesión del funcionario: {e}")
            flash("Ocurrió un error al intentar iniciar sesión.", "error")

    return render_template('funcionario_login.html')

@app.route('/funcionario/panel')
def funcionario_panel():
    """
    Panel de atención para funcionarios.
    """
    if 'user_id' not in session or session.get('user_role') not in ['funcionario', 'administrador']:
        flash("Necesita iniciar sesión para acceder a esta página.", "info")
        return redirect(url_for('funcionario_login'))

    user_id = session['user_id']
    user_name = session['user_name']
    assigned_module_id = session.get('assigned_module_id')

    try:
        # Obtener los servicios que atiende este módulo (si está asignado)
        servicios_atendidos = []
        if assigned_module_id:
            service_module_response = supabase.table('modulos_servicios') \
                .select('servicios(id_servicio, nombre_servicio, prefijo_ticket)') \
                .eq('id_modulo', assigned_module_id) \
                .execute()
            servicios_atendidos = [s['servicios'] for s in service_module_response.data]

        # Obtener turnos pendientes para este módulo/servicios
        # Esto se actualizará en tiempo real vía Supabase Realtime
        turnos_pendientes = [] # Se llenará con JS

        # Obtener historial de turnos atendidos por este funcionario
        historial_turnos = [] # Se llenará con JS

        return render_template('funcionario_panel.html',
                               user_name=user_name,
                               module_id=assigned_module_id,
                               servicios_atendidos=servicios_atendidos,
                               supabase_url=SUPABASE_URL,
                               supabase_key=SUPABASE_KEY)
    except Exception as e:
        logging.error(f"Error al cargar el panel del funcionario: {e}")
        flash("Error al cargar el panel. Por favor, intente de nuevo más tarde.", "error")
        return redirect(url_for('funcionario_login'))


@app.route('/admin/dashboard')
def admin_dashboard():
    """
    Panel de administración para superusuarios.
    """
    if 'user_id' not in session or session.get('user_role') != 'administrador':
        flash("Acceso denegado. Solo administradores pueden acceder a esta página.", "danger")
        return redirect(url_for('funcionario_login'))

    if supabase is None:
        flash("Error de configuración: No se pudo conectar a la base de datos.", "error")
        return render_template('error.html', message="Problema de configuración del sistema.")

    try:
        # Aquí se cargarían los datos para el dashboard:
        # - Número de turnos en espera
        # - Total de turnos atendidos en el día
        # - Estado de cada ventanilla
        # Estos datos se pueden obtener de Supabase o se pueden cargar en el frontend con JS.
        return render_template('admin_dashboard.html',
                               supabase_url=SUPABASE_URL, # ¡Asegurarse de pasar la URL!
                               supabase_key=SUPABASE_KEY,   # ¡Asegurarse de pasar la KEY!
                               user_name=session.get('user_name', 'Administrador')) # También pasamos el nombre
    except Exception as e:
        logging.error(f"Error al cargar el dashboard de administración: {e}")
        flash("Error al cargar el dashboard. Por favor, intente de nuevo más tarde.", "error")
        return redirect(url_for('funcionario_login'))

@app.route('/logout')
def logout():
    """
    Cierra la sesión del usuario.
    """
    session.pop('user_id', None)
    session.pop('user_name', None)
    session.pop('user_role', None)
    session.pop('assigned_module_id', None)
    flash("Has cerrado sesión exitosamente.", "info")
    logging.info("Sesión cerrada.")
    return redirect(url_for('funcionario_login'))

# --- Funciones de API (para HTMX o llamadas directas) ---

# Ejemplo de API para llamar al siguiente turno
@app.route('/api/call_next_turn', methods=['POST'])
def api_call_next_turn():
    if 'user_id' not in session or session.get('user_role') not in ['funcionario', 'administrador']:
        return {"status": "error", "message": "No autorizado"}, 401

    user_id = session['user_id']
    module_id = session.get('assigned_module_id')

    if not module_id:
        return {"status": "error", "message": "Funcionario no asignado a un módulo."}, 400

    try:
        # Lógica para encontrar el siguiente turno disponible para este módulo
        # y actualizar su estado a 'en atencion'.
        # Esto es complejo y requerirá transacciones y manejo de concurrencia.
        # Por ahora, es un placeholder.
        # La actualización en Supabase Realtime notificará a los visualizadores.
        logging.info(f"Funcionario {user_id} en módulo {module_id} intentando llamar siguiente turno.")
        # Simulación de llamada exitosa
        # response = supabase.table('turnos').update({'estado': 'en atencion', 'hora_llamado': 'NOW()', 'id_modulo_atencion': module_id}).eq('id_turno', some_turn_id).execute()
        # supabase.table('logs_turnos').insert({'id_turno': some_turn_id, 'id_usuario': user_id, 'accion': 'llamado'}).execute()

        return {"status": "success", "message": "Turno llamado (simulado)."}, 200
    except Exception as e:
        logging.error(f"Error en api_call_next_turn: {e}")
        return {"status": "error", "message": f"Error al llamar turno: {e}"}, 500


# --- Ejecución de la Aplicación ---
if __name__ == '__main__':
    # Para desarrollo, puedes usar app.run(debug=True)
    # En producción, usa un servidor WSGI como Gunicorn o uWSGI
    app.run(debug=True, host='0.0.0.0', port=5000)

