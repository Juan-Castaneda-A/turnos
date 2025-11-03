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
def load_context():
    """
    Carga la ORGANIZACIÓN y el USUARIO en el objeto 'g' (global request context).
    La organización se determina por el subdominio.
    """
    g.user = None
    g.org = None 

    try:
        host = request.host.split(':')[0]
        subdomain = host.split('.')[0]
        
        logging.info(f"--- DEBUGGING MULTI-TENANT (v3) ---")
        logging.info(f"Host: {host}, Subdominio: {subdomain}")

        # 1. Intentamos buscar en la columna de PRODUCCIÓN ('subdominio')
        #    ¡¡SIN .single()!!
        org_response = supabase.table('organizaciones') \
            .select('id_organizacion, nombre_organizacion, subdominio, configuracion') \
            .eq('subdominio', subdomain) \
            .execute()

        # 2. Si NO se encuentra (lista vacía)...
        if not org_response.data:
            logging.warning(f"No en 'subdominio'. Intentando 'subdominio_local'...")
            
            # ...intentamos buscar en la columna LOCAL ('subdominio_local')
            #    ¡¡SIN .single()!!
            org_response = supabase.table('organizaciones') \
                .select('id_organizacion, nombre_organizacion, subdominio, configuracion') \
                .eq('subdominio_local', subdomain) \
                .execute()

        # 3. Ahora verificamos si, después de AMBOS intentos, lo encontramos.
        if not org_response.data:
            # Sigue sin encontrarse. 0 filas.
            logging.warning(f"Subdominio '{subdomain}' NO ENCONTRADO.")
            
            # ¡MEJORA! Si la petición es a una API, devolver JSON, no HTML.
            if request.path.startswith('/api/'):
                return jsonify({"success": False, "error": "Organización no identificada"}), 404
            return render_template('error.html', message="La organización solicitada no existe.")

        if len(org_response.data) > 1:
            # Esto no debería pasar si las columnas son UNIQUE, pero es un buen control.
            logging.error(f"¡Error! Múltiples organizaciones encontradas para '{subdomain}'")
            if request.path.startswith('/api/'):
                return jsonify({"success": False, "error": "Configuración de organización duplicada"}), 500
            return render_template('error.html', message="Error de configuración del sistema.")

        # ¡Éxito! Tenemos exactamente 1 fila.
        g.org = org_response.data[0] # Tomamos el primer (y único) elemento
        logging.info(f"Contexto cargado para: {g.org['nombre_organizacion']}")

    except Exception as e:
        # Esto ahora solo atrapará errores REALES (ej. no se puede conectar a Supabase)
        logging.error(f"Error crítico al cargar contexto de organización: {e}")
        if request.path.startswith('/api/'):
            return jsonify({"success": False, "error": f"Error interno del servidor: {e}"}), 500
        return render_template('error.html', message="Error al identificar la organización.")

    # 4. Cargar el usuario (sin cambios)
    session_token = session.get('session_token')
    if session_token:
        try:
            # Esta lógica está bien porque aquí SÍ esperamos un error si el token no existe
            response = supabase.table('user_sessions') \
                .select('user_id, role, assigned_module_id, usuarios(nombre_completo)') \
                .eq('session_token', session_token) \
                .eq('id_organizacion', g.org['id_organizacion']) \
                .gte('expires_at', datetime.now(timezone.utc).isoformat()) \
                .single() \
                .execute()
            
            if response.data:
                user_session_data = response.data
                g.user = {
                    'id': user_session_data['user_id'],
                    'name': user_session_data['usuarios']['nombre_completo'],
                    'role': user_session_data['role'],
                    'assigned_module_id': user_session_data['assigned_module_id']
                }
            else:
                session.pop('session_token', None)
        
        except Exception as e:
            # Esto es normal si el token es inválido o expiró
            logging.info(f"Token de sesión no válido o expirado: {e}")
            session.pop('session_token', None)

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
    if not g.org:
         return render_template('error.html', message="Kiosko no configurado para una organización.")
    
    if supabase is None:
        flash("Error de configuración: No se pudo conectar a la base de datos.", "error")
        return render_template('error.html', message="Problema de configuración del sistema.")

    try:
        # Obtener los servicios disponibles desde Supabase
        response = (supabase.table('servicios')
            .select('id_servicio, nombre_servicio, prefijo_ticket') \
            .eq('id_organizacion', g.org['id_organizacion']) # <-- FILTRO MULTI-TENANT
            .execute())
        
        if response.data:
            servicios = response.data
            logging.info(f"Servicios cargados para solicitar turno: {len(servicios)} servicios encontrados.")
        else:
            servicios = []
            logging.warning("No se encontraron servicios en la base de datos.")
            flash("No hay servicios configurados en este momento. Por favor, intente más tarde.", "warning")

        return render_template('solicitar_turno.html', servicios=servicios, organizacion=g.org)
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
    if not g.org:
         return jsonify({"error": "Organización no identificada"}), 400
    
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
        
        params = {
        '_id_servicio': int(id_servicio), 
        '_id_cliente': id_cliente,
        '_id_organizacion': g.org['id_organizacion'] # <-- DATO NUEVO
        }
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
                                   servicio_nombre=nombre_servicio,
                                   organizacion=g.org)
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
    # g.org es requerido para el login. Si es None, el middleware falló.
    if not g.org:
         return render_template('error.html', message="No se pudo identificar la organización para el login.")
    
    if g.user:
        if g.user['role'] == 'administrador':
            return redirect(url_for('admin_dashboard'))
        else:
            return redirect(url_for('funcionario_panel'))
        
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        try:
            # ¡CAMBIO CLAVE! Filtramos por 'nombre_usuario' Y 'id_organizacion'
            user_response = (supabase.table('usuarios')
                .select('id_usuario, nombre_completo, rol, id_modulo_asignado, contrasena')
                .eq('nombre_usuario', username)
                .eq('id_organizacion', g.org['id_organizacion']) # <-- FILTRO MULTI-TENANT
                .single()
                .execute())
            
            user_data = user_response.data

            #-- línea donde se checkea la contraseña hasheada

            if user_data and check_password_hash(user_data['contrasena'], password):
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
                    'expires_at': expires_at.isoformat(),
                    'id_organizacion': g.org['id_organizacion'] # <-- DATO NUEVO
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

            else:
                flash("Usuario o contraseña incorrectos.", "danger")
                logging.warning(f"Intento de inicio de sesión fallido para {username}.")
        except Exception as e:
            logging.error(f"Error en el inicio de sesión del funcionario: {e}")
            flash("Ocurrió un error al intentar iniciar sesión.", "error")

    return render_template('funcionario_login.html', organizacion=g.org)

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
                           user_name=g.user['name'])

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

    session.pop('session_token',None)
    flash("Has cerrado sesión exitosamente.","info")
    logging.info("Cookie de sesión limpiada.")
    return redirect(url_for('funcionario_login'))

# --- API Segura para Administración ---

@app.route('/api/save-user', methods=['POST'])
@admin_required # ¡Muy importante! Solo los admins pueden acceder
def api_save_user():
    """
    Endpoint para crear o actualizar usuarios de forma segura.
    Asegura que la operación se realice solo dentro de la org del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
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
            'id_modulo_asignado': data.get('id_modulo_asignado') or None # Asegura que sea NULL si está vacío
        }

        password = data.get('password')
        if password:
            user_data['contrasena'] = generate_password_hash(password)

        if user_id:
            # --- LÓGICA DE ACTUALIZAR (UPDATE) ---
            if not password:
                user_data.pop('contrasena', None) # No actualizar contraseña si viene vacía

            response = supabase.table('usuarios') \
                .update(user_data) \
                .eq('id_usuario', user_id) \
                .eq('id_organizacion', g.org['id_organizacion']) \
                .execute()
            message = "Usuario actualizado exitosamente."

        else:
            # --- LÓGICA DE CREAR (INSERT) ---
            if not password:
                return jsonify({"success": False, "error": "La contraseña es requerida para nuevos usuarios."}), 400
            
            # ¡Vinculación automática!
            user_data['id_organizacion'] = g.org['id_organizacion']
            
            response = supabase.table('usuarios') \
                .insert(user_data) \
                .execute()
            message = "Usuario creado exitosamente."

        if response.data:
            logging.info(f"Usuario {'actualizado' if user_id else 'creado'} por {g.user['name']}.")
            return jsonify({"success": True, "message": message}), 200
        else:
            raise Exception("No se pudo guardar el usuario, o no se tiene permiso sobre él.")

    except Exception as e:
        logging.error(f"Error en api_save_user: {e}")
        # Manejo de error de nombre de usuario duplicado
        if 'violates unique constraint "usuarios_nombre_usuario_key"' in str(e).lower():
             return jsonify({"success": False, "error": "Error: Ese nombre de usuario ya está en uso."}), 409
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/register-cliente', methods=['POST'])
def register_cliente():
    """
    API inteligente que CREA un cliente si es nuevo, o ACTUALIZA su nombre si ya existe.
    """
    if not request.is_json:
        return jsonify({"success": False, "error": "La solicitud debe ser JSON"}), 400

    data = request.get_json()
    identificacion = data.get('numero_identificacion')
    nombre = data.get('nombre_completo')

    if not identificacion or not nombre:
        return jsonify({"success": False, "error": "Faltan datos requeridos"}), 400

    try:
        response = supabase.table('clientes').upsert({
            'numero_identificacion': identificacion,
            'nombre_completo': nombre
        }, on_conflict='numero_identificacion').execute()

        if response.data:
            logging.info(f"Cliente {identificacion} registrado/actualizado como '{nombre}'.")
            return jsonify({"success": True, "message": "Cliente registrado correctamente."})
        else:
            raise Exception(response.error.message if response.error else "Error desconocido en upsert")

    except Exception as e:
        logging.error(f"Error en register_cliente para {identificacion}: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/check-cliente/<identificacion>')
def check_cliente(identificacion):
    """
    Verifica si un cliente existe por su número de identificación.
    """
    try:
        # CORRECCIÓN: Usamos el nombre correcto de la función con guion bajo: maybe_single()
        response = supabase.table('clientes') \
            .select('nombre_completo') \
            .eq('numero_identificacion', identificacion) \
            .maybe_single() \
            .execute()

        # La lógica de aquí en adelante ya era correcta
        if response.data:
            return jsonify(response.data)
        else:
            return jsonify(None)
            
    except Exception as e:
        logging.error(f"Error en check_cliente para {identificacion}: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/reports')
@admin_required # Asegúrate de que siga protegida
def get_reports():
    # 1. Recopilamos todos los parámetros
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    group_by = request.args.get('group_by')
    user_id = request.args.get('user_id')
    module_id = request.args.get('module_id')

    if not all([start_date, end_date, group_by]):
        return jsonify({"error": "Faltan parámetros requeridos (start, end, group_by)"}), 400
    
    try:
        # 2. Creamos el diccionario de parámetros
        params = {
            'start_date': start_date,
            'end_date': end_date,
            'group_by_param': group_by,
            '_id_organizacion': g.org['id_organizacion'] # <-- El filtro de organización
        }

        # --- ¡ESTA ES LA CORRECCIÓN! ---
        # Añadimos los parámetros OPCIONALES, enviando None (NULL) si están vacíos.
        # La base de datos necesita recibir TODOS los argumentos definidos.
        params['_user_id'] = int(user_id) if user_id else None
        params['_module_id'] = int(module_id) if module_id else None
        # --- FIN DE LA CORRECCIÓN ---
        
        # 4. Llamamos a la función RPC
        response = supabase.rpc('get_report_data', params).execute()

        if response.data:
            return jsonify(response.data)
        else:
            if response.error:
                raise Exception(response.error.message)
            return jsonify([])
        
    except Exception as e:
        logging.error(f"Error al generar el reporte: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/get-modules')
@admin_required
def api_get_modules():
    """
    Endpoint seguro para obtener TODOS los módulos
    pertenecientes a la organización del admin logueado.
    """
    
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
    try:
        response = supabase.table('modulos') \
            .select('*') \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .order('nombre_modulo', desc=False) \
            .execute()
            
        if response.data:
            return jsonify({"success": True, "modules": response.data}), 200
        else:
            return jsonify({"success": True, "modules": []}), 200

    except Exception as e:
        logging.error(f"Error en api_get_modules: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/delete-module/<int:module_id>', methods=['DELETE'])
@admin_required
def api_delete_module(module_id):
    """
    Endpoint seguro para ELIMINAR un módulo
    perteneciente a la organización del admin logueado.
    """
    
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
    try:
        response = supabase.table('modulos') \
            .delete() \
            .eq('id_modulo', module_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .execute()
            
        if response.data:
            logging.info(f"Módulo {module_id} eliminado exitosamente por {g.user['name']}.")
            return jsonify({"success": True, "message": "Módulo eliminado exitosamente."}), 200
        else:
            logging.warning(f"Intento de borrado fallido para módulo {module_id} por {g.user['name']}. No se encontró o no pertenece a la org {g.org['id_organizacion']}.")
            return jsonify({"success": False, "error": "No se pudo eliminar el módulo. Es posible que no exista o no le pertenezca."}), 404

    except Exception as e:
        logging.error(f"Error en api_delete_module: {e}")
        return jsonify({"success": False, "error": f"Error al eliminar módulo: {e}"}), 500

@app.route('/api/get-module/<int:module_id>')
@admin_required
def api_get_module(module_id):
    """
    Endpoint seguro para obtener UN módulo por su ID,
    verificando que pertenezca a la organización del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401

    try:
        response = supabase.table('modulos') \
            .select('*') \
            .eq('id_modulo', module_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .single() \
            .execute()
        
        if response.data:
            return jsonify({"success": True, "module": response.data}), 200
        else:
            return jsonify({"success": False, "error": "Módulo no encontrado o no pertenece a esta organización"}), 404

    except Exception as e:
        logging.error(f"Error en api_get_module: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/save-module', methods=['POST'])
@admin_required
def api_save_module():
    """
    Endpoint seguro para CREAR o ACTUALIZAR un módulo.
    Asegura que la operación se realice solo dentro de la org del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    data = request.get_json()
    if not data or not data.get('nombre_modulo'):
        return jsonify({"success": False, "error": "Nombre del módulo es requerido"}), 400

    module_id = data.get('id_modulo')
    
    module_data = {
        'nombre_modulo': data.get('nombre_modulo'),
        'descripcion': data.get('descripcion'),
        'estado': data.get('estado', 'activo')
    }

    try:
        if module_id:
            logging.info(f"Actualizando módulo {module_id} para org {g.org['id_organizacion']}")
            response = supabase.table('modulos') \
                .update(module_data) \
                .eq('id_modulo', module_id) \
                .eq('id_organizacion', g.org['id_organizacion']) \
                .execute()
            message = "Módulo actualizado exitosamente."

        else:
            module_data['id_organizacion'] = g.org['id_organizacion']
            
            logging.info(f"Creando nuevo módulo para org {g.org['id_organizacion']}")
            response = supabase.table('modulos') \
                .insert(module_data) \
                .execute()
            message = "Módulo creado exitosamente."

        if response.data:
            return jsonify({"success": True, "message": message}), 200
        else:
            raise Exception("No se pudo guardar el módulo, o no se tiene permiso sobre él.")

    except Exception as e:
        logging.error(f"Error en api_save_module: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-services')
@admin_required
def api_get_services():
    """
    Endpoint seguro para obtener TODOS los servicios
    pertenecientes a la organización del admin logueado.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
    try:
        response = supabase.table('servicios') \
            .select('*') \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .order('nombre_servicio', desc=False) \
            .execute()
            
        if response.data:
            return jsonify({"success": True, "services": response.data}), 200
        else:
            return jsonify({"success": True, "services": []}), 200

    except Exception as e:
        logging.error(f"Error en api_get_services: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/get-service/<int:service_id>')
@admin_required
def api_get_service(service_id):
    """
    Endpoint seguro para obtener UN servicio por su ID,
    verificando que pertenezca a la organización del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401

    try:
        response = supabase.table('servicios') \
            .select('*') \
            .eq('id_servicio', service_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .single() \
            .execute()
        
        if response.data:
            return jsonify({"success": True, "service": response.data}), 200
        else:
            return jsonify({"success": False, "error": "Servicio no encontrado o no pertenece a esta organización"}), 404

    except Exception as e:
        logging.error(f"Error en api_get_service: {e}")
        return jsonify({"success": False, "error": "Servicio no encontrado."}), 404


@app.route('/api/delete-service/<int:service_id>', methods=['DELETE'])
@admin_required
def api_delete_service(service_id):
    """
    Endpoint seguro para ELIMINAR un servicio
    perteneciente a la organización del admin logueado.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
    try:
        # Filtramos por ID de servicio Y ID de organización
        response = supabase.table('servicios') \
            .delete() \
            .eq('id_servicio', service_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .execute()
            
        if response.data:
            logging.info(f"Servicio {service_id} eliminado exitosamente por {g.user['name']}.")
            return jsonify({"success": True, "message": "Servicio eliminado exitosamente."}), 200
        else:
            logging.warning(f"Intento de borrado fallido para servicio {service_id} por {g.user['name']}.")
            return jsonify({"success": False, "error": "No se pudo eliminar el servicio. Es posible que no exista o no le pertenezca."}), 404

    except Exception as e:
        logging.error(f"Error en api_delete_service: {e}")
        if 'violates foreign key constraint' in str(e).lower():
             return jsonify({"success": False, "error": "No se puede eliminar: El servicio está en uso (ej. en un turno o asignado a un módulo)."}), 409
        return jsonify({"success": False, "error": f"Error al eliminar servicio: {e}"}), 500


@app.route('/api/save-service', methods=['POST'])
@admin_required
def api_save_service():
    """
    Endpoint seguro para CREAR o ACTUALIZAR un servicio.
    Asegura que la operación se realice solo dentro de la org del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    data = request.get_json()
    if not data or not data.get('nombre_servicio') or not data.get('prefijo_ticket'):
        return jsonify({"success": False, "error": "Nombre y prefijo son requeridos"}), 400

    service_id = data.get('id_servicio')
    
    service_data = {
        'nombre_servicio': data.get('nombre_servicio'),
        'prefijo_ticket': data.get('prefijo_ticket').upper() # Guardamos en mayúsculas
    }

    try:
        if service_id:
            # --- LÓGICA DE ACTUALIZAR (UPDATE) ---
            response = supabase.table('servicios') \
                .update(service_data) \
                .eq('id_servicio', service_id) \
                .eq('id_organizacion', g.org['id_organizacion']) \
                .execute()
            message = "Servicio actualizado exitosamente."

        else:
            # --- LÓGICA DE CREAR (INSERT) ---
            service_data['id_organizacion'] = g.org['id_organizacion']
            response = supabase.table('servicios') \
                .insert(service_data) \
                .execute()
            message = "Servicio creado exitosamente."

        if response.data:
            return jsonify({"success": True, "message": message, "service": response.data[0]}), 200
        else:
            raise Exception("No se pudo guardar el servicio, o no se tiene permiso sobre él.")

    except Exception as e:
        logging.error(f"Error en api_save_service: {e}")
        # Manejo de error de prefijo duplicado
        if 'violates unique constraint "servicios_prefijo_ticket_key"' in str(e).lower():
             return jsonify({"success": False, "error": "Error: Ese prefijo de ticket ya está en uso."}), 409
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-services-config')
@admin_required
def api_get_services_config():
    """
    Obtiene todos los datos necesarios para la matriz de configuración
    de servicios por módulo, filtrados por la organización del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    org_id = g.org['id_organizacion']
    
    try:
        # 1. Obtenemos los módulos de esta organización
        modules_resp = supabase.table('modulos') \
            .select('*') \
            .eq('id_organizacion', org_id) \
            .order('nombre_modulo', desc=False) \
            .execute()
            
        # 2. Obtenemos los servicios de esta organización
        services_resp = supabase.table('servicios') \
            .select('*') \
            .eq('id_organizacion', org_id) \
            .order('nombre_servicio', desc=False) \
            .execute()
            
        # 3. Obtenemos las conexiones actuales para esta organización
        config_resp = supabase.table('modulos_servicios') \
            .select('id_modulo, id_servicio') \
            .eq('id_organizacion', org_id) \
            .execute()

        return jsonify({
            "success": True,
            "modules": modules_resp.data,
            "services": services_resp.data,
            "config": config_resp.data  # Esto es una lista de {id_modulo, id_servicio}
        }), 200

    except Exception as e:
        logging.error(f"Error en api_get_services_config: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/save-services-config', methods=['POST'])
@admin_required
def api_save_services_config():
    """
    Guarda la nueva configuración de la matriz de servicios por módulo.
    Es una operación transaccional: Borra todo lo de la org y re-inserta.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    org_id = g.org['id_organizacion']
    new_config_list = request.get_json() # Esperamos una lista de {id_modulo, id_servicio}

    if not isinstance(new_config_list, list):
        return jsonify({"success": False, "error": "Formato de datos inválido"}), 400

    try:
        # 1. ¡BORRADO SEGURO! Borramos solo las conexiones de ESTA organización
        logging.info(f"Borrando config de servicios antigua para org {org_id}")
        del_resp = supabase.table('modulos_servicios') \
            .delete() \
            .eq('id_organizacion', org_id) \
            .execute()

        # 2. Preparamos los nuevos datos para insertar, "etiquetando" cada uno
        inserts_with_org = []
        for item in new_config_list:
            inserts_with_org.append({
                'id_modulo': item.get('id_modulo'),
                'id_servicio': item.get('id_servicio'),
                'id_organizacion': org_id # ¡La clave de vinculación!
                # La 'prioridad' no la estamos manejando aquí, se hace en otra pantalla
            })

        # 3. Insertamos la nueva configuración (si hay algo que insertar)
        if inserts_with_org:
            logging.info(f"Insertando {len(inserts_with_org)} nuevas configs de servicios para org {org_id}")
            ins_resp = supabase.table('modulos_servicios') \
                .insert(inserts_with_org) \
                .execute()
            
            if not ins_resp.data:
                 raise Exception("Error en la inserción de la nueva configuración.")

        return jsonify({"success": True, "message": "Configuración de servicios guardada exitosamente."}), 200

    except Exception as e:
        logging.error(f"Error en api_save_services_config: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-messages')
@admin_required
def api_get_messages():
    """
    Obtiene TODOS los mensajes del visualizador
    pertenecientes a la organización del admin logueado.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
    try:
        response = supabase.table('mensajes_visualizador') \
            .select('*') \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .order('created_at', desc=True) \
            .execute()
            
        return jsonify({"success": True, "messages": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_messages: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/get-message/<int:message_id>')
@admin_required
def api_get_message(message_id):
    """
    Obtiene UN mensaje por su ID,
    verificando que pertenezca a la organización del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401

    try:
        response = supabase.table('mensajes_visualizador') \
            .select('*') \
            .eq('id', message_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .single() \
            .execute()
        
        if response.data:
            return jsonify({"success": True, "message": response.data}), 200
        else:
            return jsonify({"success": False, "error": "Mensaje no encontrado o no pertenece a esta organización"}), 404

    except Exception as e:
        logging.error(f"Error en api_get_message: {e}")
        return jsonify({"success": False, "error": "Mensaje no encontrado."}), 404


@app.route('/api/delete-message/<int:message_id>', methods=['DELETE'])
@admin_required
def api_delete_message(message_id):
    """
    Endpoint seguro para ELIMINAR un mensaje
    perteneciente a la organización del admin logueado.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
    try:
        response = supabase.table('mensajes_visualizador') \
            .delete() \
            .eq('id', message_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .execute()
            
        if response.data:
            logging.info(f"Mensaje {message_id} eliminado por {g.user['name']}.")
            return jsonify({"success": True, "message": "Mensaje eliminado exitosamente."}), 200
        else:
            logging.warning(f"Intento de borrado fallido para mensaje {message_id} por {g.user['name']}.")
            return jsonify({"success": False, "error": "No se pudo eliminar el mensaje."}), 404

    except Exception as e:
        logging.error(f"Error en api_delete_message: {e}")
        return jsonify({"success": False, "error": f"Error al eliminar mensaje: {e}"}), 500


@app.route('/api/save-message', methods=['POST'])
@admin_required
def api_save_message():
    """
    Endpoint seguro para CREAR o ACTUALIZAR un mensaje del visualizador.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    data = request.get_json()
    if not data or not data.get('texto_mensaje'):
        return jsonify({"success": False, "error": "El texto del mensaje es requerido"}), 400

    message_id = data.get('id')
    
    message_data = {
        'texto_mensaje': data.get('texto_mensaje'),
        'is_active': data.get('is_active', True)
    }

    try:
        if message_id:
            # --- LÓGICA DE ACTUALIZAR (UPDATE) ---
            response = supabase.table('mensajes_visualizador') \
                .update(message_data) \
                .eq('id', message_id) \
                .eq('id_organizacion', g.org['id_organizacion']) \
                .execute()
            message = "Mensaje actualizado exitosamente."

        else:
            # --- LÓGICA DE CREAR (INSERT) ---
            message_data['id_organizacion'] = g.org['id_organizacion']
            response = supabase.table('mensajes_visualizador') \
                .insert(message_data) \
                .execute()
            message = "Mensaje creado exitosamente."

        if response.data:
            return jsonify({"success": True, "message": message, "service": response.data[0]}), 200
        else:
            raise Exception("No se pudo guardar el mensaje, o no se tiene permiso sobre él.")

    except Exception as e:
        logging.error(f"Error en api_save_message: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-prioritized-services/<int:module_id>')
@admin_required
def api_get_prioritized_services(module_id):
    """
    Obtiene los servicios asignados a UN módulo, ordenados por prioridad,
    y verifica que el módulo pertenezca a la organización del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    org_id = g.org['id_organizacion']

    try:
        # 1. Verificamos que el módulo pertenezca al admin (medida de seguridad)
        module_check = supabase.table('modulos') \
            .select('id_modulo') \
            .eq('id_modulo', module_id) \
            .eq('id_organizacion', org_id) \
            .single() \
            .execute()

        if not module_check.data:
            return jsonify({"success": False, "error": "Módulo no encontrado o no pertenece a esta organización."}), 404

        # 2. Si el módulo es válido, obtenemos sus servicios ordenados por prioridad
        response = supabase.table('modulos_servicios') \
            .select('prioridad, servicios(id_servicio, nombre_servicio)') \
            .eq('id_modulo', module_id) \
            .eq('id_organizacion', org_id) \
            .order('prioridad', desc=False) \
            .execute()

        return jsonify({"success": True, "services": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_prioritized_services: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/save-priorities', methods=['POST'])
@admin_required
def api_save_priorities():
    """
    Recibe una lista de IDs de servicio en su nuevo orden y actualiza
    sus prioridades en la base de datos para un módulo específico.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    org_id = g.org['id_organizacion']
    data = request.get_json()
    
    module_id = data.get('module_id')
    service_ids_order = data.get('service_ids') # Esperamos una lista [7, 2, 5]

    if not module_id or not isinstance(service_ids_order, list):
        return jsonify({"success": False, "error": "Datos incompletos (module_id o service_ids faltantes)."}), 400

    try:
        # 1. Verificamos que el módulo pertenezca al admin (medida de seguridad)
        module_check = supabase.table('modulos') \
            .select('id_modulo') \
            .eq('id_modulo', module_id) \
            .eq('id_organizacion', org_id) \
            .single() \
            .execute()

        if not module_check.data:
            return jsonify({"success": False, "error": "Módulo no encontrado o no pertenece a esta organización."}), 404
            
        # 2. Creamos la lista de objetos para 'upsert'
        # 'upsert' es perfecto aquí: actualiza la prioridad si la fila existe, 
        # (aunque en este caso siempre deberían existir).
        updates = []
        for index, service_id in enumerate(service_ids_order):
            updates.append({
                'id_modulo': module_id,
                'id_servicio': service_id,
                'id_organizacion': org_id, # Clave de seguridad
                'prioridad': index + 1  # La prioridad es el índice (empezando en 1)
            })

        # 3. Ejecutamos la actualización
        if updates:
            response = supabase.table('modulos_servicios') \
                .upsert(updates, on_conflict='id_modulo, id_servicio, id_organizacion') \
                .execute()
                
            if not response.data:
                 raise Exception("Error al ejecutar upsert de prioridades.")

        return jsonify({"success": True, "message": "Orden de prioridad guardado exitosamente."}), 200

    except Exception as e:
        logging.error(f"Error en api_save_priorities: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-clients')
@admin_required
def api_get_clients():
    """
    Endpoint seguro para obtener la lista PAGINADA y con BÚSQUEDA
    de clientes, filtrados por la organización del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    org_id = g.org['id_organizacion']
    
    # 1. Obtenemos los parámetros de la URL (?page=1&search=pedro&limit=25)
    try:
        page = int(request.args.get('page', 1))
        limit = int(request.args.get('limit', 25))
        search_term = request.args.get('search', '')
    except ValueError:
        return jsonify({"success": False, "error": "Parámetros de paginación inválidos"}), 400
        
    # 2. Calculamos el rango de paginación
    page_from = (page - 1) * limit
    page_to = page_from + limit - 1
    
    try:
        # 3. Construimos la consulta base (filtrada por organización)
        query = supabase.table('clientes') \
            .select('*', count='exact') \
            .eq('id_organizacion', org_id)

        # 4. Si hay un término de búsqueda, añadimos el filtro
        if search_term:
            # Usamos 'ilike' para buscar cualquier parte del nombre O identificación
            # y 'textSearch' para búsquedas más complejas (depende de tu config de Supabase)
            # 'ilike' es más simple y efectivo para números de identificación.
            query = query.ilike('numero_identificacion', f'{search_term}%') # Busca IDs que EMPIECEN con...

        # 5. Añadimos el orden y el rango (paginación)
        query = query.order('creado_en', desc=True) \
                     .range(page_from, page_to)
        
        # 6. Ejecutamos la consulta
        response = query.execute()

        # 'response.count' nos da el CONTEO TOTAL de filas (ignorando el 'range')
        return jsonify({
            "success": True, 
            "clients": response.data,
            "total_count": response.count 
        }), 200

    except Exception as e:
        logging.error(f"Error en api_get_clients: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/reset-turns', methods=['DELETE'])
@admin_required
def api_reset_turns():
    """
    Endpoint seguro para RESETEAR (borrar) todos los turnos
    de la organización del admin logueado.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    org_id = g.org['id_organizacion']
    logging.info(f"Admin {g.user['name']} iniciando reseteo de turnos para org {org_id}.")
    
    try:
        # ¡BORRADO SEGURO! Borra solo los turnos de ESTA org.
        # Tu JS original borraba todo (neq 'id_turno', 0), así que replicamos esa lógica
        # pero AÑADIENDO el filtro de organización.
        response = supabase.table('turnos') \
            .delete() \
            .eq('id_organizacion', org_id) \
            .execute()
        
        # response.data contiene los registros borrados
        num_deleted = len(response.data)
        logging.info(f"{num_deleted} turnos eliminados para org {org_id}.")
        return jsonify({"success": True, "message": f"Todos los turnos ({num_deleted}) de la organización han sido reseteados."}), 200

    except Exception as e:
        logging.error(f"Error en api_reset_turns: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-users')
@admin_required
def api_get_users():
    """
    Obtiene TODOS los usuarios (funcionarios, admins)
    pertenecientes a la organización del admin logueado.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
    try:
        # Hacemos un 'join' con la tabla 'modulos' para obtener el nombre del módulo
        response = supabase.table('usuarios') \
            .select('*, modulos(nombre_modulo)') \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .order('nombre_completo', desc=False) \
            .execute()
            
        return jsonify({"success": True, "users": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_users: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/get-user/<int:user_id>')
@admin_required
def api_get_user(user_id):
    """
    Obtiene UN usuario por su ID,
    verificando que pertenezca a la organización del admin.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401

    try:
        response = supabase.table('usuarios') \
            .select('*') \
            .eq('id_usuario', user_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .single() \
            .execute()
        
        if response.data:
            return jsonify({"success": True, "user": response.data}), 200
        else:
            return jsonify({"success": False, "error": "Usuario no encontrado o no pertenece a esta organización"}), 404

    except Exception as e:
        logging.error(f"Error en api_get_user: {e}")
        return jsonify({"success": False, "error": "Usuario no encontrado."}), 404


@app.route('/api/delete-user/<int:user_id>', methods=['DELETE'])
@admin_required
def api_delete_user(user_id):
    """
    Endpoint seguro para ELIMINAR un usuario
    perteneciente a la organización del admin logueado.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    # ¡Control de seguridad! Un usuario no puede borrarse a sí mismo.
    if user_id == g.user['id']:
        return jsonify({"success": False, "error": "No puede eliminarse a sí mismo."}), 403
        
    try:
        # Filtramos por ID de usuario Y ID de organización
        response = supabase.table('usuarios') \
            .delete() \
            .eq('id_usuario', user_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .execute()
            
        if response.data:
            logging.info(f"Usuario {user_id} eliminado por {g.user['name']}.")
            return jsonify({"success": True, "message": "Usuario eliminado exitosamente."}), 200
        else:
            logging.warning(f"Intento de borrado fallido para usuario {user_id} por {g.user['name']}.")
            return jsonify({"success": False, "error": "No se pudo eliminar el usuario."}), 404

    except Exception as e:
        logging.error(f"Error en api_delete_user: {e}")
        return jsonify({"success": False, "error": f"Error al eliminar usuario: {e}"}), 500

@app.route('/api/get-services-list')
@admin_required
def api_get_services_list():
    """
    Obtiene una lista simple (ID y nombre) de todos los servicios
    de la organización para usar en menús desplegables.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
        
    try:
        response = supabase.table('servicios') \
            .select('id_servicio, nombre_servicio') \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .order('nombre_servicio', desc=False) \
            .execute()
            
        return jsonify({"success": True, "services": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_services_list: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/get-turn-history')
@admin_required
def api_get_turn_history():
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    org_id = g.org['id_organizacion']
    
    start_date = request.args.get('start', None)
    end_date = request.args.get('end', None)
    service_id = request.args.get('service_id', None)
    
    try:
        query = supabase.table('turnos') \
            .select('*, servicios(nombre_servicio), modulos(nombre_modulo), logs_turnos(accion, hora_accion)') \
            .eq('id_organizacion', org_id)

        if service_id:
            query = query.eq('id_servicio', service_id)
        
        # --- ¡ESTA ES LA CORRECCIÓN! ---
        if start_date:
            query = query.gte('hora_solicitud', start_date)
        
        if end_date:
            from datetime import datetime, timedelta
            end_date_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
            query = query.lt('hora_solicitud', end_date_dt.strftime('%Y-%m-%d'))
        
        # Si NO se proveen fechas, aplicamos un filtro por defecto (últimos 7 días)
        if not start_date and not end_date:
            from datetime import datetime, timedelta
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            query = query.gte('hora_solicitud', seven_days_ago.isoformat())
        # --- FIN DE LA CORRECCIÓN ---

        # Añadimos un límite de seguridad y orden
        query = query.order('hora_solicitud', desc=True).limit(250) 
        response = query.execute()

        return jsonify({"success": True, "history": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_turn_history: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-dashboard-data')
@admin_required
def api_get_dashboard_data():
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    org_id = g.org['id_organizacion']
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    
    try:
        # 1. KPI: Turnos en Espera
        waiting_resp = supabase.table('turnos').select('id_turno', count='exact').eq('id_organizacion', org_id).eq('estado', 'en espera').execute()
        
        # 2. KPI: Turnos Atendidos Hoy
        attended_resp = supabase.table('turnos').select('id_turno', count='exact').eq('id_organizacion', org_id).eq('estado', 'atendido').gte('hora_finalizacion', today).execute()

        # 3. KPI: Módulos Activos
        active_modules_resp = supabase.table('modulos').select('id_modulo', count='exact').eq('id_organizacion', org_id).eq('estado', 'activo').execute()

        # --- ¡ESTA ES LA CORRECCIÓN! ---
        # 4. Tabla: Estado de Módulos (Consulta simple)
        modules_status_resp = supabase.table('modulos') \
            .select('*, turnos(prefijo_turno, numero_turno, estado)') \
            .eq('id_organizacion', org_id) \
            .order('nombre_modulo', desc=False) \
            .execute()

        # 5. Obtenemos los usuarios POR SEPARADO
        users_resp = supabase.table('usuarios') \
            .select('id_modulo_asignado, nombre_completo') \
            .eq('id_organizacion', org_id) \
            .execute()
        # --- FIN DE LA CORRECCIÓN ---

        kpis = {
            "waiting_count": waiting_resp.count or 0,
            "attended_today_count": attended_resp.count or 0,
            "active_modules_count": active_modules_resp.count or 0
        }
        
        return jsonify({
            "success": True, 
            "kpis": kpis,
            "modules_status": modules_status_resp.data,
            "users": users_resp.data  # <-- Añadimos los usuarios a la respuesta
        }), 200

    except Exception as e:
        logging.error(f"Error en api_get_dashboard_data: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    

@app.route('/api/funcionario/get-pending-turns')
@login_required # <-- ¡Usamos tu decorador de login!
def api_get_pending_turns():
    """
    Obtiene los turnos pendientes para el módulo del funcionario logueado,
    ordenados por prioridad.
    """
    if not g.org or not g.user:
        return jsonify({"success": False, "error": "No autorizado"}), 401
    
    module_id = g.user.get('assigned_module_id')
    org_id = g.org['id_organizacion']

    if not module_id:
        return jsonify({"success": False, "error": "Funcionario no tiene módulo asignado", "turns": []}), 404

    try:
        # 1. Obtenemos las asignaciones y PRIORIDADES de los servicios para nuestro módulo
        ms_resp = supabase.table('modulos_servicios') \
            .select('id_servicio, prioridad') \
            .eq('id_modulo', module_id) \
            .eq('id_organizacion', org_id) \
            .execute()

        if not ms_resp.data:
            return jsonify({"success": True, "turns": []}), 200 # No hay servicios configurados

        priority_map = {ms['id_servicio']: ms['prioridad'] for ms in ms_resp.data}
        service_ids = list(priority_map.keys())

        # 2. Obtenemos los turnos pendientes para esos servicios
        turns_resp = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, hora_solicitud, id_servicio, servicios(nombre_servicio)') \
            .eq('estado', 'en espera') \
            .eq('id_organizacion', org_id) \
            .in_('id_servicio', service_ids) \
            .order('hora_solicitud', desc=False) \
            .execute()
        
        # 3. Ordenamos por prioridad en Python
        def sort_key(turn):
            priority = priority_map.get(turn['id_servicio'], 99) # 99 como default
            solicitude_time = datetime.fromisoformat(turn['hora_solicitud'])
            return (priority, solicitude_time)

        sorted_turns = sorted(turns_resp.data, key=sort_key)
        
        return jsonify({"success": True, "turns": sorted_turns}), 200

    except Exception as e:
        logging.error(f"Error en api_get_pending_turns: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/funcionario/get-module-name')
@login_required
def api_get_module_name():
    """
    Obtiene el nombre del módulo asignado al funcionario logueado.
    """
    if not g.org or not g.user:
        return jsonify({"success": False, "error": "No autorizado"}), 401
    
    module_id = g.user.get('assigned_module_id')
    if not module_id:
        return jsonify({"success": True, "module_name": "No Asignado"}), 200

    try:
        response = supabase.table('modulos') \
            .select('nombre_modulo') \
            .eq('id_modulo', module_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .single() \
            .execute()
        
        if response.data:
            return jsonify({"success": True, "module_name": response.data['nombre_modulo']}), 200
        else:
            return jsonify({"success": False, "error": "Módulo no encontrado"}), 404
            
    except Exception as e:
        logging.error(f"Error en api_get_module_name: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/funcionario/get-current-turn')
@login_required
def api_get_current_turn():
    if not g.org or not g.user or not g.user.get('assigned_module_id'):
        return jsonify({"success": False, "error": "No autorizado o sin módulo"}), 401
    
    org_id = g.org['id_organizacion']
    module_id = g.user.get('assigned_module_id')

    try:
        response = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, servicios(nombre_servicio), clientes(nombre_completo)') \
            .eq('estado', 'en atencion') \
            .eq('id_modulo_atencion', module_id) \
            .eq('id_organizacion', org_id) \
            .order('hora_llamado', desc=True) \
            .limit(1) \
            .maybe_single() \
            .execute()
        
        # --- ¡CORRECCIÓN DEFENSIVA! ---
        # Verificamos si 'response' existe antes de acceder a '.data'
        turn_data = response.data if response else None
        return jsonify({"success": True, "turn": turn_data}), 200
        # --- FIN DE LA CORRECCIÓN ---
            
    except Exception as e:
        logging.error(f"Error en api_get_current_turn: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/funcionario/get-daily-history')
@login_required
def api_get_daily_history():
    if not g.org or not g.user or not g.user.get('assigned_module_id'):
        return jsonify({"success": False, "error": "No autorizado o sin módulo"}), 401

    org_id = g.org['id_organizacion']
    module_id = g.user.get('assigned_module_id')
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')

    try:
        response = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, hora_finalizacion') \
            .eq('estado', 'atendido') \
            .eq('id_modulo_atencion', module_id) \
            .eq('id_organizacion', org_id) \
            .gte('hora_finalizacion', today) \
            .order('hora_finalizacion', desc=True) \
            .execute()
        
        # --- ¡CORRECCIÓN DEFENSIVA! ---
        history_data = response.data if response else []
        return jsonify({"success": True, "history": history_data}), 200
        # --- FIN DE LA CORRECCIÓN ---
            
    except Exception as e:
        logging.error(f"Error en api_get_daily_history: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/funcionario/call-next', methods=['POST'])
@login_required
def api_call_next():
    """
    Llama al siguiente turno disponible basado en la prioridad del módulo.
    Esta es una operación transaccional segura.
    """
    if not g.org or not g.user or not g.user.get('assigned_module_id'):
        return jsonify({"success": False, "error": "No autorizado o sin módulo"}), 401

    org_id = g.org['id_organizacion']
    module_id = g.user.get('assigned_module_id')
    user_id = g.user.get('id')

    try:
        # 1. Verificar que este módulo no tenga ya un turno "en atencion"
        current_check = supabase.table('turnos') \
            .select('id_turno') \
            .eq('id_modulo_atencion', module_id) \
            .eq('estado', 'en atencion') \
            .eq('id_organizacion', org_id) \
            .execute()
        
        if current_check.data:
            return jsonify({"success": False, "error": "Ya tiene un turno en atención. Finalícelo primero."}), 409 # 409 Conflict

        # 2. Replicamos la lógica de `api_get_pending_turns` para encontrar el turno correcto
        ms_resp = supabase.table('modulos_servicios').select('id_servicio, prioridad').eq('id_modulo', module_id).eq('id_organizacion', org_id).execute()
        if not ms_resp.data:
            return jsonify({"success": False, "error": "Este módulo no tiene servicios configurados."}), 404

        priority_map = {ms['id_servicio']: ms['prioridad'] for ms in ms_resp.data}
        service_ids = list(priority_map.keys())

        turns_resp = supabase.table('turnos').select('id_turno, prefijo_turno, numero_turno, hora_solicitud, id_servicio, servicios(nombre_servicio)').eq('estado', 'en espera').eq('id_organizacion', org_id).in_('id_servicio', service_ids).order('hora_solicitud', desc=False).execute()
        
        if not turns_resp.data:
            return jsonify({"success": False, "error": "No hay turnos pendientes para llamar."}), 404
            
        def sort_key(turn):
            priority = priority_map.get(turn['id_servicio'], 99)
            solicitude_time = datetime.fromisoformat(turn['hora_solicitud'])
            return (priority, solicitude_time)
        
        next_turn = sorted(turns_resp.data, key=sort_key)[0]

        # 3. ¡ACCIÓN! Actualizamos el turno de forma atómica
        # Usamos .eq('estado', 'en espera') como un "lock" para evitar race conditions
        update_response = supabase.table('turnos') \
            .update({
                'estado': 'en atencion',
                'hora_llamado': datetime.now(timezone.utc).isoformat(),
                'id_modulo_atencion': module_id
            }) \
            .eq('id_turno', next_turn['id_turno']) \
            .eq('estado', 'en espera') \
            .execute()

        if not update_response.data:
            # Si 'data' está vacío, significa que otro funcionario lo llamó 1 segundo antes
            raise Exception("El turno acaba de ser llamado por otro módulo. Intente de nuevo.")

        # 4. Insertamos el log
        supabase.table('logs_turnos').insert({
            'id_turno': next_turn['id_turno'],
            'id_usuario': user_id,
            'accion': 'llamado',
            'id_organizacion': org_id
        }).execute()

        # 5. Devolvemos el turno que se llamó
        return jsonify({"success": True, "called_turn": next_turn}), 200

    except Exception as e:
        logging.error(f"Error en api_call_next: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/funcionario/recall-turn', methods=['POST'])
@login_required
def api_recall_turn():
    """
    Rellama un turno (actualiza 'hora_llamado' e inserta un log).
    """
    if not g.org or not g.user: return jsonify({"success": False, "error": "No autorizado"}), 401
    
    data = request.get_json()
    turn_id = data.get('turn_id')
    
    try:
        # Actualizamos el turno
        update_response = supabase.table('turnos') \
            .update({'hora_llamado': datetime.now(timezone.utc).isoformat()}) \
            .eq('id_turno', turn_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .eq('id_modulo_atencion', g.user.get('assigned_module_id')) \
            .execute()

        if not update_response.data:
            raise Exception("No se pudo rellamar el turno (no se encontró o no pertenece a este módulo).")

        # Insertamos el log
        supabase.table('logs_turnos').insert({
            'id_turno': turn_id,
            'id_usuario': g.user.get('id'),
            'accion': 'rellamado',
            'id_organizacion': g.org['id_organizacion']
        }).execute()
        
        return jsonify({"success": True, "message": "Turno rellamado."}), 200

    except Exception as e:
        logging.error(f"Error en api_recall_turn: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/funcionario/finish-turn', methods=['POST'])
@login_required
def api_finish_turn():
    """
    Finaliza un turno (cambia estado a 'atendido' e inserta log).
    """
    if not g.org or not g.user: return jsonify({"success": False, "error": "No autorizado"}), 401
    
    data = request.get_json()
    turn_id = data.get('turn_id')
    
    try:
        # Actualizamos el turno
        update_response = supabase.table('turnos') \
            .update({
                'estado': 'atendido',
                'hora_finalizacion': datetime.now(timezone.utc).isoformat()
            }) \
            .eq('id_turno', turn_id) \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .eq('id_modulo_atencion', g.user.get('assigned_module_id')) \
            .execute()

        if not update_response.data:
            raise Exception("No se pudo finalizar el turno (no se encontró o no pertenece a este módulo).")

        # Insertamos el log
        supabase.table('logs_turnos').insert({
            'id_turno': turn_id,
            'id_usuario': g.user.get('id'),
            'accion': 'finalizado',
            'id_organizacion': g.org['id_organizacion']
        }).execute()
        
        return jsonify({"success": True, "message": "Turno finalizado."}), 200

    except Exception as e:
        logging.error(f"Error en api_finish_turn: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/visualizador/get-initial-data')
def api_get_visualizador_data():
    """
    Endpoint PÚBLICO (filtrado por subdominio) que obtiene
    el turno actual y el historial para el visualizador.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 404
    
    org_id = g.org['id_organizacion']
    
    try:
        # 1. Get current turn
        current_turn_resp = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, modulos(nombre_modulo)') \
            .eq('id_organizacion', org_id) \
            .eq('estado', 'en atencion') \
            .order('hora_llamado', desc=True) \
            .limit(1) \
            .maybe_single() \
            .execute()

        # 2. Get history
        history_resp = supabase.table('turnos') \
            .select('prefijo_turno, numero_turno, modulos(nombre_modulo)') \
            .eq('id_organizacion', org_id) \
            .eq('estado', 'atendido') \
            .order('hora_finalizacion', desc=True) \
            .limit(5) \
            .execute()

        # --- ¡ESTA ES LA CORRECCIÓN DEFENSIVA! ---
        # Verificamos si la respuesta NO es None ANTES de acceder a .data
        
        current_turn_data = current_turn_resp.data if current_turn_resp else None
        history_data = history_resp.data if history_resp else [] # Default a lista vacía
        # --- FIN DE LA CORRECCIÓN ---

        return jsonify({
            "success": True,
            "current_turn": current_turn_data, # (Esto será 'None' si .data era 'None', lo cual es JSON válido)
            "history": history_data
        }), 200

    except Exception as e:
        # El error que veías ("'NoneType'...") estaba ocurriendo aquí
        logging.error(f"Error en api_get_visualizador_data: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/visualizador/get-ticker-messages')
def api_get_ticker_messages():
    """
    Endpoint PÚBLICO (filtrado por subdominio) que obtiene
    los mensajes activos para el ticker.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 404
    
    org_id = g.org['id_organizacion']
    
    try:
        messages_resp = supabase.table('mensajes_visualizador') \
            .select('texto_mensaje') \
            .eq('id_organizacion', org_id) \
            .eq('is_active', True) \
            .order('created_at', desc=False) \
            .execute()
        
        return jsonify({"success": True, "messages": messages_resp.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_ticker_messages: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# --- Ejecución de la Aplicación ---
if __name__ == '__main__':
    # Para desarrollo, puedes usar app.run(debug=True)
    # En producción, usa un servidor WSGI como Gunicorn o uWSGI
    app.run(debug=True, host='0.0.0.0', port=5000)

