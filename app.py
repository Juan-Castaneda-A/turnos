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
    # 1. Recopilamos todos los parámetros de la URL
    start_date = request.args.get('start')
    end_date = request.args.get('end')
    group_by = request.args.get('group_by') # El que agrupa
    user_id = request.args.get('user_id')     # Filtro opcional
    module_id = request.args.get('module_id') # Filtro opcional

    if not all([start_date, end_date, group_by]):
        return jsonify({"error": "Faltan parámetros requeridos (start, end, group_by)"}), 400
    
    try:
        # 2. Creamos un diccionario de parámetros con los NOMBRES EXACTOS que la función SQL espera
        params = {
            'start_date': start_date,
            'end_date': end_date,
            'group_by_param': group_by,
            # ¡CAMBIO CLAVE! Añadimos el ID de la organización del admin logueado
            '_id_organizacion': g.org['id_organizacion'] # <-- DATO NUEVO
        }

        # 3. Añadimos los parámetros OPCIONALES solo si existen, usando los nombres con guion bajo
        if user_id:
            params['_user_id'] = int(user_id)
        if module_id:
            params['_module_id'] = int(module_id)
        
        # 4. Llamamos a la función RPC con el diccionario de parámetros correcto
        response = supabase.rpc('get_report_data', params).execute()

        if response.data:
            return jsonify(response.data)
        else:
            # Si hay un error en la respuesta de Supabase, lo mostramos
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

# --- Ejecución de la Aplicación ---
if __name__ == '__main__':
    # Para desarrollo, puedes usar app.run(debug=True)
    # En producción, usa un servidor WSGI como Gunicorn o uWSGI
    app.run(debug=True, host='0.0.0.0', port=5000)

