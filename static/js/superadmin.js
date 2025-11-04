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
}

document.addEventListener('DOMContentLoaded', init);