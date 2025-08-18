// Importar el cliente de Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';

// Variables de configuración (pasadas desde Flask)
//const SUPABASE_URL = "{{ supabase_url }}";
//const SUPABASE_KEY = "{{ supabase_key }}";
//const USER_ID = "{{ g.user.id }}"; // Ahora se lee de g.user
//const USER_NAME = "{{ g.user.name }}"; // Ahora se lee de g.user

// Inicializar Supabase
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
console.log("Supabase Client inicializado para Panel de Administración.");
console.log("Objeto Supabase:", supabase);
console.log("¿Existe supabase.from?", typeof supabase.from);

const navLinks = document.querySelectorAll('.nav-link');
const contentSections = document.querySelectorAll('.content-section');

const turnsWaitingElement = document.getElementById('turns-waiting');
const turnsAttendedTodayElement = document.getElementById('turns-attended-today');
const activeModulesElement = document.getElementById('active-modules');
const realtimeModulesStatusBody = document.getElementById('realtime-modules-status-body');

const addUserBtn = document.getElementById('add-user-btn');
const userFormContainer = document.getElementById('user-form-container');
const userFormTitle = document.getElementById('user-form-title');
const userForm = document.getElementById('user-form');
const userIdField = document.getElementById('user-id-field');
const fullNameField = document.getElementById('full-name-field');
const usernameField = document.getElementById('username-field');
const passwordField = document.getElementById('password-field');
const roleField = document.getElementById('role-field');
const assignedModuleField = document.getElementById('assigned-module-field');
const saveUserBtn = document.getElementById('save-user-btn');
const cancelUserFormBtn = document.getElementById('cancel-user-form-btn');
const usersTableBody = document.getElementById('users-table-body');

const addModuleBtn = document.getElementById('add-module-btn');
const moduleFormContainer = document.getElementById('module-form-container');
const moduleFormTitle = document.getElementById('module-form-title');
const moduleForm = document.getElementById('module-form');
const moduleIdField = document.getElementById('module-id-field');
// CORRECCIÓN: Eliminado el error de tipeo "document ="
const moduleNameField = document.getElementById('module-name-field');
const moduleDescriptionField = document.getElementById('module-description-field');
const moduleStatusField = document.getElementById('module-status-field');
const moduleStatusText = document.getElementById('module-status-text');
const saveModuleBtn = document.getElementById('save-module-btn');
const cancelModuleFormBtn = document.getElementById('cancel-module-form-btn');
const modulesTableBody = document.getElementById('modules-table-body');

const servicesConfigHeader = document.getElementById('services-config-header');
const servicesConfigBody = document.getElementById('services-config-body');
const saveServicesConfigBtn = document.getElementById('save-services-config-btn');

const historyStartDate = document.getElementById('history-start-date');
const historyEndDate = document.getElementById('history-end-date');
const historyServiceFilter = document.getElementById('history-service-filter');
const filterHistoryBtn = document.getElementById('filter-history-btn');
const turnHistoryTableBody = document.getElementById('turn-history-table-body');

const resetTurnsBtn = document.getElementById('reset-turns-btn');

const confirmationModal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

function showConfirmationModal(title, message) {
    return new Promise((resolve) => {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        confirmationModal.classList.remove('hidden');

        const handleConfirm = () => {
            confirmationModal.classList.add('hidden');
            modalConfirmBtn.removeEventListener('click', handleConfirm);
            modalCancelBtn.removeEventListener('click', handleCancel);
            resolve(true);
        };

        const handleCancel = () => {
            confirmationModal.classList.add('hidden');
            modalConfirmBtn.removeEventListener('click', handleConfirm);
            modalCancelBtn.removeEventListener('click', handleCancel);
            resolve(false);
        };

        modalConfirmBtn.addEventListener('click', handleConfirm);
        modalCancelBtn.addEventListener('click', handleCancel);
    });
}

function showView(viewId) {
    contentSections.forEach(section => {
        section.classList.add('hidden');
    });
    document.getElementById(viewId + '-view').classList.remove('hidden');

    navLinks.forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`.nav-link[data-view="${viewId}"]`).classList.add('active');

    switch (viewId) {
        case 'dashboard':
            loadDashboardSummary();
            loadRealtimeModulesStatus();
            break;
        case 'manage-users':
            loadUsers();
            loadModulesForUserAssignment();
            break;
        case 'manage-modules':
            loadModules();
            break;
        case 'configure-services':
            loadServicesConfig();
            break;
        case 'reports':
            // Lógica para cargar reportes (si aplica)
            break;
        case 'turn-history':
            loadHistoryServicesFilter();
            loadTurnHistory();
            break;
        case 'notary-settings':
            // Lógica para cargar configuración de notaría (si aplica)
            break;
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        showView(e.currentTarget.dataset.view);
    });
});

async function loadDashboardSummary() {
    try {
        const { count: waitingCount, error: waitingError } = await supabase
            .from('turnos')
            .select('*', { count: 'exact' })
            .eq('estado', 'en espera');
        if (waitingError) throw waitingError;
        turnsWaitingElement.textContent = waitingCount;

        const today = new Date().toISOString().split('T')[0];
        const { count: attendedCount, error: attendedError } = await supabase
            .from('turnos')
            .select('*', { count: 'exact' })
            .eq('estado', 'atendido')
            .gte('hora_finalizacion', today);
        if (attendedError) throw attendedError;
        turnsAttendedTodayElement.textContent = attendedCount;

        const { count: activeModulesCount, error: activeModulesError } = await supabase
            .from('modulos')
            .select('*', { count: 'exact' })
            .eq('estado', 'activo');
        if (activeModulesError) throw activeModulesError;
        activeModulesElement.textContent = activeModulesCount;

    } catch (error) {
        console.error("Error al cargar resumen del dashboard:", error.message);
        turnsWaitingElement.textContent = 'Error';
        turnsAttendedTodayElement.textContent = 'Error';
        activeModulesElement.textContent = 'Error';
    }
}

async function loadRealtimeModulesStatus() {
    realtimeModulesStatusBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500 py-4">Cargando estado de módulos...</td></tr>`;
    try {
        // Obtener todos los usuarios y mapear su id_modulo_asignado a su nombre
        let moduleToUserNameMap = {};
        try {
            const { data: users, error: usersError } = await supabase
                .from('usuarios')
                .select('id_usuario, nombre_completo, id_modulo_asignado');
            if (usersError) throw usersError;
            
            users.forEach(user => {
                if (user.id_modulo_asignado) {
                    moduleToUserNameMap[user.id_modulo_asignado] = user.nombre_completo;
                }
            });
        } catch (error) {
            console.error("Error al cargar usuarios para el estado de módulos en tiempo real:", error.message);
        }

        const { data: modulesData, error: modulesError } = await supabase
            .from('modulos')
            .select(`
                *,
                turnos(id_turno, numero_turno, prefijo_turno, estado)
            `)
            .order('nombre_modulo', { ascending: true });

        if (modulesError) throw modulesError;

        realtimeModulesStatusBody.innerHTML = '';
        if (modulesData.length === 0) {
            realtimeModulesStatusBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay módulos registrados.</td></tr>`;
            return;
        }

        modulesData.forEach(mod => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            let statusClass = '';
            let statusText = '';
            let currentTurnInfo = '---';

            // Obtener el nombre del funcionario asignado a este módulo
            const funcionarioNombre = moduleToUserNameMap[mod.id_modulo] || 'Sin Asignar';

            const currentTurn = mod.turnos ? mod.turnos.find(t => t.estado === 'en atencion') : null;

            switch (mod.estado) {
                case 'activo':
                    statusClass = 'text-green-400';
                    statusText = 'Activo';
                    break;
                case 'inactivo':
                    statusClass = 'text-red-400';
                    statusText = 'Inactivo';
                    break;
                default:
                    statusClass = 'text-gray-400';
                    statusText = mod.estado;
            }

            if (currentTurn) {
                statusText = 'Atendiendo';
                statusClass = 'text-yellow-400';
                currentTurnInfo = `${currentTurn.prefijo_turno}-${String(currentTurn.numero_turno).padStart(3, '0')}`;
            }

            tr.innerHTML = `
                <td class="px-4 py-2">${mod.nombre_modulo}</td>
                <td class="px-4 py-2">${funcionarioNombre}</td>
                <td class="px-4 py-2 ${statusClass}">${statusText}</td>
                <td class="px-4 py-2">${currentTurnInfo}</td>
            `;
            realtimeModulesStatusBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar estado de módulos en tiempo real:", error.message);
        realtimeModulesStatusBody.innerHTML = `<tr><td colspan="4" class="text-center text-red-400 py-4">Error al cargar estado de módulos.</td></tr>`;
    }
}

async function loadUsers() {
    usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">Cargando usuarios...</td></tr>`;
    try {
        const { data: users, error } = await supabase
            .from('usuarios')
            .select('*, modulos(nombre_modulo)')
            .order('nombre_completo', { ascending: true });
        if (error) throw error;

        usersTableBody.innerHTML = '';
        if (users.length === 0) {
            usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay usuarios registrados.</td></tr>`;
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            tr.innerHTML = `
                <td class="px-4 py-2">${user.nombre_completo}</td>
                <td class="px-4 py-2">${user.nombre_usuario}</td>
                <td class="px-4 py-2">${user.rol}</td>
                <td class="px-4 py-2">${user.modulos ? user.modulos.nombre_modulo : 'N/A'}</td>
                <td class="px-4 py-2">
                    <button class="form-button btn-primary text-sm px-3 py-1 mr-2 edit-user-btn" data-id="${user.id_usuario}">Editar</button>
                    <button class="form-button btn-danger text-sm px-3 py-1 delete-user-btn" data-id="${user.id_usuario}">Eliminar</button>
                </td>
            `;
            usersTableBody.appendChild(tr);
        });

        document.querySelectorAll('.edit-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => editUser(e.target.dataset.id));
        });
        document.querySelectorAll('.delete-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteUser(e.target.dataset.id));
        });

    } catch (error) {
        console.error("Error al cargar usuarios:", error.message);
        usersTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-400 py-4">Error al cargar usuarios.</td></tr>`;
    }
}

async function loadModulesForUserAssignment() {
    try {
        const { data: modules, error } = await supabase.from('modulos').select('id_modulo, nombre_modulo').order('nombre_modulo', { ascending: true });
        if (error) throw error;

        assignedModuleField.innerHTML = '<option value="">Sin Módulo Asignado</option>';
        modules.forEach(mod => {
            const option = document.createElement('option');
            option.value = mod.id_modulo;
            option.textContent = mod.nombre_modulo;
            assignedModuleField.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar módulos para asignación de usuario:", error.message);
    }
}

addUserBtn.addEventListener('click', () => {
    userFormContainer.classList.remove('hidden');
    userFormTitle.textContent = 'Crear Nuevo Usuario';
    userForm.reset();
    userIdField.value = '';
    passwordField.required = true;
});

cancelUserFormBtn.addEventListener('click', () => {
    userFormContainer.classList.add('hidden');
});

userForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = userIdField.value; 
    const password = passwordField.value;

    // Construir el objeto de datos para enviar a la API
    const userData = {
        nombre_completo: fullNameField.value,
        nombre_usuario: usernameField.value,
        rol: roleField.value,
        id_modulo_asignado: assignedModuleField.value || null
    };

    // Solo incluir el ID si estamos editando
    if (id) {
        userData.id_usuario = id;
    }

    // Solo incluir la contraseña si el usuario escribió una
    if (password) {
        userData.password = password;
    }

    const actionText = id ? 'Editar Usuario' : 'Crear Usuario';
    const confirmed = await showConfirmationModal(actionText, `¿Está seguro de que desea guardar este usuario?`);
    if (!confirmed) return;

    try {
        // --- Llamada a nuestra API segura en Flask ---
        const response = await fetch('/api/save-user', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            // Si la respuesta del servidor no es OK o el JSON indica un error
            throw new Error(result.error || 'Error desconocido del servidor.');
        }

        await showConfirmationModal('Éxito', result.message);
        userFormContainer.classList.add('hidden');
        loadUsers(); // Recargar la tabla de usuarios

    } catch (error) {
        console.error("Error al guardar usuario:", error.message);
        await showConfirmationModal('Error', `Error al guardar usuario: ${error.message}`);
    }
});

async function editUser(id) {
    try {
        const { data: user, error } = await supabase.from('usuarios').select('*').eq('id_usuario', id).single();
        if (error) throw error;

        userFormContainer.classList.remove('hidden');
        userFormTitle.textContent = `Editar Usuario: ${user.nombre_completo}`;
        userIdField.value = user.id_usuario;
        fullNameField.value = user.nombre_completo;
        usernameField.value = user.nombre_usuario;
        passwordField.value = '';
        passwordField.required = false;
        roleField.value = user.rol;
        assignedModuleField.value = user.id_modulo_asignado || '';
    } catch (error) {
        console.error("Error al cargar usuario para edición:", error.message);
        await showConfirmationModal('Error', `Error al cargar usuario para edición: ${error.message}`);
    }
}

async function deleteUser(id) {
    const confirmed = await showConfirmationModal('Eliminar Usuario', '¿Está seguro de que desea eliminar este usuario? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
        const { error } = await supabase.from('usuarios').delete().eq('id_usuario', id);
        if (error) throw error;
        await showConfirmationModal('Éxito', 'Usuario eliminado exitosamente.');
        loadUsers();
    } catch (error) {
        console.error("Error al eliminar usuario:", error.message);
        await showConfirmationModal('Error', `Error al eliminar usuario: ${error.message}`);
    }
}

async function loadModules() {
    modulesTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500 py-4">Cargando módulos...</td></tr>`;
    try {
        const { data: modules, error } = await supabase
            .from('modulos')
            .select('*')
            .order('nombre_modulo', { ascending: true });
        if (error) throw error;

        modulesTableBody.innerHTML = '';
        if (modules.length === 0) {
            modulesTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500 py-4">No hay módulos registrados.</td></tr>`;
            return;
        }

        modules.forEach(mod => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            const statusText = mod.estado === 'activo' ? 'Activo' : 'Inactivo';
            const statusClass = mod.estado === 'activo' ? 'text-green-400' : 'text-red-400';
            tr.innerHTML = `
                <td class="px-4 py-2">${mod.nombre_modulo}</td>
                <td class="px-4 py-2">${mod.descripcion || 'N/A'}</td>
                <td class="px-4 py-2 ${statusClass}">${statusText}</td>
                <td class="px-4 py-2">
                    <button class="form-button btn-primary text-sm px-3 py-1 mr-2 edit-module-btn" data-id="${mod.id_modulo}">Editar</button>
                    <button class="form-button btn-danger text-sm px-3 py-1 delete-module-btn" data-id="${mod.id_modulo}">Eliminar</button>
                </td>
            `;
            modulesTableBody.appendChild(tr);
        });

        document.querySelectorAll('.edit-module-btn').forEach(btn => {
            btn.addEventListener('click', (e) => editModule(e.target.dataset.id));
        });
        document.querySelectorAll('.delete-module-btn').forEach(btn => {
            btn.addEventListener('click', (e) => deleteModule(e.target.dataset.id));
        });

    } catch (error) {
        console.error("Error al cargar módulos:", error.message);
        modulesTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-red-400 py-4">Error al cargar módulos.</td></tr>`;
    }
}

addModuleBtn.addEventListener('click', () => {
    moduleFormContainer.classList.remove('hidden');
    moduleFormTitle.textContent = 'Crear Nuevo Módulo';
    moduleForm.reset();
    moduleIdField.value = '';
    moduleStatusField.checked = true;
    moduleStatusText.textContent = 'Activo';
});

cancelModuleFormBtn.addEventListener('click', () => {
    moduleFormContainer.classList.add('hidden');
});

moduleStatusField.addEventListener('change', () => {
    moduleStatusText.textContent = moduleStatusField.checked ? 'Activo' : 'Inactivo';
});

moduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = moduleIdField.value;
    const name = moduleNameField.value;
    const description = moduleDescriptionField.value;
    const status = moduleStatusField.checked ? 'activo' : 'inactivo';

    const moduleData = {
        nombre_modulo: name,
        descripcion: description,
        estado: status
    };

    try {
        if (id) {
            const confirmed = await showConfirmationModal('Editar Módulo', '¿Está seguro de que desea guardar los cambios de este módulo?');
            if (!confirmed) return;

            const { error } = await supabase.from('modulos').update(moduleData).eq('id_modulo', id);
            if (error) throw error;
            await showConfirmationModal('Éxito', 'Módulo actualizado exitosamente.');
        } else {
            const confirmed = await showConfirmationModal('Crear Módulo', '¿Está seguro de que desea crear este nuevo módulo?');
            if (!confirmed) return;

            const { error } = await supabase.from('modulos').insert(moduleData);
            if (error) throw error;
            await showConfirmationModal('Éxito', 'Módulo creado exitosamente.');
        }
        moduleFormContainer.classList.add('hidden');
        loadModules();
    } catch (error) {
        console.error("Error al guardar módulo:", error.message);
        await showConfirmationModal('Error', `Error al guardar módulo: ${error.message}`);
    }
});

async function editModule(id) {
    try {
        const { data: mod, error } = await supabase.from('modulos').select('*').eq('id_modulo', id).single();
        if (error) throw error;

        moduleFormContainer.classList.remove('hidden');
        moduleFormTitle.textContent = `Editar Módulo: ${mod.nombre_modulo}`;
        moduleIdField.value = mod.id_modulo;
        moduleNameField.value = mod.nombre_modulo;
        moduleDescriptionField.value = mod.descripcion || '';
        moduleStatusField.checked = mod.estado === 'activo';
        moduleStatusText.textContent = mod.estado === 'activo' ? 'Activo' : 'Inactivo';
    } catch (error) {
        console.error("Error al cargar módulo para edición:", error.message);
        await showConfirmationModal('Error', `Error al cargar módulo para edición: ${error.message}`);
    }
}

async function deleteModule(id) {
    const confirmed = await showConfirmationModal('Eliminar Módulo', '¿Está seguro de que desea eliminar este módulo? Esto también eliminará sus asignaciones de servicio y cualquier usuario asignado. Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
        const { error } = await supabase.from('modulos').delete().eq('id_modulo', id);
        if (error) throw error;
        await showConfirmationModal('Éxito', 'Módulo eliminado exitosamente.');
        loadModules();
    } catch (error) {
        console.error("Error al eliminar módulo:", error.message);
        await showConfirmationModal('Error', `Error al eliminar módulo: ${error.message}`);
    }
}

let allModules = [];
let allServices = [];
let currentModuleServiceConfig = {};

async function loadServicesConfig() {
    servicesConfigHeader.innerHTML = '<th class="px-4 py-2 rounded-tl-lg">Módulo</th>';
    servicesConfigBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">Cargando configuración...</td></tr>`;

    try {
        const { data: modules, error: modulesError } = await supabase.from('modulos').select('*').order('nombre_modulo', { ascending: true });
        if (modulesError) throw modulesError;
        allModules = modules;

        const { data: services, error: servicesError } = await supabase.from('servicios').select('*').order('nombre_servicio', { ascending: true });
        if (servicesError) throw servicesError;
        allServices = services;

        allServices.forEach(service => {
            const th = document.createElement('th');
            th.className = 'px-4 py-2';
            th.textContent = service.nombre_servicio;
            servicesConfigHeader.appendChild(th);
        });
        servicesConfigHeader.lastChild.classList.add('rounded-tr-lg');

        const { data: moduleServices, error: msError } = await supabase.from('modulos_servicios').select('*');
        if (msError) throw msError;

        currentModuleServiceConfig = {};
        moduleServices.forEach(ms => {
            if (!currentModuleServiceConfig[ms.id_modulo]) {
                currentModuleServiceConfig[ms.id_modulo] = [];
            }
            currentModuleServiceConfig[ms.id_modulo].push(ms.id_servicio);
        });

        servicesConfigBody.innerHTML = '';
        if (allModules.length === 0) {
            servicesConfigBody.innerHTML = `<tr><td colspan="${allServices.length + 1}" class="text-center text-gray-500 py-4">No hay módulos registrados.</td></tr>`;
            return;
        }
        if (allServices.length === 0) {
            servicesConfigBody.innerHTML = `<tr><td colspan="${allModules.length + 1}" class="text-center text-gray-500 py-4">No hay servicios registrados.</td></tr>`;
            return;
        }

        allModules.forEach(mod => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            let rowHtml = `<td class="px-4 py-2 font-bold">${mod.nombre_modulo}</td>`;
            allServices.forEach(service => {
                const isChecked = currentModuleServiceConfig[mod.id_modulo] && currentModuleServiceConfig[mod.id_modulo].includes(service.id_servicio);
                rowHtml += `
                    <td class="px-4 py-2 text-center">
                        <input type="checkbox"
                            class="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                            data-module-id="${mod.id_modulo}"
                            data-service-id="${service.id_servicio}"
                            ${isChecked ? 'checked' : ''}>
                    </td>
                `;
            });
            tr.innerHTML = rowHtml;
            servicesConfigBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar configuración de servicios:", error.message);
        servicesConfigBody.innerHTML = `<tr><td colspan="${allServices.length + 1}" class="text-center text-red-400 py-4">Error al cargar configuración.</td></tr>`;
    }
}

saveServicesConfigBtn.addEventListener('click', async () => {
    const confirmed = await showConfirmationModal('Guardar Configuración de Servicios', '¿Está seguro de que desea guardar los cambios en la asignación de servicios?');
    if (!confirmed) return;

    const newConfig = {};
    servicesConfigBody.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        const moduleId = parseInt(checkbox.dataset.moduleId);
        const serviceId = parseInt(checkbox.dataset.serviceId);
        if (checkbox.checked) {
            if (!newConfig[moduleId]) {
                newConfig[moduleId] = [];
            }
            newConfig[moduleId].push(serviceId);
        }
    });

    try {
        const { error: deleteError } = await supabase.from('modulos_servicios').delete().neq('id', 0);
        if (deleteError) throw deleteError;

        const inserts = [];
        for (const moduleId in newConfig) {
            newConfig[moduleId].forEach(serviceId => {
                inserts.push({ id_modulo: moduleId, id_servicio: serviceId });
            });
        }

        if (inserts.length > 0) {
            const { error: insertError } = await supabase.from('modulos_servicios').insert(inserts);
            if (insertError) throw insertError;
        }

        await showConfirmationModal('Éxito', 'Configuración de servicios guardada exitosamente.');
        loadServicesConfig();
    } catch (error) {
        console.error("Error al guardar configuración de servicios:", error.message);
        await showConfirmationModal('Error', `Error al guardar configuración de servicios: ${error.message}`);
    }
});

async function loadHistoryServicesFilter() {
    try {
        const { data: services, error } = await supabase.from('servicios').select('id_servicio, nombre_servicio').order('nombre_servicio', { ascending: true });
        if (error) throw error;

        historyServiceFilter.innerHTML = '<option value="">Filtrar por Servicio</option>';
        services.forEach(service => {
            const option = document.createElement('option');
            option.value = service.id_servicio;
            option.textContent = service.nombre_servicio;
            historyServiceFilter.appendChild(option);
        });
    } catch (error) {
        console.error("Error al cargar servicios para filtro de historial:", error.message);
    }
}

async function loadTurnHistory() {
    turnHistoryTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-4">Cargando historial...</td></tr>`;
    try {
        let query = supabase
            .from('turnos')
            .select('*, servicios(nombre_servicio), modulos(nombre_modulo), logs_turnos(accion, hora_accion)');

        const startDate = historyStartDate.value;
        const endDate = historyEndDate.value;
        const serviceId = historyServiceFilter.value;

        if (startDate) {
            query = query.gte('hora_solicitud', startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setDate(end.getDate() + 1);
            query = query.lt('hora_solicitud', end.toISOString().split('T')[0]);
        }
        if (serviceId) {
            query = query.eq('id_servicio', serviceId);
        }

        query = query.order('hora_solicitud', { ascending: false });

        const { data: history, error } = await query;
        if (error) throw error;

        turnHistoryTableBody.innerHTML = '';
        if (history.length === 0) {
            turnHistoryTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 py-4">No se encontraron turnos con los filtros aplicados.</td></tr>`;
            return;
        }

        history.forEach(turn => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';

            const formatTime = (isoString) => isoString ? new Date(isoString).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : 'N/A';

            let logsHtml = '<ul>';
            if (turn.logs_turnos && turn.logs_turnos.length > 0) {
                turn.logs_turnos.sort((a, b) => new Date(a.hora_accion) - new Date(b.hora_accion));
                turn.logs_turnos.forEach(log => {
                    logsHtml += `<li>${log.accion} @ ${new Date(log.hora_accion).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</li>`;
                });
            } else {
                logsHtml += '<li>Sin logs</li>';
            }
            logsHtml += '</ul>';

            tr.innerHTML = `
                <td class="px-4 py-2">${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}</td>
                <td class="px-4 py-2">${turn.servicios ? turn.servicios.nombre_servicio : 'N/A'}</td>
                <td class="px-4 py-2">${turn.estado}</td>
                <td class="px-4 py-2">${turn.modulos ? turn.modulos.nombre_modulo : 'N/A'}</td>
                <td class="px-4 py-2">${formatTime(turn.hora_solicitud)}</td>
                <td class="px-4 py-2">${formatTime(turn.hora_llamado)}</td>
                <td class="px-4 py-2">${formatTime(turn.hora_finalizacion)}</td>
                <td class="px-4 py-2 text-sm">${logsHtml}</td>
            `;
            turnHistoryTableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar historial de turnos:", error.message);
        turnHistoryTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-red-400 py-4">Error al cargar historial.</td></tr>`;
    }
}

filterHistoryBtn.addEventListener('click', loadTurnHistory);

resetTurnsBtn.addEventListener('click', async () => {
    const confirmed = await showConfirmationModal(
        'Confirmar Reseteo de Turnos',
        '¿Está ABSOLUTAMENTE seguro de que desea resetear la numeración de TODOS los turnos para el día? Esta acción no se puede deshacer y afectará a todos los servicios.'
    );
    if (!confirmed) return;

    try {
        const { error } = await supabase.from('turnos').delete().neq('id_turno', 0);
        if (error) throw error;

        await showConfirmationModal('Éxito', 'Numeración de turnos reseteada exitosamente para el día.');
        loadDashboardSummary();
        loadRealtimeModulesStatus();
    } catch (error) {
        console.error("Error al resetear turnos:", error.message);
        await showConfirmationModal('Error', `Error al resetear turnos: ${error.message}`);
    }
});

function setupRealtimeSubscriptions() {
    // Suscribirse a cambios en la tabla 'turnos'
    const turnosChannel = supabase.channel('admin_turnos_channel');
    turnosChannel
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'turnos' },
            async payload => {
                console.log('Cambio en turnos recibido en admin dashboard!', payload);
                loadDashboardSummary();
                loadRealtimeModulesStatus();
                // Solo recargar el historial si la vista está activa
                if (!document.getElementById('turn-history-view').classList.contains('hidden')) {
                    loadTurnHistory();
                }
            }
        )
        .subscribe();

    // Suscribirse a cambios en la tabla 'modulos'
    const modulosChannel = supabase.channel('admin_modulos_channel');
    modulosChannel
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'modulos' },
            async payload => {
                console.log('Cambio en modulos recibido en admin dashboard!', payload);
                loadDashboardSummary();
                loadRealtimeModulesStatus();
                // Solo recargar si la vista está activa
                if (!document.getElementById('manage-modules-view').classList.contains('hidden')) {
                    loadModules();
                }
                if (!document.getElementById('configure-services-view').classList.contains('hidden')) {
                    loadServicesConfig();
                }
                if (!document.getElementById('manage-users-view').classList.contains('hidden')) {
                    loadModulesForUserAssignment();
                }
            }
        )
        .subscribe();

    // Suscribirse a cambios en la tabla 'usuarios'
    const usuariosChannel = supabase.channel('admin_usuarios_channel');
    usuariosChannel
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'usuarios' },
            async payload => {
                console.log('Cambio en usuarios recibido en admin dashboard!', payload);
                // Solo recargar si la vista está activa
                if (!document.getElementById('manage-users-view').classList.contains('hidden')) {
                    loadUsers();
                }
                loadRealtimeModulesStatus(); // Esto siempre debe actualizarse
            }
        )
        .subscribe();

    // Suscribirse a cambios en la tabla 'modulos_servicios'
    const modulosServiciosChannel = supabase.channel('admin_modulos_servicios_channel');
    modulosServiciosChannel
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'modulos_servicios' },
            async payload => {
                console.log('Cambio en modulos_servicios recibido en admin dashboard!', payload);
                // Solo recargar si la vista está activa
                if (!document.getElementById('configure-services-view').classList.contains('hidden')) {
                    loadServicesConfig();
                }
            }
        )
        .subscribe();

    console.log("Suscripciones Realtime configuradas para el Panel de Administración.");
}

window.onload = () => {
    showView('dashboard'); // Carga la vista de Dashboard por defecto
    // Retrasar la configuración de las suscripciones en tiempo real
    setTimeout(setupRealtimeSubscriptions, 500); // Retraso de 500ms
};
