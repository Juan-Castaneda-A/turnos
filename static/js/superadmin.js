// static/js/superadmin.js

// 1. IMPORTAR SUPABASE (Lo necesitaremos más adelante)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);

// 2. REFERENCIAS AL DOM
const navLinks = document.querySelectorAll('nav .nav-link');
const contentSections = document.querySelectorAll('.view-section');
const orgsTableBody = document.getElementById('orgs-table-body');
const addOrgBtn = document.getElementById('add-org-btn');

const orgModal = document.getElementById('org-modal');
const orgModalTitle = document.getElementById('org-modal-title');
const orgForm = document.getElementById('org-form');
const orgIdField = document.getElementById('org-id-field');
const orgNameField = document.getElementById('org-name-field');
const orgSubdomainField = document.getElementById('org-subdomain-field');
const orgSubdomainLocalField = document.getElementById('org-subdomain-local-field');
const orgLogoField = document.getElementById('org-logo-field');
const orgColorField = document.getElementById('org-color-field');
const orgStatusContainer = document.getElementById('org-status-container');
const orgStatusField = document.getElementById('org-status-field');
const orgModalCancelBtn = document.getElementById('org-modal-cancel-btn');
const orgModalSaveBtn = document.getElementById('org-modal-save-btn');

const adminsTableBody = document.getElementById('admins-table-body');
const addAdminBtn = document.getElementById('add-admin-btn');
const adminModal = document.getElementById('admin-modal');
const adminModalTitle = document.getElementById('admin-modal-title');
const adminForm = document.getElementById('admin-form');
const adminIdField = document.getElementById('admin-id-field');
const adminOrgSelect = document.getElementById('admin-org-select');
const adminNameField = document.getElementById('admin-name-field');
const adminUsernameField = document.getElementById('admin-username-field');
const adminPasswordField = document.getElementById('admin-password-field');
const adminModalCancelBtn = document.getElementById('admin-modal-cancel-btn');
const adminModalSaveBtn = document.getElementById('admin-modal-save-btn');

// 3. LÓGICA DE NAVEGACIÓN
function showView(viewId) {
    contentSections.forEach(section => section.classList.add('hidden'));
    document.getElementById(viewId + '-view').classList.remove('hidden');
    navLinks.forEach(link => link.classList.remove('active'));
    document.querySelector(`.nav-link[data-view="${viewId}"]`).classList.add('active');

    // Cargar datos cuando se muestra la vista
    if (viewId === 'manage-orgs') {
        loadOrganizations();
    }

    if (viewId === 'manage-admins') {
        loadAdmins();
    }
}

/**
 * Abre el modal en modo "Crear".
 * Limpia el formulario y lo muestra.
 */
function openCreateModal() {
    orgForm.reset(); // Limpia todos los campos
    orgIdField.value = ''; // Asegura que el ID esté vacío
    orgModalTitle.textContent = 'Crear Nueva Organización';
    orgStatusContainer.classList.add('hidden'); // Oculta el campo "Estado"
    orgModal.classList.remove('hidden');
    orgNameField.focus(); // Pone el cursor en el primer campo
}

/**
 * Abre el modal en modo "Editar".
 * Rellena el formulario con los datos de la organización.
 */
function openEditModal(org) {
    orgForm.reset();
    orgModalTitle.textContent = `Editar Organización: ${org.nombre_organizacion}`;
    
    // Rellenamos los campos
    orgIdField.value = org.id_organizacion;
    orgNameField.value = org.nombre_organizacion;
    orgSubdomainField.value = org.subdominio || '';
    orgSubdomainLocalField.value = org.subdominio_local || '';
    orgStatusField.value = org.estado;

    // Rellenamos los campos de 'configuracion' (branding)
    if (org.configuracion && org.configuracion.branding) {
        orgLogoField.value = org.configuracion.branding.logo_url || '';
        orgColorField.value = org.configuracion.branding.color_primario || '#1e40af';
    } else {
        orgLogoField.value = '';
        orgColorField.value = '#1e40af'; // Color por defecto
    }

    orgStatusContainer.classList.remove('hidden'); // Muestra el campo "Estado"
    orgModal.classList.remove('hidden');
}

/**
 * Cierra el modal.
 */
function closeModal() {
    orgModal.classList.add('hidden');
}

/**
 * Maneja el envío del formulario (Crear o Editar).
 */
async function handleSaveOrganization(event) {
    event.preventDefault(); // Evita que la página se recargue
    orgModalSaveBtn.disabled = true;
    orgModalSaveBtn.textContent = 'Guardando...';

    // 1. Recolectar los datos del formulario
    const orgId = orgIdField.value;
    const data = {
        nombre_organizacion: orgNameField.value,
        subdominio: orgSubdomainField.value,
        subdominio_local: orgSubdomainLocalField.value,
        logo_url: orgLogoField.value,
        color_primario: orgColorField.value,
        estado: orgStatusField.value
    };

    // 2. Determinar la URL y el Método (Crear vs Editar)
    let url = '/api/superadmin/create-organization';
    let method = 'POST';

    if (orgId) {
        // Es una edición
        url = `/api/superadmin/update-organization/${orgId}`;
        method = 'PUT';
    }

    // 3. Llamar a la API
    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        // 4. ¡Éxito!
        closeModal();
        alert(`¡Éxito! ${result.message || 'Organización guardada.'}`);
        loadOrganizations(); // Recargamos la tabla

    } catch (error) {
        console.error("Error al guardar organización:", error.message);
        alert(`Error: ${error.message}`);
    } finally {
        orgModalSaveBtn.disabled = false;
        orgModalSaveBtn.textContent = 'Guardar Organización';
    }
}

// ==========================================================
// GESTIÓN DE ADMINISTRADORES
// ==========================================================

/**
 * Carga la lista de todos los administradores.
 */
async function loadAdmins() {
    adminsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">Cargando administradores...</td></tr>`;

    try {
        const response = await fetch('/api/superadmin/get-admins');
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        const users = result.users;
        adminsTableBody.innerHTML = '';
        
        if (users.length === 0) {
            adminsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay administradores creados.</td></tr>`;
            return;
        }

        users.forEach(user => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            const rolClass = user.rol === 'superadmin' ? 'text-yellow-400' : 'text-blue-400';
            
            tr.innerHTML = `
                <td class="px-4 py-2">${user.nombre_completo}</td>
                <td class="px-4 py-2">${user.nombre_usuario}</td>
                <td class="px-4 py-2">${user.organizacion?.nombre_organizacion || 'N/A'}</td>
                <td class="px-4 py-2 font-semibold ${rolClass}">${user.rol}</td>
                <td class="px-4 py-2">
                    <button class="form-button btn-primary text-sm px-3 py-1" disabled>Editar</button>
                </td>
            `;
            adminsTableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar administradores:", error.message);
        adminsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-400 py-4">Error al cargar datos.</td></tr>`;
    }
}

/**
 * Abre el modal para crear un nuevo admin.
 * Carga la lista de organizaciones en el dropdown.
 */
async function openCreateAdminModal() {
    adminForm.reset();
    adminIdField.value = '';
    adminModalTitle.textContent = 'Crear Nuevo Administrador';
    adminPasswordField.placeholder = "Contraseña (requerida)";
    adminPasswordField.required = true; // Hacemos la contraseña requerida al crear
    adminModal.classList.remove('hidden');
    adminOrgSelect.innerHTML = '<option value="">Cargando organizaciones...</option>';
    adminOrgSelect.disabled = true;

    // Cargar las organizaciones en el dropdown
    try {
        const response = await fetch('/api/superadmin/get-organizations');
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error);

        adminOrgSelect.innerHTML = '<option value="">-- Seleccione una organización --</option>';
        result.organizations.forEach(org => {
            const option = document.createElement('option');
            option.value = org.id_organizacion;
            option.textContent = org.nombre_organizacion;
            adminOrgSelect.appendChild(option);
        });
        adminOrgSelect.disabled = false;
    } catch (error) {
        console.error("Error al cargar organizaciones para el dropdown:", error.message);
        adminOrgSelect.innerHTML = '<option value="">Error al cargar</option>';
    }
}

function closeAdminModal() {
    adminModal.classList.add('hidden');
}

/**
 * Maneja el guardado de un nuevo admin.
 */
async function handleSaveAdmin(event) {
    event.preventDefault();
    adminModalSaveBtn.disabled = true;
    adminModalSaveBtn.textContent = 'Guardando...';

    const data = {
        nombre_completo: adminNameField.value,
        nombre_usuario: adminUsernameField.value,
        password: adminPasswordField.value,
        id_organizacion: adminOrgSelect.value
    };

    // (Aquí iría la lógica de 'PUT' para editar, pero por ahora solo 'POST')
    
    try {
        const response = await fetch('/api/superadmin/create-admin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        closeAdminModal();
        alert(`¡Éxito! Administrador "${result.user.nombre_completo}" creado.`);
        loadAdmins(); // Recargamos la tabla

    } catch (error) {
        console.error("Error al guardar admin:", error.message);
        alert(`Error: ${error.message}`);
    } finally {
        adminModalSaveBtn.disabled = false;
        adminModalSaveBtn.textContent = 'Guardar Administrador';
    }
}

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        showView(e.currentTarget.dataset.view);
    });
});

// 4. LÓGICA DE LA API (¡La nueva!)
async function loadOrganizations() {
    orgsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">Cargando organizaciones...</td></tr>`;

    try {
        const response = await fetch('/api/superadmin/get-organizations');
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        const orgs = result.organizations;
        orgsTableBody.innerHTML = '';
        
        if (orgs.length === 0) {
            orgsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-gray-500 py-4">No hay organizaciones creadas.</td></tr>`;
            return;
        }

        orgs.forEach(org => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            const statusClass = org.estado === 'activo' ? 'text-green-400' : 'text-red-400';
            
            tr.innerHTML = `
                <td class="px-4 py-2">${org.nombre_organizacion}</td>
                <td class="px-4 py-2">${org.subdominio || 'N/A'}</td>
                <td class="px-4 py-2">${org.subdominio_local || 'N/A'}</td>
                <td class="px-4 py-2 font-semibold ${statusClass}">${org.estado}</td>
                <td class="px-4 py-2">
                    <button class="form-button btn-primary text-sm px-3 py-1 edit-org-btn" data-org-id="${org.id_organizacion}">
                        Editar
                    </button>
                </td>
            `;
            
            // --- ¡AQUÍ ESTÁ LA MAGIA! ---
            // Añadimos el listener al botón de "Editar" que acabamos de crear
            tr.querySelector('.edit-org-btn').addEventListener('click', () => {
                // Buscamos la organización completa en la lista que ya cargamos
                const orgData = orgs.find(o => o.id_organizacion === org.id_organizacion);
                openEditModal(orgData);
            });
            // --- FIN ---

            orgsTableBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar organizaciones:", error.message);
        orgsTableBody.innerHTML = `<tr><td colspan="5" class="text-center text-red-400 py-4">Error al cargar datos.</td></tr>`;
    }
}

// 5. INICIALIZACIÓN
function init() {
    console.log("Superadmin Panel Inicializado.");
    showView('dashboard'); // Mostrar la primera vista por defecto

    addOrgBtn.addEventListener('click', openCreateModal);
    orgModalCancelBtn.addEventListener('click', closeModal);
    orgForm.addEventListener('submit', handleSaveOrganization);

    addAdminBtn.addEventListener('click', openCreateAdminModal);
    adminModalCancelBtn.addEventListener('click', closeAdminModal);
    adminForm.addEventListener('submit', handleSaveAdmin);
}

document.addEventListener('DOMContentLoaded', init);