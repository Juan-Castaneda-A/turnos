#Estructura Inicial de la Aplicación Flask para el Sistema de Turnos
from flask import Flask, render_template, request, redirect, url_for, session, flash, g, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from supabase import create_client, Client
import os
import requests
from dotenv import load_dotenv
import logging
import uuid
from datetime import datetime, timedelta, timezone

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Cargar variables de entorno desde .env (para desarrollo local)
load_dotenv()

app = Flask(__name__)
TTS_CACHE = {}
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'super_secret_key_default') # ¡Cambia esto en producción!

# Configuración de Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logging.error("Las variables de entorno SUPABASE_URL o SUPABASE_KEY no están configuradas.")
    # Considera salir o manejar este error de forma más robusta en producción
    supabase = None
else:
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
        logging.info("Conexión a Supabase establecida.")
    except Exception as e:
        logging.error(f"Error al inicializar cliente Supabase: {e}")
        supabase = None


#Duración de la sesión del Token (ej. 8 horas)
SESSION_TOKEN_LIFESPAN_HOURS = 8

# --- Middleware para cargar usuario desde el token de sesión --- #
@app.before_request
def load_logged_in_user():
    """
    Carga la información del usuario en el objeto 'g' (global request context)
    basándose en el token de sesión almacenado en la cookie.
    """
    session_token = session.get('session_token')
    g.user = None #por defecto, no hay usuario logueado

    if session_token:
        try:
            #Buscar la sesión en la base de datos
            response = supabase.table('user_sessions') \
                .select('user_id, role, assigned_module_id, usuarios(nombre_completo)')\
                .eq('session_token',session_token) \
                .gte('expires_at',datetime.now(timezone.utc).isoformat()) \
                .single() \
                .execute()
            
            if response.data:
                user_session_data = response.data
                #Almacenar la información del usuario en 'g.user'
                g.user = {
                    'id': user_session_data['user_id'],
                    'name': user_session_data['usuarios']['nombre_completo'],
                    'role': user_session_data['role'],
                    'assigned_module_id': user_session_data['assigned_module_id']
                }
                logging.info(f"Usuario {g.user['name']} ({g.user['role']}) cargado para la petición.")
            else:
                #Sesión no encontrada o expirada, limpiar la cookie
                session.pop('session_token',None)
                logging.info("Token de sesión no válido o expirado, cookie de sesión limpiada.")
        
        except Exception as e:
            logging.error(f"Error al cargar usuario desde el token de sesión: {e}")
            session.pop('session_token',None) #Limpiar por si acaso

# --- Decorador para rutas protegidas --- #
def login_required(f):
    """
    Decorador para proteger rutas que requieren autenticación
    """
    from functools import wraps
    @wraps(f)
    def decorated_function(*args,**kwargs):
        if g.user is None:
            flash("Necesita iniciar sesión para acceder a esta página.", "info")
            return redirect(url_for('funcionario_login'))
        return f(*args,**kwargs)
    return decorated_function

def admin_required(f):
    """
    Decorador para proteger rutas que requieren rol de administrador
    """
    from functools import wraps
    @wraps(f)
    def decorated_function(*args,**kwargs):
        if g.user is None or g.user['role'] != 'administrador':
            flash("Acceso denegado. Solo administradores pueden acceder a esta página.", "danger")
            return redirect(url_for('funcionario_login'))
        return f(*args,**kwargs)
    return decorated_function

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
    Maneja la lógica cuando un cliente solicita un turno llamando
    a una función RPC de Supabase para evitar condiciones de carrera.
    """
    if supabase is None:
        flash("Error de configuración: No se pudo conectar a la base de datos.", "error")
        return redirect(url_for('solicitar_turno_ui'))
    #1. Obtenemos los nuevos datos del formulario
    id_servicio = request.form.get('id_servicio')
    numero_identificacion = request.form.get('numero_identificacion')
    nombre_completo = request.form.get('nombre_completo')

    if not all([id_servicio, numero_identificacion, nombre_completo]):
        flash("Todos los campos son requeridos.", "warning")
        return redirect(url_for('solicitar_turno_ui'))

    try:
        # 2. Lógica para "obtener o crear" el cliente
        #Primero, se busca si el cliente ya existe
        cliente_response = supabase.table('clientes').select('id_cliente').eq('numero_identificacion', numero_identificacion).execute()

        if cliente_response.data:
            id_cliente = cliente_response.data[0]['id_cliente'] # Si existe, usamos su ID
        else:
            nuevo_cliente = supabase.table('clientes').insert({ # Si no existe, lo insertamos y obtenemos el nuevo ID
                'numero_identificacion': numero_identificacion,
                'nombre_completo': nombre_completo
            }).execute()
            id_cliente = nuevo_cliente.data[0]['id_cliente']
        # --- Lógica Antigua (eliminada) ---
        # Ya no necesitamos obtener el prefijo ni calcular el último número aquí.
        # La función de la base de datos 'crear_nuevo_turno' hace todo eso.

        # --- Nueva Lógica: Llamada a la Función RPC ---
        # Simplemente llamamos a la función que creamos en Supabase y le pasamos el id_servicio.
        
        params = {'_id_servicio': int(id_servicio), '_id_cliente': id_cliente}
        response = supabase.rpc('crear_nuevo_turno', params).execute()

        if response.data:
            # La función nos devuelve la fila completa del turno que se creó
            nuevo_turno_data = response.data
            prefijo_ticket = nuevo_turno_data['prefijo_turno']
            nuevo_numero_turno = nuevo_turno_data['numero_turno']
            
            #Obtener el nombre del servicio para pasarlo a la plantilla
            response_servicio = supabase.table('servicios').select('nombre_servicio').eq('id_servicio', nuevo_turno_data['id_servicio']).single().execute()
            nombre_servicio = response_servicio.data['nombre_servicio'] if response_servicio.data else ''

            logging.info(f"Nuevo turno creado vía RPC: {prefijo_ticket}-{nuevo_numero_turno}")
            
            # Aquí se integraría la lógica para imprimir el ticket.
            return render_template('ticket_confirmacion.html',
                                   turno_id=f"{prefijo_ticket}-{nuevo_numero_turno:03d}",
                                   servicio_nombre=nombre_servicio)
        else:
            # Esto podría pasar si la función RPC lanza un error (ej. servicio no existe)
            error_message = response.error.message if response.error else "Error desconocido al crear el turno."
            flash(f"No se pudo crear el turno: {error_message}", "error")
            logging.error(f"Error al llamar RPC 'crear_nuevo_turno': {error_message}")
            return redirect(url_for('solicitar_turno_ui'))

    except Exception as e:
        logging.error(f"Excepción al solicitar turno con RPC: {e}")
        flash(f"Error al procesar su solicitud de turno. Por favor, intente de nuevo.", "error")
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
    Página de inicio de sesión para funcionarios. Ahora con verificación de hash.
    """
    if g.user:
        if g.user['role'] == 'administrador':
            return redirect(url_for('admin_dashboard'))
        else:
            return redirect(url_for('funcionario_panel'))
        
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        try:
            # En un sistema real, aquí se verificaría la contraseña hasheada
            # Por simplicidad, solo verificamos el nombre de usuario por ahora
            user_response = supabase.table('usuarios').select('id_usuario, nombre_completo, rol, id_modulo_asignado, contrasena').eq('nombre_usuario', username).single().execute()
            user_data = user_response.data

            #-- línea donde se checkea la contraseña hasheada

            if user_data and check_password_hash(user_data['contrasena'], password): # ¡REEMPLAZAR CON VERIFICACIÓN DE HASH!
                #Generar un token de sesión único   
                new_session_token = str(uuid.uuid4())
                #Calcular la fecha de expiración
                expires_at = datetime.now(timezone.utc) + timedelta(hours=SESSION_TOKEN_LIFESPAN_HOURS)

                #Insertar la nueva sesión en la base de datos
                session_insert_data = {
                    'user_id': user_data['id_usuario'],
                    'session_token': new_session_token,
                    'role': user_data['rol'],
                    'assigned_module_id': user_data['id_modulo_asignado'],
                    'expires_at': expires_at.isoformat()
                }
                session_response = supabase.table('user_sessions').insert(session_insert_data).execute()
                if session_response.data:
                    #Almacenar SOLO el token de sesión en la cookie de Flask
                    session['session_token'] = new_session_token
                    flash(f"Bienvenido, {user_data['nombre_completo']}!","success")
                    logging.info(f"Usuario {username} ha iniciado sesión con nuevo token.")
                    if user_data['rol'] == 'administrador':
                        return redirect(url_for('admin_dashboard'))
                    else:
                        return redirect(url_for('funcionario_panel'))
                else: 
                    flash("Error al crear la sesión. Por favor, intente de nuevo.", "error")
                    logging.error(f"Error al insertar sesión en base de datos: {session_response.error}")

                #session['user_id'] = user_data['id_usuario']
                #session['user_name'] = user_data['nombre_completo']
                #session['user_role'] = user_data['rol']
                #session['assigned_module_id'] = user_data['id_modulo_asignado']
                #flash(f"Bienvenido, {user_data['nombre_completo']}!", "success")
                #logging.info(f"Usuario {username} ha iniciado sesión.")
                #if user_data['rol'] == 'administrador':
                #    return redirect(url_for('admin_dashboard'))
                #else:
                #    return redirect(url_for('funcionario_panel'))
            else:
                flash("Usuario o contraseña incorrectos.", "danger")
                logging.warning(f"Intento de inicio de sesión fallido para {username}.")
        except Exception as e:
            logging.error(f"Error en el inicio de sesión del funcionario: {e}")
            flash("Ocurrió un error al intentar iniciar sesión.", "error")

    return render_template('funcionario_login.html')

@app.route('/funcionario/panel')
@login_required # Proteger esta ruta
def funcionario_panel():
    #g.user ya contiene la información del usuario gracias al before_request y login_required
    """
    Panel de atención para funcionarios.
    """
    return render_template('funcionario_panel.html',
                           user_name=g.user['name'],
                           supabase_url=SUPABASE_URL,
                           supabase_key=SUPABASE_KEY,
                           session_user_id=g.user['id'], #pasar el ID real desde g.user
                           session_assigned_module_id=g.user['assigned_module_id']) #pasar el módulo desde g.user
    #if 'user_id' not in session or session.get('user_role') not in ['funcionario', 'administrador']:
    #    flash("Necesita iniciar sesión para acceder a esta página.", "info")
    #    return redirect(url_for('funcionario_login'))

    #user_id = session['user_id']
    #user_name = session['user_name']
    #assigned_module_id = session.get('assigned_module_id')

    #try:
        # Obtener los servicios que atiende este módulo (si está asignado)
    #    servicios_atendidos = []
    #    if assigned_module_id:
    #        service_module_response = supabase.table('modulos_servicios') \
    #            .select('servicios(id_servicio, nombre_servicio, prefijo_ticket)') \
    #            .eq('id_modulo', assigned_module_id) \
    #            .execute()
    #        servicios_atendidos = [s['servicios'] for s in service_module_response.data]

        # Obtener turnos pendientes para este módulo/servicios
        # Esto se actualizará en tiempo real vía Supabase Realtime
    #    turnos_pendientes = [] # Se llenará con JS

        # Obtener historial de turnos atendidos por este funcionario
    #    historial_turnos = [] # Se llenará con JS

    #    return render_template('funcionario_panel.html',
    #                           user_name=user_name,
    #                           module_id=assigned_module_id,
    #                           servicios_atendidos=servicios_atendidos,
    #                           supabase_url=SUPABASE_URL,
    #                           supabase_key=SUPABASE_KEY)
    #except Exception as e:
    #    logging.error(f"Error al cargar el panel del funcionario: {e}")
    #    flash("Error al cargar el panel. Por favor, intente de nuevo más tarde.", "error")
    #    return redirect(url_for('funcionario_login'))


@app.route('/admin/dashboard')
@admin_required #proteger esta ruta y requerir rol de administrador
def admin_dashboard():
    """
    Panel de administración para superusuarios.
    """
    #g.user ya contiene la información del usuario gracias al before_request y admin_required
    return render_template('admin_dashboard.html',
                           supabase_url=SUPABASE_URL,
                           supabase_key=SUPABASE_KEY,
                           user_name=g.user['name']) #user el nombre de g.user
    #if 'user_id' not in session or session.get('user_role') != 'administrador':
    #    flash("Acceso denegado. Solo administradores pueden acceder a esta página.", "danger")
    #    return redirect(url_for('funcionario_login'))

    #if supabase is None:
    #    flash("Error de configuración: No se pudo conectar a la base de datos.", "error")
    #    return render_template('error.html', message="Problema de configuración del sistema.")

    #try:
        # Aquí se cargarían los datos para el dashboard:
        # - Número de turnos en espera
        # - Total de turnos atendidos en el día
        # - Estado de cada ventanilla
        # Estos datos se pueden obtener de Supabase o se pueden cargar en el frontend con JS.
    #    return render_template('admin_dashboard.html',
    #                           supabase_url=SUPABASE_URL, # ¡Asegurarse de pasar la URL!
    #                           supabase_key=SUPABASE_KEY,   # ¡Asegurarse de pasar la KEY!
    #                           user_name=session.get('user_name', 'Administrador')) # También pasamos el nombre
    #except Exception as e:
    #    logging.error(f"Error al cargar el dashboard de administración: {e}")
    #    flash("Error al cargar el dashboard. Por favor, intente de nuevo más tarde.", "error")
    #    return redirect(url_for('funcionario_login'))

@app.route('/logout')
def logout():
    """
    Cierra la sesión del usuario.
    """
    session_token = session.get('session_token')
    if session_token:
        try:
            #Eliminar la sesión de la base de datos
            supabase.table('user_sessions').delete().eq('session_token',session_token).execute()
            logging.info(f"Sesión con token {session_token} eliminada de la base de datos.")
        except Exception as e:
            logging.error(f"Error al eliminar sesión de la base de datos: {e}")
    
    #Limpiar la cookie de sesión de Flask
    #session.pop('user_id', None)
    #session.pop('user_name', None)
    #session.pop('user_role', None)
    #session.pop('assigned_module_id', None)
    #flash("Has cerrado sesión exitosamente.", "info")
    session.pop('session_token',None)
    flash("Has cerrado sesión exitosamente.","info")
    logging.info("Cookie de sesión limpiada.")
    return redirect(url_for('funcionario_login'))

# --- Funciones de API (para HTMX o llamadas directas) ---

# Ejemplo de API para llamar al siguiente turno
#@app.route('/api/call_next_turn', methods=['POST'])
#def api_call_next_turn():
#    if 'user_id' not in session or session.get('user_role') not in ['funcionario', 'administrador']:
#        return {"status": "error", "message": "No autorizado"}, 401

#    user_id = session['user_id']
#    module_id = session.get('assigned_module_id')

#    if not module_id:
#        return {"status": "error", "message": "Funcionario no asignado a un módulo."}, 400

#    try:
        # Lógica para encontrar el siguiente turno disponible para este módulo
        # y actualizar su estado a 'en atencion'.
        # Esto es complejo y requerirá transacciones y manejo de concurrencia.
        # Por ahora, es un placeholder.
        # La actualización en Supabase Realtime notificará a los visualizadores.
#        logging.info(f"Funcionario {user_id} en módulo {module_id} intentando llamar siguiente turno.")
        # Simulación de llamada exitosa
        # response = supabase.table('turnos').update({'estado': 'en atencion', 'hora_llamado': 'NOW()', 'id_modulo_atencion': module_id}).eq('id_turno', some_turn_id).execute()
        # supabase.table('logs_turnos').insert({'id_turno': some_turn_id, 'id_usuario': user_id, 'accion': 'llamado'}).execute()

#        return {"status": "success", "message": "Turno llamado (simulado)."}, 200
#    except Exception as e:
#        logging.error(f"Error en api_call_next_turn: {e}")
#        return {"status": "error", "message": f"Error al llamar turno: {e}"}, 500


# --- API Segura para Administración ---

@app.route('/api/save-user', methods=['POST'])
@admin_required # ¡Muy importante! Solo los admins pueden acceder
def api_save_user():
    """
    Endpoint para crear o actualizar usuarios de forma segura.
    Recibe datos JSON desde el panel de administración.
    """
    if not request.is_json:
        return jsonify({"success": False, "error": "La solicitud debe ser JSON"}), 400

    data = request.get_json()
    user_id = data.get('id_usuario')

    # Validaciones básicas
    if not data.get('nombre_completo') or not data.get('nombre_usuario'):
        return jsonify({"success": False, "error": "Nombre completo y nombre de usuario son requeridos."}), 400

    try:
        user_data = {
            'nombre_completo': data.get('nombre_completo'),
            'nombre_usuario': data.get('nombre_usuario'),
            'rol': data.get('rol', 'funcionario'),
            'id_modulo_asignado': data.get('id_modulo_asignado')
        }

        # --- Lógica de Hashing de Contraseña ---
        # Solo hashea y guarda la contraseña si se proporcionó una.
        password = data.get('password')
        if password:
            user_data['contrasena'] = generate_password_hash(password)

        if user_id:
            # --- Actualizar Usuario Existente ---
            if not password:
                # Si no se envía contraseña al editar, no se actualiza
                user_data.pop('contrasena', None) 

            response = supabase.table('usuarios').update(user_data).eq('id_usuario', user_id).execute()
        else:
            # --- Crear Nuevo Usuario ---
            if not password:
                return jsonify({"success": False, "error": "La contraseña es requerida para nuevos usuarios."}), 400
            response = supabase.table('usuarios').insert(user_data).execute()

        if response.data:
            logging.info(f"Usuario {'actualizado' if user_id else 'creado'} exitosamente por {g.user['name']}.")
            return jsonify({"success": True, "message": "Usuario guardado exitosamente."}), 200
        else:
            logging.error(f"Error de Supabase al guardar usuario: {response.error}")
            return jsonify({"success": False, "error": str(response.error)}), 500

    except Exception as e:
        logging.error(f"Error en api_save_user: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/check-cliente/<identificacion>')
def check_cliente(identificacion):
    """
    Verifica si un cliente existe por su número de identificación
    y devuelve su nombre si lo encuentra.
    """
    try:
        response = supabase.table('clientes').select('nombre_completo').eq('numero_identificacion', identificacion).single().execute()
        if response.data:
            return jsonify(response.data) # Devuelve {"nombre_completo": "Juan Perez"} si lo encuentra
        else:
            return jsonify(None) # Devuelve null si no lo encuentra
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# @app.route('/api/text-to-speech', methods=['POST'])
# def text_to_speech():
#     """
#     Endpoint seguro que actúa como proxy para la API de Gemini TTS.
#     Recibe texto y devuelve el audio generado.
#     """
#     if not request.is_json:
#         return jsonify({"error": "La solicitud debe ser JSON"}), 400

#     data = request.get_json()
#     text_to_speak = data.get('text')

#     if not text_to_speak:
#         return jsonify({"error": "No se proporcionó texto"}), 400

#     # Carga la API Key de forma segura desde las variables de entorno
#     GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
#     if not GEMINI_API_KEY:
#         logging.error("La variable de entorno GEMINI_API_KEY no está configurada.")
#         return jsonify({"error": "El servicio de voz no está configurado en el servidor."}), 500

#     # La misma estructura de payload que tenías en el frontend
#     payload = {
#         "contents": [{"parts": [{"text": text_to_speak}]}],
#         "generationConfig": {
#             "responseModalities": ["AUDIO"],
#             "speechConfig": {
#                 "voiceConfig": {
#                     "prebuiltVoiceConfig": {"voiceName": "Charon"}
#                 }
#             }
#         },
#         "model": "gemini-2.5-flash-preview-tts"
#     }

#     api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={GEMINI_API_KEY}"

#     try:
#         # Llamada a la API de Gemini desde el backend
#         response = requests.post(api_url, json=payload)

#         # Si la respuesta de Google no es exitosa, devuelve el error
#         response.raise_for_status() 

#         # Devuelve la respuesta JSON de Gemini directamente al frontend
#         return jsonify(response.json())

#     except requests.exceptions.RequestException as e:
#         logging.error(f"Error al llamar a la API de Gemini: {e}")
#         return jsonify({"error": f"Error de comunicación con el servicio de voz: {e}"}), 502 # 502 Bad Gateway

@app.route('/api/reports')
@admin_required #para proteger la ruta
def get_reports():
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    user_id = request.args.get('user_id')
    module_id = request.args.get('module_id')

    if not start_date or not end_date:
        return jsonify({"error": "Se requieren fechas de inicio y fin"}), 400
    
    try:
        params = {
            'start_date': start_date,
            'end_date': end_date
        }
        if user_id:
            params['_user_id'] = int(user_id)
        if module_id:
            params['_module_id'] = int(module_id)
        
        response = supabase.rpc('get_report_data', params).execute()

        if response.data:
            return jsonify(response.data)
        else:
            return jsonify([])
        
    except Exception as e:
        logging.error(f"Error al generar el reporte: {e}")
        return jsonify({"error": str(e)}), 500

# --- Ejecución de la Aplicación ---
if __name__ == '__main__':
    # Para desarrollo, puedes usar app.run(debug=True)
    # En producción, usa un servidor WSGI como Gunicorn o uWSGI
    app.run(debug=True, host='0.0.0.0', port=5000)

