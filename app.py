#Estructura Inicial de la Aplicación Flask para el Sistema de Turnos
from flask import Flask, render_template, request, redirect, url_for, session, flash, g, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from supabase import create_client, Client
import os
import requests
from dotenv import load_dotenv
import logging
import traceback
import uuid
from datetime import datetime, timedelta, timezone

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Cargar variables de entorno desde .env (para desarrollo local)
load_dotenv()

app = Flask(__name__)
TTS_CACHE = {}
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'super_secret_key_default') # ¡Cambia esto en producción!

app.config['JSONIFY_PRETTYPRINT_REGULAR'] = False
app.config['JSON_SORT_KEYS'] = False



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
SESSION_TOKEN_LIFESPAN_HOURS = 24

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

@app.before_request
def make_session_permanent():
    session.permanent = True
    app.permanent_session_lifetime = timedelta(hours=24)


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
    O SUPERADMINISTRADOR.
    """
    from functools import wraps
    @wraps(f)
    def decorated_function(*args,**kwargs):
        
        # --- ¡ESTA ES LA CORRECCIÓN! ---
        # Si el usuario no existe O su rol NO ES 'administrador' Y NO ES 'superadmin'
        if g.user is None or g.user['role'] not in ('administrador', 'superadmin'):
        # --- FIN DE LA CORRECCIÓN ---
        
            flash("Acceso denegado. Solo administradores pueden acceder a esta página.", "danger")
            return redirect(url_for('funcionario_login'))
        return f(*args,**kwargs)
    return decorated_function

def superadmin_required(f):
    """
    Decorador para rutas que requieren rol de superadministrador
    """
    from functools import wraps
    @wraps(f)
    def decorated_function(*args,**kwargs):
        # Verifica que el usuario esté logueado Y que su rol sea 'superadmin'
        if g.user is None or g.user['role'] != 'superadmin':
            flash("Acceso denegado. Esta área es solo para el propietario del sistema.", "danger")
            return redirect(url_for('funcionario_login')) # Lo enviamos al login
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
        # Si el rol es 'administrador' O 'superadmin', va al dashboard
        if g.user['role'] in ('administrador', 'superadmin'):
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
                    if user_data['rol'] in ('administrador', 'superadmin'):
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
                           session_assigned_module_id=g.user['assigned_module_id'],
                           session_org_id=g.org['id_organizacion']) #pasar el módulo desde g.user

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

@app.route('/superadmin')
@superadmin_required # ¡Protegida con el nuevo decorador!
def superadmin_panel():
    """
    Panel de administración para el Superadministrador (propietario).
    """
    return render_template('superadmin.html',
        supabase_url=SUPABASE_URL,
        supabase_key=SUPABASE_KEY,
        user_name=g.user['name'])


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
        updates = []
        for index, service_id in enumerate(service_ids_order):
            updates.append({
                'id_modulo': module_id,
                'id_servicio': service_id,
                'id_organizacion': org_id, # La 'etiqueta' de seguridad
                'prioridad': index + 1  # La nueva prioridad
            })

        # 3. Ejecutamos la actualización
        if updates:
            
            # --- ¡ESTA ES LA CORRECCIÓN! ---
            # Le decimos a 'on_conflict' que use la regla
            # de 2 columnas que SÍ existe en la base de datos.
            response = supabase.table('modulos_servicios') \
                .upsert(updates, on_conflict='id_modulo, id_servicio') \
                .execute()
            # --- FIN DE LA CORRECCIÓN ---
                
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
            .select('*, servicios(nombre_servicio), modulos:modulos!turnos_id_modulo_atencion_fkey(nombre_modulo), logs_turnos(accion, hora_accion)') \
            .eq('id_organizacion', org_id)
        # --- FIN DE LA CORRECCIÓN ---

        if service_id:
            query = query.eq('id_servicio', service_id)
        
        if start_date:
            query = query.gte('hora_solicitud', start_date)
        
        if end_date:
            from datetime import datetime, timedelta
            end_date_dt = datetime.strptime(end_date, '%Y-%m-%d') + timedelta(days=1)
            query = query.lt('hora_solicitud', end_date_dt.strftime('%Y-%m-%d'))
        
        if not start_date and not end_date:
            from datetime import datetime, timedelta
            seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
            query = query.gte('hora_solicitud', seven_days_ago.isoformat())

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
        # 4. Tabla: Estado de Módulos (Consulta explícita)
        # Le decimos que use la relación 'turnos_id_modulo_atencion_fkey'
        modules_status_resp = supabase.table('modulos') \
            .select('*, turnos:turnos!turnos_id_modulo_atencion_fkey(prefijo_turno, numero_turno, estado)') \
            .eq('id_organizacion', org_id) \
            .order('nombre_modulo', desc=False) \
            .execute()
        # --- FIN DE LA CORRECCIÓN ---

        # 5. Obtenemos los usuarios POR SEPARADO (Esto ya estaba bien)
        users_resp = supabase.table('usuarios') \
            .select('id_modulo_asignado, nombre_completo') \
            .eq('id_organizacion', org_id) \
            .execute()

        kpis = {
            "waiting_count": waiting_resp.count or 0,
            "attended_today_count": attended_resp.count or 0,
            "active_modules_count": active_modules_resp.count or 0
        }
        
        return jsonify({
            "success": True, 
            "kpis": kpis,
            "modules_status": modules_status_resp.data,
            "users": users_resp.data
        }), 200

    except Exception as e:
        logging.error(f"Error en api_get_dashboard_data: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    

# app.py

@app.route('/api/funcionario/get-pending-turns')
@login_required
def api_get_pending_turns():
    """
    Obtiene los turnos pendientes (Versión corregida, usando lógica de Python).
    """
    if not g.org or not g.user:
        return jsonify({"success": False, "error": "No autorizado"}), 401

    module_id = g.user.get('assigned_module_id')
    org_id = g.org['id_organizacion']

    if not module_id:
        return jsonify({"success": True, "turns": []}), 200

    try:
        # --- INICIO DE LA LÓGICA COPIADA DE /api/call-next ---
        
        # 1. Obtener los servicios/prioridades de este módulo
        ms_resp = supabase.table('modulos_servicios') \
            .select('id_servicio, prioridad') \
            .eq('id_modulo', module_id) \
            .eq('id_organizacion', org_id) \
            .execute()
        
        priority_map = {ms['id_servicio']: ms['prioridad'] for ms in ms_resp.data}
        service_ids = list(priority_map.keys())

        service_ids_str = f"({','.join(map(str, service_ids))})" if service_ids else "()"
        filter1 = f"and(id_servicio.in.{service_ids_str},id_modulo_reasignado.is.null)"
        filter2 = f"id_modulo_reasignado.eq.{module_id}"

        # 2. Obtener los turnos (¡CON EL SELECT CORREGIDO!)
        turns_resp = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, hora_solicitud, id_servicio, id_modulo_reasignado, servicios(nombre_servicio)') \
            .eq('estado', 'en espera') \
            .eq('id_organizacion', org_id) \
            .or_(f"{filter1},{filter2}") \
            .order('hora_solicitud', desc=False) \
            .execute()

        if not turns_resp.data:
            return jsonify({"success": True, "turns": []}), 200

        # 3. Definir la clave de ordenamiento
        def sort_key(turn):
            if turn.get('id_modulo_reasignado') == module_id:
                return (0, datetime.fromisoformat(turn['hora_solicitud']))
            priority = priority_map.get(turn['id_servicio'], 99)
            solicitude_time = datetime.fromisoformat(turn['hora_solicitud'])
            return (priority, solicitude_time)
        
        # 4. Ordenar los turnos
        sorted_turns = sorted(turns_resp.data, key=sort_key)
        
        # --- FIN DE LA LÓGICA COPIADA ---
        
        return jsonify({"success": True, "turns": sorted_turns}), 200

    except Exception as e:
        logging.error(f"Error en api_get_pending_turns (Lógica Python): {e}")
        return jsonify({"success": False, "error": f"Error interno del servidor: {e}"}), 500
    
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
    """
    Obtiene el turno actual en atención del funcionario.
    (Versión 2 - Robustecida para manejar 0 resultados)
    """
    logging.info("=== INICIO api_get_current_turn ===")
    
    if not g.org or not g.user:
        logging.error("No autorizado: g.org o g.user es None")
        return jsonify({"success": False, "error": "No autorizado"}), 401
    
    module_id = g.user.get('assigned_module_id')
    org_id = g.org['id_organizacion']
    
    logging.info(f"Module ID: {module_id}, Org ID: {org_id}")

    if not module_id:
        logging.info("Funcionario sin módulo asignado")
        return jsonify({"success": True, "turn": None}), 200

    try:
        logging.info("Buscando turno actual...")
        response = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, servicios!left(nombre_servicio), clientes!left(nombre_completo)') \
            .eq('estado', 'en atencion') \
            .eq('id_modulo_atencion', module_id) \
            .eq('id_organizacion', org_id) \
            .order('hora_llamado', desc=True) \
            .limit(1) \
            .execute()
        
        logging.info(f"Respuesta turno actual: {response}")
        
        # --- ¡ESTA ES LA LÓGICA DE SEGURIDAD CLAVE! ---
        # .limit(1) devuelve data: [] si no encuentra nada.
        # Esta línea comprueba si la lista NO está vacía antes de acceder a data[0].
        turn_data = response.data[0] if response.data and len(response.data) > 0 else None
        
        logging.info(f"Turno encontrado: {turn_data}")
        
        logging.info("=== FIN api_get_current_turn (éxito) ===")
        return jsonify({"success": True, "turn": turn_data}), 200
            
    except Exception as e:
        logging.error(f"=== ERROR en api_get_current_turn: {e}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": f"Error interno del servidor: {str(e)}"}), 500


@app.route('/api/funcionario/get-daily-history')
@login_required
def api_get_daily_history():
    """
    Obtiene el historial diario de turnos atendidos.
    """
    if not g.org or not g.user:
        return jsonify({"success": False, "error": "No autorizado"}), 401

    module_id = g.user.get('assigned_module_id')
    org_id = g.org['id_organizacion']
    
    if not module_id:
        return jsonify({"success": True, "history": []}), 200

    try:
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        response = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, hora_finalizacion') \
            .eq('estado', 'atendido') \
            .eq('id_modulo_atencion', module_id) \
            .eq('id_organizacion', org_id) \
            .gte('hora_finalizacion', today) \
            .order('hora_finalizacion', desc=True) \
            .execute()
        
        history_data = response.data if response and response.data else []
        return jsonify({"success": True, "history": history_data}), 200
            
    except Exception as e:
        logging.error(f"Error en api_get_daily_history: {e}")
        return jsonify({"success": False, "error": f"Error interno del servidor: {str(e)}"}), 500

@app.route('/api/funcionario/get-panel-data')
@login_required
def api_get_panel_data():
    """
    API Maestra: Obtiene TODOS los datos para el panel de funcionario
    (Versión 2 - Corregida para manejar 'hora_solicitud' nulas)
    """
    if not g.org or not g.user:
        return jsonify({"success": False, "error": "No autorizado"}), 401
    
    module_id = g.user.get('assigned_module_id')
    org_id = g.org['id_organizacion']

    if not module_id:
        return jsonify({
            "success": True,
            "pending_turns": [],
            "current_turn": None,
            "daily_history": []
        }), 200

    data = {
        "pending_turns": [],
        "current_turn": None,
        "daily_history": []
    }

    try:
        # --- Lógica de get_pending_turns ---
        ms_resp = supabase.table('modulos_servicios').select('id_servicio, prioridad').eq('id_modulo', module_id).eq('id_organizacion', org_id).execute()
        priority_map = {ms['id_servicio']: ms['prioridad'] for ms in ms_resp.data}
        service_ids = list(priority_map.keys())
        service_ids_str = f"({','.join(map(str, service_ids))})" if service_ids else "()"
        filter1 = f"and(id_servicio.in.{service_ids_str},id_modulo_reasignado.is.null)"
        filter2 = f"id_modulo_reasignado.eq.{module_id}"
        
        turns_resp = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, hora_solicitud, id_servicio, id_modulo_reasignado, servicios(nombre_servicio)') \
            .eq('estado', 'en espera').eq('id_organizacion', org_id).or_(f"{filter1},{filter2}") \
            .order('hora_solicitud', desc=False).execute()
        
        if turns_resp.data:
            
            # --- INICIO DE LA CORRECCIÓN ---
            def sort_key(turn):
                # Usar la hora actual como un fallback seguro si 'hora_solicitud' es None
                default_time = datetime.now(timezone.utc) 
                solicitude_time_str = turn.get('hora_solicitud')
                
                try:
                    # Intentar parsear la fecha/hora; si es None o inválida, usar el fallback
                    solicitude_time = datetime.fromisoformat(solicitude_time_str) if solicitude_time_str else default_time
                except (ValueError, TypeError):
                    solicitude_time = default_time # Fallback por si la fecha está mal formada

                if turn.get('id_modulo_reasignado') == module_id:
                    # Prioridad 0 (reasignado), luego por hora
                    return (0, solicitude_time) 
                
                priority = priority_map.get(turn['id_servicio'], 99)
                # Prioridad del servicio, luego por hora
                return (priority, solicitude_time)
            # --- FIN DE LA CORRECCIÓN ---

            data["pending_turns"] = sorted(turns_resp.data, key=sort_key)

        # --- Lógica de get_current_turn (Esta ya era robusta) ---
        current_resp = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, servicios!left(nombre_servicio), clientes!left(nombre_completo)') \
            .eq('estado', 'en atencion').eq('id_modulo_atencion', module_id).eq('id_organizacion', org_id) \
            .order('hora_llamado', desc=True).limit(1).execute()
        
        if current_resp.data and len(current_resp.data) > 0:
            data["current_turn"] = current_resp.data[0]

        # --- Lógica de get_daily_history (Esta estaba bien) ---
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        history_resp = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, hora_finalizacion') \
            .eq('estado', 'atendido').eq('id_modulo_atencion', module_id).eq('id_organizacion', org_id) \
            .gte('hora_finalizacion', today).order('hora_finalizacion', desc=True).execute()
        
        if history_resp.data:
            data["daily_history"] = history_resp.data

        # --- Éxito ---
        return jsonify({"success": True, "data": data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_panel_data: {e}")
        logging.error(f"Traceback: {traceback.format_exc()}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/funcionario/call-next', methods=['POST'])
@login_required
def api_call_next():
    """
    Llama al siguiente turno disponible basado en la prioridad del módulo.
    (Versión 2, ahora incluye turnos reasignados).
    """
    if not g.org or not g.user or not g.user.get('assigned_module_id'):
        return jsonify({"success": False, "error": "No autorizado o sin módulo"}), 401

    org_id = g.org['id_organizacion']
    module_id = g.user.get('assigned_module_id')
    user_id = g.user.get('id')

    try:
        # 1. Verificar que este módulo no tenga ya un turno "en atencion"
        current_check = supabase.table('turnos').select('id_turno').eq('id_modulo_atencion', module_id).eq('estado', 'en atencion').eq('id_organizacion', org_id).execute()
        if current_check.data:
            return jsonify({"success": False, "error": "Ya tiene un turno en atención. Finalícelo primero."}), 409

        # --- ¡ESTA ES LA CORRECCIÓN! ---
        # 2. Replicamos la lógica exacta de `api_get_pending_turns`
        ms_resp = supabase.table('modulos_servicios').select('id_servicio, prioridad').eq('id_modulo', module_id).eq('id_organizacion', org_id).execute()
        priority_map = {ms['id_servicio']: ms['prioridad'] for ms in ms_resp.data}
        service_ids = list(priority_map.keys())

        service_ids_str = f"({','.join(map(str, service_ids))})" if service_ids else "()"
        filter1 = f"and(id_servicio.in.{service_ids_str},id_modulo_reasignado.is.null)"
        filter2 = f"id_modulo_reasignado.eq.{module_id}"

        turns_resp = supabase.table('turnos') \
            .select('id_turno, prefijo_turno, numero_turno, hora_solicitud, id_servicio, id_modulo_reasignado, servicios(nombre_servicio)') \
            .eq('estado', 'en espera') \
            .eq('id_organizacion', org_id) \
            .or_(f"{filter1},{filter2}") \
            .order('hora_solicitud', desc=False) \
            .execute()
        # --- FIN DE LA CORRECCIÓN ---
        
        if not turns_resp.data:
            return jsonify({"success": False, "error": "No hay turnos pendientes para llamar."}), 404
            
        def sort_key(turn):
            if turn.get('id_modulo_reasignado') == module_id:
                return (0, datetime.fromisoformat(turn['hora_solicitud']))
            priority = priority_map.get(turn['id_servicio'], 99)
            solicitude_time = datetime.fromisoformat(turn['hora_solicitud'])
            return (priority, solicitude_time)
        
        # 3. Encontramos el turno correcto
        next_turn = sorted(turns_resp.data, key=sort_key)[0]

        # 4. ¡ACCIÓN! Actualizamos el turno de forma atómica
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
            raise Exception("El turno acaba de ser llamado por otro módulo. Intente de nuevo.")

        # 5. Insertamos el log
        supabase.table('logs_turnos').insert({
            'id_turno': next_turn['id_turno'],
            'id_usuario': user_id,
            'accion': 'llamado',
            'id_organizacion': org_id
        }).execute()

        # 6. Devolvemos el turno que se llamó
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
    (Versión 6, corrigiendo el manejo de la respuesta exitosa)
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 404
    
    try:
        # 1. Llamamos a nuestra nueva función RPC
        # La librería AHORA lanzará una excepción (APIError) si falla,
        # que será capturada por el 'except' block.
        response = supabase.rpc('get_visualizador_data').execute()
        
        # --- ¡LA CORRECCIÓN! ---
        # Borramos el 'if response.error:'
        # Si el código llega a esta línea, la llamada FUE exitosa.
        # --- FIN DE LA CORRECCIÓN ---

        # 2. Procesamos los datos (vienen todos en una lista)
        all_data = response.data
        current_turn_data = None
        history_data = []

        for row in all_data:
            # Hacemos esto más seguro en caso de que la fila sea nula
            if not row:
                continue
                
            if row.get('type') == 'current':
                # Re-empaquetamos los datos para que coincidan con el formato JS
                current_turn_data = {
                    "id_turno": row.get('id_turno'),
                    "prefijo_turno": row.get('prefijo_turno'),
                    "numero_turno": row.get('numero_turno'),
                    "modulos": { "nombre_modulo": row.get('nombre_modulo') }
                }
            elif row.get('type') == 'history':
                history_data.append({
                    "prefijo_turno": row.get('prefijo_turno'),
                    "numero_turno": row.get('numero_turno'),
                    "modulos": { "nombre_modulo": row.get('nombre_modulo') }
                })

        return jsonify({
            "success": True,
            "current_turn": current_turn_data,
            "history": history_data
        }), 200

    except Exception as e:
        # Si la RPC falla (ej. error de BD), la librería lanza una excepción
        # y caerá aquí.
        logging.error(f"Error en api_get_visualizador_data (RPC): {e}")
        logging.error(f"Traceback: {traceback.format_exc()}")
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

@app.route('/api/funcionario/transfer-turn', methods=['POST'])
@login_required
def api_transfer_turn():
    """
    Transfiere un turno de un módulo a otro.
    """
    if not g.org or not g.user: return jsonify({"success": False, "error": "No autorizado"}), 401
    
    org_id = g.org['id_organizacion']
    data = request.get_json()
    turn_id = data.get('turn_id')
    target_module_id = data.get('target_module_id')

    if not turn_id or not target_module_id:
        return jsonify({"success": False, "error": "Faltan parámetros (turn_id o target_module_id)"}), 400
    
    try:
        response = supabase.table('turnos') \
            .update({
                'id_modulo_reasignado': target_module_id,
                'hora_llamado': None,
                'id_modulo_atencion': None
            }) \
            .eq('id_turno', turn_id) \
            .eq('id_organizacion', org_id) \
            .eq('estado', 'en espera') \
            .execute()

        if not response.data:
            raise Exception("No se pudo transferir el turno (ya fue llamado o no existe).")

        # --- ¡CÓDIGO ELIMINADO! ---
        # Ya no intentamos enviar un broadcast desde el cliente sync.
        # El UPDATE anterior es suficiente para que Realtime
        # notifique a los paneles sobre el cambio.
        # --- FIN DE LA ELIMINACIÓN ---

        return jsonify({"success": True, "message": "Turno transferido exitosamente."}), 200

    except Exception as e:
        logging.error(f"Error en api_transfer_turn: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/funcionario/get-transfer-targets')
@login_required
def api_get_transfer_targets():
    """
    Obtiene una lista de todos los módulos activos en la organización
    EXCEPTO el módulo del propio funcionario.
    """
    if not g.org or not g.user: return jsonify({"success": False, "error": "No autorizado"}), 401
    
    org_id = g.org['id_organizacion']
    my_module_id = g.user.get('assigned_module_id')

    try:
        query = supabase.table('modulos') \
            .select('id_modulo, nombre_modulo') \
            .eq('id_organizacion', org_id) \
            .eq('estado', 'activo')
        
        # Si el funcionario tiene un módulo, lo excluimos de la lista
        if my_module_id:
            query = query.neq('id_modulo', my_module_id)
            
        response = query.order('nombre_modulo', desc=False).execute()

        return jsonify({"success": True, "modules": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_transfer_targets: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    

# --- (HELPER) Función de Seguridad para el Chat ---
# Esta función verifica que el usuario logueado PERTENECE a la sala de chat
# antes de permitirle leer o escribir en ella.
def verificar_pertenencia_chat(user_id, room_id, org_id):
    """
    Verifica si un usuario es participante de una sala de chat.
    Devuelve True si pertenece, False si no.
    """
    try:
        response = supabase.table('chat_participants') \
            .select('id') \
            .eq('user_id', user_id) \
            .eq('room_id', room_id) \
            .eq('id_organizacion', org_id) \
            .single() \
            .execute()
        
        return response.data is not None
    except Exception as e:
        logging.error(f"Error al verificar pertenencia a chat: {e}")
        return False

# --- API 1: Obtener la lista de Salas de Chat ---
@app.route('/api/chat/rooms')
@login_required
def api_get_chat_rooms():
    """
    Obtiene todas las salas de chat (Global y Directas)
    a las que pertenece el usuario logueado.
    """
    if not g.org or not g.user:
        return jsonify({"success": False, "error": "No autorizado"}), 401
        
    org_id = g.org['id_organizacion']
    user_id = g.user['id']
    
    try:
        # Hacemos un "join" a través de chat_participants
        # "Tráeme todas las chat_rooms que estén vinculadas a mí en la tabla chat_participants"
        response = supabase.table('chat_participants') \
            .select('chat_rooms(*)') \
            .eq('user_id', user_id) \
            .eq('id_organizacion', org_id) \
            .execute()
        
        # Extraemos las salas de la respuesta
        rooms = [item['chat_rooms'] for item in response.data if item.get('chat_rooms')]
            
        return jsonify({"success": True, "rooms": rooms}), 200

    except Exception as e:
        logging.error(f"Error en api_get_chat_rooms: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# --- API 2: Obtener los Mensajes de una Sala ---
@app.route('/api/chat/messages/<int:room_id>')
@login_required
def api_get_chat_messages(room_id):
    """
    Obtiene todos los mensajes de una sala de chat específica.
    Primero, verifica que el usuario pertenezca a esa sala.
    """
    if not g.org or not g.user:
        return jsonify({"success": False, "error": "No autorizado"}), 401
    
    org_id = g.org['id_organizacion']
    user_id = g.user['id']

    try:
        # 1. ¡Control de Seguridad!
        if not verificar_pertenencia_chat(user_id, room_id, org_id):
            return jsonify({"success": False, "error": "Acceso denegado a esta sala de chat."}), 403 # 403 Forbidden

        # 2. Si el usuario pertenece, obtenemos los mensajes
        # Hacemos join con 'usuarios' para obtener el nombre del remitente
        response = supabase.table('chat_messages') \
            .select('*, sender:sender_id(nombre_completo)') \
            .eq('room_id', room_id) \
            .eq('id_organizacion', org_id) \
            .order('sent_at', desc=False) \
            .execute()

        return jsonify({"success": True, "messages": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_chat_messages: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


# --- API 3: Enviar un Mensaje Nuevo ---
@app.route('/api/chat/send-message', methods=['POST'])
@login_required
def api_send_message():
    """
    Publica un nuevo mensaje en una sala de chat.
    Primero, verifica que el usuario pertenezca a esa sala.
    """
    if not g.org or not g.user:
        return jsonify({"success": False, "error": "No autorizado"}), 401
    
    org_id = g.org['id_organizacion']
    user_id = g.user['id']
    
    data = request.get_json()
    room_id = data.get('room_id')
    content = data.get('content')

    if not room_id or not content:
        return jsonify({"success": False, "error": "Faltan 'room_id' o 'content'."}), 400

    try:
        # 1. ¡Control de Seguridad!
        if not verificar_pertenencia_chat(user_id, room_id, org_id):
            return jsonify({"success": False, "error": "No tiene permiso para enviar mensajes a esta sala."}), 403

        # 2. Si el usuario pertenece, inserta el mensaje
        message_data = {
            'room_id': room_id,
            'sender_id': user_id,
            'content': content,
            'id_organizacion': org_id
        }
        
        response = supabase.table('chat_messages') \
            .insert(message_data) \
            .execute()

        # TODO (Fase 4): Enviar un broadcast de Realtime
        # por 'chat_messages' para notificar a otros usuarios
        
        return jsonify({"success": True, "sent_message": response.data[0]}), 201 # 201 Created

    except Exception as e:
        logging.error(f"Error en api_send_message: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/get-users-list')
@login_required
def api_get_users_list():
    """
    Obtiene una lista simple (ID y nombre) de todos los usuarios
    en la organización del funcionario.
    """
    if not g.org:
        return jsonify({"success": False, "error": "Organización no identificada"}), 401
    
    try:
        response = supabase.table('usuarios') \
            .select('id_usuario, nombre_completo') \
            .eq('id_organizacion', g.org['id_organizacion']) \
            .execute()
        return jsonify({"success": True, "users": response.data}), 200
    except Exception as e:
        logging.error(f"Error en api_get_users_list: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ==========================================================
# API SEGURA PARA SUPERADMIN
# ==========================================================

@app.route('/api/superadmin/get-organizations')
@superadmin_required
def api_get_organizations():
    """
    Obtiene TODAS las organizaciones (clientes) en el sistema.
    """
    try:
        response = supabase.table('organizaciones') \
            .select('*') \
            .order('nombre_organizacion', desc=False) \
            .execute()
            
        return jsonify({"success": True, "organizations": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_organizations: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    

@app.route('/api/superadmin/create-organization', methods=['POST'])
@superadmin_required
def api_create_organization():
    """
    Crea una nueva organización (cliente) en el sistema.
    """
    data = request.get_json()
    if not data or not data.get('nombre_organizacion') or not data.get('subdominio_local'):
        return jsonify({"success": False, "error": "Nombre y Subdominio Local son requeridos"}), 400

    try:
        # Preparamos la configuración por defecto
        default_config = {
            "branding": {
                "logo_url": data.get('logo_url') or None,
                "color_primario": data.get('color_primario') or "#1e40af" # Default azul
            },
            "features": {
                "chat_enabled": True,
                "transfer_enabled": True,
                "reports_enabled": True
            }
        }
        
        # Preparamos el nuevo registro
        new_org_data = {
            'nombre_organizacion': data.get('nombre_organizacion'),
            'subdominio': data.get('subdominio') or None,
            'subdominio_local': data.get('subdominio_local'),
            'estado': 'activo',
            'configuracion': default_config
        }
        
        response = supabase.table('organizaciones').insert(new_org_data).execute()

        if response.data:
            logging.info(f"Superadmin {g.user['name']} creó la organización: {data.get('nombre_organizacion')}")
            # Devolvemos la organización recién creada
            return jsonify({"success": True, "organization": response.data[0]}), 201
        else:
            raise Exception("No se recibieron datos de Supabase después de insertar.")

    except Exception as e:
        logging.error(f"Error en api_create_organization: {e}")
        if 'violates unique constraint' in str(e).lower():
             return jsonify({"success": False, "error": "Error: Ese subdominio ya está en uso."}), 409
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/superadmin/update-organization/<int:org_id>', methods=['PUT'])
@superadmin_required
def api_update_organization(org_id):
    """
    Actualiza una organización existente (nombre, subdominios, marca).
    """
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Faltan datos"}), 400

    try:
        # Obtenemos la configuración actual para no sobreescribirla
        org_resp = supabase.table('organizaciones').select('configuracion').eq('id_organizacion', org_id).single().execute()
        if not org_resp.data:
             return jsonify({"success": False, "error": "Organización no encontrada"}), 404
        
        # Empezamos con la configuración existente
        current_config = org_resp.data.get('configuracion', {})
        
        # Actualizamos solo los campos de branding
        # '||' es el operador de "merge" de JSONB
        current_config['branding'] = {
            'logo_url': data.get('logo_url') or None,
            'color_primario': data.get('color_primario') or "#1e40af"
        }
        
        # Preparamos los datos a actualizar
        update_data = {
            'nombre_organizacion': data.get('nombre_organizacion'),
            'subdominio': data.get('subdominio') or None,
            'subdominio_local': data.get('subdominio_local'),
            'estado': data.get('estado', 'activo'),
            'configuracion': current_config
        }
        
        response = supabase.table('organizaciones') \
            .update(update_data) \
            .eq('id_organizacion', org_id) \
            .execute()

        if response.data:
            logging.info(f"Superadmin {g.user['name']} actualizó la organización: {org_id}")
            return jsonify({"success": True, "organization": response.data[0]}), 200
        else:
            raise Exception("No se recibieron datos de Supabase después de actualizar.")

    except Exception as e:
        logging.error(f"Error en api_update_organization: {e}")
        if 'violates unique constraint' in str(e).lower():
             return jsonify({"success": False, "error": "Error: Ese subdominio ya está en uso."}), 409
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/superadmin/get-admins')
@superadmin_required
def api_get_admins():
    """
    Obtiene TODOS los usuarios con rol 'admin' o 'superadmin'
    y la organización a la que pertenecen.
    """
    try:
        # Hacemos "join" para obtener el nombre de la organización
        response = supabase.table('usuarios') \
            .select('id_usuario, nombre_completo, nombre_usuario, rol, organizacion:organizaciones(nombre_organizacion)') \
            .in_('rol', ['administrador', 'superadmin']) \
            .order('nombre_completo', desc=False) \
            .execute()
            
        return jsonify({"success": True, "users": response.data}), 200

    except Exception as e:
        logging.error(f"Error en api_get_admins: {e}")
        return jsonify({"success": False, "error": str(e)}), 500


@app.route('/api/superadmin/create-admin', methods=['POST'])
@superadmin_required
def api_create_admin():
    """
    Crea un nuevo usuario Administrador y lo vincula a una organización.
    """
    data = request.get_json()
    
    # Validación de campos
    if not all([data.get('nombre_completo'), 
                data.get('nombre_usuario'), 
                data.get('password'), 
                data.get('id_organizacion')]):
        return jsonify({"success": False, "error": "Faltan campos (nombre, usuario, contraseña, ID de organización)"}), 400

    try:
        # Hasheamos la contraseña (¡Importante!)
        hashed_password = generate_password_hash(data['password'])
        
        new_admin_data = {
            'nombre_completo': data.get('nombre_completo'),
            'nombre_usuario': data.get('nombre_usuario'),
            'contrasena': hashed_password,
            'id_organizacion': data.get('id_organizacion'),
            'rol': 'administrador' # El Superadmin solo crea Admins
        }
        
        response = supabase.table('usuarios').insert(new_admin_data).execute()

        if response.data:
            logging.info(f"Superadmin {g.user['name']} creó el admin: {data.get('nombre_usuario')}")
            return jsonify({"success": True, "user": response.data[0]}), 201
        else:
            raise Exception("No se recibieron datos de Supabase después de insertar.")

    except Exception as e:
        logging.error(f"Error en api_create_admin: {e}")
        if 'violates unique constraint "usuarios_nombre_usuario_key"' in str(e).lower():
             return jsonify({"success": False, "error": "Error: Ese nombre de usuario ya está en uso."}), 409
        return jsonify({"success": False, "error": str(e)}), 500

# --- Ejecución de la Aplicación ---
if __name__ == '__main__':
    # Para desarrollo, puedes usar app.run(debug=True)
    # En producción, usa un servidor WSGI como Gunicorn o uWSGI
    app.run(debug=True, host='0.0.0.0', port=5000)

