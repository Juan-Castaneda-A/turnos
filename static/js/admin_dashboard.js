// Importar el cliente de Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';

// 1. DECLARAMOS las variables aquí, pero NO las asignamos todavía.
let supabase;
let navLinks, contentSections, turnsWaitingElement, turnsAttendedTodayElement, activeModulesElement,
    realtimeModulesStatusBody, addUserBtn, userFormContainer, userFormTitle, userForm,
    userIdField, fullNameField, usernameField, passwordField, roleField, assignedModuleField,
    cancelUserFormBtn, usersTableBody, addModuleBtn, moduleFormContainer, moduleFormTitle,
    moduleForm, moduleIdField, moduleNameField, moduleDescriptionField, moduleStatusField,
    moduleStatusText, cancelModuleFormBtn, modulesTableBody, servicesConfigHeader,
    servicesConfigBody, saveServicesConfigBtn, priorityModuleSelect, priorityListContainer,
    prioritySortableList, savePrioritiesBtn, btnFilterToday, btnFilterWeek, btnFilterMonth,
    btnFilterAll, reportStartDate, reportEndDate, reportTableBody, chartCanvas,
    generateReportBtn, historyStartDate, historyEndDate, historyServiceFilter,
    filterHistoryBtn, turnHistoryTableBody, resetTurnsBtn, confirmationModal, modalTitle,
    modalMessage, modalConfirmBtn, modalCancelBtn, moduleFilter;

let reportChart = null;
let isSavingConfig = false;
let allModules = [];
let allServices = [];
let currentModuleServiceConfig = {};
let adminSilenceAlertBtn;
let clientsTableBody;
let clientPaginationControls, prevClientPage, clientPageInfo, nextClientPage; // <-- Añade esta línea
let clientSearchInput; // <-- AÑADE ESTA LÍNEA
let currentClientSearch = '';
let servicesTableBody, addServiceBtn, serviceFormContainer, serviceFormTitle, serviceForm, serviceIdField, serviceNameField, servicePrefixField, cancelServiceFormBtn;
let messagesTableBody, addMessageBtn, messageFormContainer, messageFormTitle, messageForm, messageIdField, messageTextField, messageActiveField, messageActiveText, cancelMessageFormBtn;
let currentPage = 1; // <-- Añade esta línea
const rowsPerPage = 25;
let currentReportData = []; // <-- AÑADE ESTA LÍNEA para guardar los datos del último reporte
let exportMenuBtn, exportOptions, exportXLSXBtn, exportCSVBtn, copyDataBtn;
let exportPDFBtn;
let reportInsightsContainer, reportInsightsList;

function init() {
    // Inicializar Supabase
    supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    console.log("Supabase Client inicializado para Panel de Administración.");
    console.log("Objeto Supabase:", supabase);
    console.log("¿Existe supabase.from?", typeof supabase.from);

    // Referencias al DOM
    navLinks = document.querySelectorAll('nav .nav-link');
    contentSections = document.querySelectorAll('.view-section');
    turnsWaitingElement = document.getElementById('turns-waiting');
    turnsAttendedTodayElement = document.getElementById('turns-attended-today');
    activeModulesElement = document.getElementById('active-modules');
    realtimeModulesStatusBody = document.getElementById('realtime-modules-status-body');
    addUserBtn = document.getElementById('add-user-btn');
    userFormContainer = document.getElementById('user-form-container');
    userFormTitle = document.getElementById('user-form-title');
    userForm = document.getElementById('user-form');
    userIdField = document.getElementById('user-id-field');
    fullNameField = document.getElementById('full-name-field');
    usernameField = document.getElementById('username-field');
    passwordField = document.getElementById('password-field');
    roleField = document.getElementById('role-field');
    assignedModuleField = document.getElementById('assigned-module-field');
    cancelUserFormBtn = document.getElementById('cancel-user-form-btn');
    usersTableBody = document.getElementById('users-table-body');
    addModuleBtn = document.getElementById('add-module-btn');
    moduleFormContainer = document.getElementById('module-form-container');
    moduleFormTitle = document.getElementById('module-form-title');
    moduleForm = document.getElementById('module-form');
    moduleIdField = document.getElementById('module-id-field');
    moduleNameField = document.getElementById('module-name-field');
    moduleDescriptionField = document.getElementById('module-description-field');
    moduleStatusField = document.getElementById('module-status-field');
    moduleStatusText = document.getElementById('module-status-text');
    cancelModuleFormBtn = document.getElementById('cancel-module-form-btn');
    modulesTableBody = document.getElementById('modules-table-body');
    servicesConfigHeader = document.getElementById('services-config-header');
    servicesConfigBody = document.getElementById('services-config-body');
    saveServicesConfigBtn = document.getElementById('save-services-config-btn');
    priorityModuleSelect = document.getElementById('priority-module-select');
    priorityListContainer = document.getElementById('priority-list-container');
    prioritySortableList = document.getElementById('priority-sortable-list');
    savePrioritiesBtn = document.getElementById('save-priorities-btn');
    btnFilterToday = document.getElementById('filter-today');
    btnFilterWeek = document.getElementById('filter-week');
    btnFilterMonth = document.getElementById('filter-month');
    btnFilterAll = document.getElementById('filter-all');
    reportStartDate = document.getElementById('report-start-date');
    reportEndDate = document.getElementById('report-end-date');
    reportTableBody = document.getElementById('report-table-body');
    chartCanvas = document.getElementById('turns-by-employee-chart');
    generateReportBtn = document.getElementById('generate-report-btn');
    historyStartDate = document.getElementById('history-start-date');
    historyEndDate = document.getElementById('history-end-date');
    historyServiceFilter = document.getElementById('history-service-filter');
    filterHistoryBtn = document.getElementById('filter-history-btn');
    turnHistoryTableBody = document.getElementById('turn-history-table-body');
    resetTurnsBtn = document.getElementById('reset-turns-btn');
    confirmationModal = document.getElementById('confirmation-modal');
    modalTitle = document.getElementById('modal-title');
    modalMessage = document.getElementById('modal-message');
    modalConfirmBtn = document.getElementById('modal-confirm-btn');
    modalCancelBtn = document.getElementById('modal-cancel-btn');
    adminSilenceAlertBtn = document.getElementById('admin-silence-alert-btn');
    clientsTableBody = document.getElementById('clients-table-body');
    clientPaginationControls = document.getElementById('client-pagination-controls');
    prevClientPage = document.getElementById('prev-client-page');
    clientPageInfo = document.getElementById('client-page-info');
    nextClientPage = document.getElementById('next-client-page');
    clientSearchInput = document.getElementById('client-search-input');
    exportMenuBtn = document.getElementById('export-menu-btn');
    exportOptions = document.getElementById('export-options');
    exportXLSXBtn = document.getElementById('export-xlsx-btn');
    exportCSVBtn = document.getElementById('export-csv-btn');
    copyDataBtn = document.getElementById('copy-data-btn');
    exportPDFBtn = document.getElementById('export-pdf-btn');
    reportInsightsContainer = document.getElementById('report-insights-container'); // <-- AÑADE ESTA LÍNEA
    reportInsightsList = document.getElementById('report-insights-list');
    servicesTableBody = document.getElementById('services-table-body');
    addServiceBtn = document.getElementById('add-service-btn');
    serviceFormContainer = document.getElementById('service-form-container');
    serviceFormTitle = document.getElementById('service-form-title');
    serviceForm = document.getElementById('service-form');
    serviceIdField = document.getElementById('service-id-field');
    serviceNameField = document.getElementById('service-name-field');
    servicePrefixField = document.getElementById('service-prefix-field');
    cancelServiceFormBtn = document.getElementById('cancel-service-form-btn');
    messagesTableBody = document.getElementById('messages-table-body');
    addMessageBtn = document.getElementById('add-message-btn');
    messageFormContainer = document.getElementById('message-form-container');
    messageFormTitle = document.getElementById('message-form-title');
    messageForm = document.getElementById('message-form');
    messageIdField = document.getElementById('message-id-field');
    messageTextField = document.getElementById('message-text-field');
    messageActiveField = document.getElementById('message-active-field');
    messageActiveText = document.getElementById('message-active-text');
    cancelMessageFormBtn = document.getElementById('cancel-message-form-btn');

    const moduleFilterElement = document.getElementById('module-filter');
    if (moduleFilterElement) {
        moduleFilter = moduleFilterElement;
    }

    // 4. Asignamos todos los Event Listeners aquí.
    assignEventListeners();

    // 5. Cargamos la vista inicial y los datos.
    showView('dashboard');
    setupRealtimeSubscriptions();
    loadReportFilters();

}

const formatInterval = (intervalStr) => {
    if (!intervalStr || typeof intervalStr !== 'string') return 'N/A';
    const parts = intervalStr.split(':');
    if (parts.length < 3) return 'N/A';
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = Math.round(parseFloat(parts[2]));
    const totalMinutes = hours * 60 + minutes;
    return `${totalMinutes}m ${seconds}s`;
};

// ==========================================================
// SECCIÓN DE EVENT LISTENERS
// ==========================================================

function assignEventListeners() {
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showView(e.currentTarget.dataset.view);
        });
    });

    adminSilenceAlertBtn.addEventListener('click', () => {
        // Usamos el mismo nombre de canal que el panel del funcionario
        const turnosChannel = supabase.channel('turnos_channel');

        turnosChannel.send({
            type: 'broadcast',
            event: 'silence_alert',
            payload: { message: 'Por favor, guardar silencio' }
        });

        console.log("Alerta de silencio enviada desde el panel de admin.");

        // Opcional: Mostrar una pequeña confirmación visual al admin
        adminSilenceAlertBtn.textContent = '¡Enviado!';
        setTimeout(() => {
            // Reconstruimos el contenido original del botón después de 1.5 segundos
            adminSilenceAlertBtn.innerHTML = `
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l-2.25 2.25M19.5 12l2.25-2.25M12 3c-3.866 0-7 1.79-7 4s3.134 4 7 4 7-1.79 7-4-3.134-4-7-4zM5 9v10.5A2.5 2.5 0 007.5 22h9a2.5 2.5 0 002.5-2.5V9" />
            </svg>
            Pedir Silencio
        `;
        }, 1500);
    });

    // Listener para el botón de generar reporte
    generateReportBtn.addEventListener('click', generateReport);

    // Listeners para los filtros rápidos de fecha
    btnFilterToday.addEventListener('click', () => {
        reportStartDate.value = formatDateToISO(new Date());
        reportEndDate.value = reportStartDate.value;
        generateReportBtn.click();
    });

    btnFilterWeek.addEventListener('click', () => {
        const today = new Date();
        const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
        reportStartDate.value = formatDateToISO(firstDayOfWeek);
        reportEndDate.value = formatDateToISO(lastDayOfWeek);
        generateReportBtn.click();
    });

    btnFilterMonth.addEventListener('click', () => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        reportStartDate.value = formatDateToISO(firstDayOfMonth);
        reportEndDate.value = formatDateToISO(lastDayOfMonth);
        generateReportBtn.click();
    });

    btnFilterAll.addEventListener('click', () => {
        reportStartDate.value = '2020-01-01';
        reportEndDate.value = formatDateToISO(new Date());
        generateReportBtn.click();
    });

    prevClientPage.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadClients();
        }
    });

    nextClientPage.addEventListener('click', () => {
        // La lógica para deshabilitar el botón se hará en otra función,
        // aquí solo necesitamos que avance.
        currentPage++;
        loadClients();
    });

    clientSearchInput.addEventListener('input', () => {
        // Guardamos el término de búsqueda actual
        currentClientSearch = clientSearchInput.value.trim();
        // ¡MUY IMPORTANTE! Reseteamos a la página 1 para cada nueva búsqueda
        currentPage = 1;
        // Llamamos a la función para recargar los clientes con el nuevo filtro
        loadClients();
    });

    exportMenuBtn.addEventListener('click', () => {
        exportOptions.classList.toggle('hidden');
    });
    // Cierra el menú si se hace clic en cualquier otro lugar
    document.addEventListener('click', (event) => {
        if (!exportMenuBtn.contains(event.target) && !exportOptions.contains(event.target)) {
            exportOptions.classList.add('hidden');
        }
    });
    exportXLSXBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Evita que el enlace '#' navegue
        exportToXLSX();
        exportOptions.classList.add('hidden'); // Ocultar menú después de la acción
    });

    exportCSVBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportToCSV();
        exportOptions.classList.add('hidden');
    });

    copyDataBtn.addEventListener('click', (e) => {
        e.preventDefault();
        copyToClipboard();
        exportOptions.classList.add('hidden');
    });

    exportPDFBtn.addEventListener('click', (e) => {
        e.preventDefault();
        exportToPDF();
        exportOptions.classList.add('hidden');
    });

    addServiceBtn.addEventListener('click', () => {
        serviceForm.reset();
        serviceIdField.value = '';
        serviceFormTitle.textContent = 'Crear Nuevo Servicio';
        serviceFormContainer.classList.remove('hidden');
    });

    cancelServiceFormBtn.addEventListener('click', () => {
        serviceFormContainer.classList.add('hidden');
    });

    serviceForm.addEventListener('submit', handleSaveService);

    addMessageBtn.addEventListener('click', () => {
        messageForm.reset();
        messageIdField.value = '';
        messageActiveField.checked = true; // Por defecto activo
        messageActiveText.textContent = 'Activo';
        messageFormTitle.textContent = 'Crear Nuevo Mensaje';
        messageFormContainer.classList.remove('hidden');
    });

    cancelMessageFormBtn.addEventListener('click', () => {
        messageFormContainer.classList.add('hidden');
    });

    // Listener para el texto del toggle switch
    messageActiveField.addEventListener('change', () => {
        messageActiveText.textContent = messageActiveField.checked ? 'Activo' : 'Inactivo';
    });

    messageForm.addEventListener('submit', handleSaveMessage);

    // ... (Aquí irían todos los demás event listeners: addUserBtn, savePrioritiesBtn, etc.)
    // Por simplicidad, los dejo dentro de sus funciones de carga por ahora,
    // pero idealmente también se centralizarían aquí.
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
        const moduleData = {
            nombre_modulo: moduleNameField.value,
            descripcion: moduleDescriptionField.value,
            estado: moduleStatusField.checked ? 'activo' : 'inactivo'
        };

        if (id) {
            moduleData.id_modulo = id;
        }

        const actionText = id ? 'Editar Módulo' : 'Crear Módulo';
        const confirmed = await showConfirmationModal(actionText, `¿Está seguro de que desea guardar este módulo?`);
        if (!confirmed) return;

        try {
            const response = await fetch('/api/save-module', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(moduleData),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error);
            }

            await showConfirmationModal('Éxito', result.message);
            moduleFormContainer.classList.add('hidden');
            loadModules();

        } catch (error) {
            console.error("Error al guardar módulo:", error.message);
            await showConfirmationModal('Error', `Error al guardar módulo: ${error.message}`);
        }
    });
    saveServicesConfigBtn.addEventListener('click', async () => {
        const confirmed = await showConfirmationModal('Guardar Configuración de Servicios', '¿Está seguro de que desea guardar los cambios en la asignación de servicios?');
        if (!confirmed) return;

        isSavingConfig = true;

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
        } finally {
            isSavingConfig = false;
        }
    });

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

    btnFilterToday.addEventListener('click', () => {
        const today = formatDateToISO(new Date());
        reportStartDate.value = today;
        reportEndDate.value = today;
        generateReportBtn.click();
    });

    btnFilterWeek.addEventListener('click', () => {
        const today = new Date();
        const firstDayOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
        const lastDayOfWeek = new Date(firstDayOfWeek);
        lastDayOfWeek.setDate(lastDayOfWeek.getDate() + 6);
        reportStartDate.value = formatDateToISO(firstDayOfWeek);
        reportEndDate.value = formatDateToISO(lastDayOfWeek);
        generateReportBtn.click();
    });

    btnFilterMonth.addEventListener('click', () => {
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        reportStartDate.value = formatDateToISO(firstDayOfMonth);
        reportEndDate.value = formatDateToISO(lastDayOfMonth);
        generateReportBtn.click();
    });


    btnFilterAll.addEventListener('click', () => {
        reportStartDate.value = '2020-01-01';
        reportEndDate.value = formatDateToISO(new Date());
        generateReportBtn.click();
    });

    generateReportBtn.addEventListener('click', async () => {
        // CORRECCIÓN: Usamos los nombres de variable correctos 'reportStartDate' y 'reportEndDate'
        const start = reportStartDate.value;
        const end = reportEndDate.value;
        const employeeId = document.getElementById('employee-filter').value;
        const moduleId = document.getElementById('module-filter').value;

        const groupBy = document.querySelector('input[name="group-by"]:checked').value;

        if (!start || !end) {
            alert('Por favor, seleccione un rango de fechas.');
            return;
        }

        try {
            let apiUrl = `/api/reports?start=${start}&end=${end}&group_by=${groupBy}`;
            if (employeeId) apiUrl += `&user_id=${employeeId}`;
            if (moduleId) apiUrl += `&module_id=${moduleId}`;

            const response = await fetch(apiUrl, { credentials: 'include' });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Error del servidor: ${response.status}`);
            }

            const data = await response.json();

            // Limpiar la tabla y las tarjetas de KPIs
            reportTableBody.innerHTML = '';
            document.getElementById('kpi-total-turns').textContent = '--';
            document.getElementById('kpi-avg-wait').textContent = '--';
            document.getElementById('kpi-avg-service').textContent = '--';
            if (reportChart) reportChart.destroy();

            if (data.length === 0) {
                reportTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No se encontraron datos.</td></tr>`;
                return;
            }

            const formatInterval = (intervalStr) => {
                if (!intervalStr) return 'N/A';
                const parts = intervalStr.split(':');
                const minutes = parseInt(parts[1], 10);
                const seconds = Math.round(parseFloat(parts[2]));
                return `${minutes}m ${seconds}s`;
            };

            // Calculamos los KPIs
            const totalTurns = data.reduce((sum, row) => sum + row.turnos_atendidos, 0);
            document.getElementById('kpi-total-turns').textContent = totalTurns;
            // (Estos promedios son aproximados, para un promedio ponderado real necesitaríamos otra consulta)
            document.getElementById('kpi-avg-wait').textContent = formatInterval(data[0].tiempo_espera_promedio);
            document.getElementById('kpi-avg-service').textContent = formatInterval(data[0].tiempo_atencion_promedio);

            // Actualizamos la tabla dinámicamente
            const tableHeader = document.getElementById('table-header-group');
            tableHeader.textContent = groupBy.charAt(0).toUpperCase() + groupBy.slice(1);

            data.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                <td class="p-3">${row.group_name}</td>
                <td class="p-3 text-center">${row.turnos_atendidos}</td>
                <td class="p-3">${formatInterval(row.tiempo_espera_promedio)}</td>
                <td class="p-3">${formatInterval(row.tiempo_atencion_promedio)}</td>
            `;
                reportTableBody.appendChild(tr);
            });

            // Hacemos el gráfico inteligente
            document.getElementById('chart-title').textContent = `Turnos por ${groupBy}`;
            const chartType = groupBy === 'servicio' ? 'doughnut' : 'bar';
            const labels = data.map(row => row.group_name);
            const chartData = data.map(row => row.turnos_atendidos);

            reportChart = new Chart(chartCanvas, {
                type: chartType,
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Turnos Atendidos',
                        data: chartData,
                        backgroundColor: chartType === 'bar' ? 'rgba(59, 130, 246, 0.5)' : [
                            'rgba(59, 130, 246, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(245, 158, 11, 0.7)',
                            'rgba(16, 185, 129, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(236, 72, 153, 0.7)'
                        ],
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1
                    }]
                },
                options: chartType === 'bar' ? { scales: { y: { beginAtZero: true } } } : {}
            });

        } catch (error) {
            console.error("Error al generar el reporte:", error);
            reportTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-400">Error: ${error.message}</td></tr>`;
            if (reportChart) reportChart.destroy();
        }
    });

    priorityModuleSelect.addEventListener('change', async () => {
        const moduleId = priorityModuleSelect.value;
        if (!moduleId) {
            priorityListContainer.classList.add('hidden');
            return;
        }

        priorityListContainer.classList.remove('hidden');
        prioritySortableList.innerHTML = `<p class="text-gray-400">Cargando servicios para este módulo...</p>`;

        try {
            // Buscamos los servicios asignados a este módulo, ordenados por su prioridad actual
            const { data: services, error } = await supabase
                .from('modulos_servicios')
                .select(`
                prioridad,
                servicios (id_servicio, nombre_servicio)
            `)
                .eq('id_modulo', moduleId)
                .order('prioridad', { ascending: true });

            if (error) throw error;

            prioritySortableList.innerHTML = '';
            if (services.length === 0) {
                prioritySortableList.innerHTML = `<p class="text-gray-400">Este módulo no tiene servicios asignados. Vaya a "Configurar Servicios" para asignarlos.</p>`;
                return;
            }

            // Creamos los elementos HTML para cada servicio
            services.forEach(item => {
                const service = item.servicios;
                const listItem = document.createElement('div');
                listItem.className = 'priority-item';
                listItem.dataset.serviceId = service.id_servicio; // Guardamos el ID del servicio

                listItem.innerHTML = `
                <svg class="handle w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" /></svg>
                <span>${service.nombre_servicio}</span>
            `;
                prioritySortableList.appendChild(listItem);
            });

            // ¡Magia! Activamos la funcionalidad de arrastrar y soltar en la lista
            new Sortable(prioritySortableList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                handle: '.handle'
            });

        } catch (error) {
            console.error("Error cargando la lista de prioridades:", error);
            prioritySortableList.innerHTML = `<p class="text-red-400">Error al cargar los servicios de este módulo.</p>`;
        }
    });

    // Se activa al hacer clic en el botón "Guardar Prioridades"
    savePrioritiesBtn.addEventListener('click', async () => {
        const moduleId = priorityModuleSelect.value;
        if (!moduleId) return;

        const confirmed = await showConfirmationModal('Guardar Prioridades', `¿Está seguro de que desea guardar el nuevo orden de prioridad para este módulo?`);
        if (!confirmed) return;

        // Obtenemos todos los elementos de la lista en su nuevo orden
        const listItems = prioritySortableList.querySelectorAll('.priority-item');

        // Creamos un array de objetos para actualizar la base de datos
        const updates = Array.from(listItems).map((item, index) => ({
            id_modulo: parseInt(moduleId),
            id_servicio: parseInt(item.dataset.serviceId),
            prioridad: index + 1 // El índice (0, 1, 2...) se convierte en la prioridad (1, 2, 3...)
        }));

        try {
            // Usamos upsert para actualizar las filas existentes.
            // onConflict le dice a Supabase que la combinación de módulo y servicio es única.
            const { error } = await supabase.from('modulos_servicios').upsert(updates, {
                onConflict: 'id_modulo, id_servicio'
            });

            if (error) throw error;

            await showConfirmationModal('Éxito', 'El orden de prioridad se ha guardado correctamente.');

        } catch (error) {
            console.error('Error al guardar las prioridades:', error);
            await showConfirmationModal('Error', `No se pudo guardar el orden de prioridades: ${error.message}`);
        }
    });
}

// ==========================================================
// SECCIÓN DE FUNCIONES
// ==========================================================

// --- Funciones de Lógica de Vistas y UI ---
function showView(viewId) {
    contentSections.forEach(section => {
        if (section.id !== 'confirmation-modal') {
            section.classList.add('hidden');
        }
    });

    const targetView = document.getElementById(viewId + '-view');
    if (targetView) {
        targetView.classList.remove('hidden');
    }

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
        case 'manage-priorities':
            loadPriorityEditor();
            break;
        case 'manage-clients':
            loadClients();
            break;
        case 'manage-services':
            loadServices();
            break;
        case 'reports':
            // Solo cargar filtros si la vista existe
            if (targetView) {
                loadReportFilters();
            }
            break;
        case 'turn-history':
            loadHistoryServicesFilter();
            loadTurnHistory();
            break;
        case 'notary-settings':
            // Lógica para cargar configuración de notaría (si aplica)
            break;
        case 'manage-messages':
            loadMessages();
            break;
    }
}

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

function formatDateToISO(date) {
    return date.toISOString().split('T')[0];
}

function exportToXLSX() {
    if (currentReportData.length === 0) return;

    // Tu lógica de Excel, ahora dentro de una función
    const timeToExcel = (intervalStr) => {
        if (!intervalStr || intervalStr === 'N/A') return 0;
        const [h, m, s] = intervalStr.split(':').map(Number);
        return (h * 3600 + m * 60 + s) / 86400;
    };
    const groupBy = document.querySelector('input[name="group-by"]:checked')?.value || 'funcionario';
    const groupByLabel = groupBy.charAt(0).toUpperCase() + groupBy.slice(1);
    const today = new Date().toISOString().split('T')[0];

    // Hoja de detalles
    const mainHeaders = [groupByLabel, "Turnos Atendidos", "Tiempo Espera Promedio", "Tiempo Atención Promedio"];
    const mainData = currentReportData.map(row => [
        row.group_name,
        row.turnos_atendidos,
        timeToExcel(row.tiempo_espera_promedio),
        timeToExcel(row.tiempo_atencion_promedio)
    ]);
    const wsMain = XLSX.utils.aoa_to_sheet([mainHeaders, ...mainData]);
    const range = XLSX.utils.decode_range(wsMain['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        ['C', 'D'].forEach(col => {
            const cell = wsMain[col + (R + 1)];
            if (cell) cell.z = 'mm"m "ss"s"';
        });
    }
    // ... (El resto de tu lógica de formato de celdas, negritas y autofiltros) ...
    // Estilo: encabezados en negrita
    const headerCell = wsMain['A1'];
    if (headerCell) headerCell.s = { font: { bold: true } };
    wsMain['B1'].s = { font: { bold: true } };
    wsMain['C1'].s = { font: { bold: true } };
    wsMain['D1'].s = { font: { bold: true } };

    // Agregar filtros automáticos
    wsMain['!autofilter'] = { ref: XLSX.utils.encode_range(range) };

    wsMain['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 25 }, { wch: 25 }];


    // Hoja de resumen
    // ... (Tu lógica para calcular KPIs y crear summaryData) ...
    const totalTurns = currentReportData.reduce((sum, row) => sum + (row.turnos_atendidos || 0), 0);
    let totalWaitSec = 0, totalServiceSec = 0;
    currentReportData.forEach(row => {
        const turns = row.turnos_atendidos || 0;
        if (row.tiempo_espera_promedio) totalWaitSec += intervalToSeconds(row.tiempo_espera_promedio) * turns;
        if (row.tiempo_atencion_promedio) totalServiceSec += intervalToSeconds(row.tiempo_atencion_promedio) * turns;
    });
    const avgWaitSec = totalTurns ? totalWaitSec / totalTurns : 0;
    const avgServiceSec = totalTurns ? totalServiceSec / totalTurns : 0;

    const summaryData = [
        ["Métrica", "Valor"],
        ["Total de Turnos", totalTurns],
        ["Tiempo Espera Promedio", avgWaitSec / 86400],
        ["Tiempo Atención Promedio", avgServiceSec / 86400]
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary['B3'].z = 'mm"m "ss"s"';
    wsSummary['B4'].z = 'mm"m "ss"s"';
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 18 }];


    // Crear libro y descargar
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen");
    XLSX.utils.book_append_sheet(wb, wsMain, "Datos Detallados");
    XLSX.writeFile(wb, `Reporte_Notaria_${groupByLabel}_${today}.xlsx`);
}

function exportToCSV() {
    if (currentReportData.length === 0) return;

    const groupByLabel = document.getElementById('table-header-group').textContent;
    const today = new Date().toISOString().split('T')[0];

    const headers = [groupByLabel, "Turnos Atendidos", "Tiempo Espera Promedio", "Tiempo Atención Promedio"];
    const dataRows = currentReportData.map(row => [
        row.group_name,
        row.turnos_atendidos,
        formatInterval(row.tiempo_espera_promedio), // Para CSV, usamos el formato de texto legible
        formatInterval(row.tiempo_atencion_promedio)
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `Reporte_Notaria_${groupByLabel}_${today}.csv`);
}
function copyToClipboard() {
    if (currentReportData.length === 0) return;

    const groupByLabel = document.getElementById('table-header-group').textContent;
    const headers = [groupByLabel, "Turnos Atendidos", "Tiempo Espera Promedio", "Tiempo Atención Promedio"];
    let clipboardText = headers.join('\t') + '\n';

    currentReportData.forEach(row => {
        const rowValues = [
            row.group_name,
            row.turnos_atendidos,
            formatInterval(row.tiempo_espera_promedio),
            formatInterval(row.tiempo_atencion_promedio)
        ];
        clipboardText += rowValues.join('\t') + '\n';
    });

    navigator.clipboard.writeText(clipboardText).then(() => {
        const originalText = copyDataBtn.textContent;
        copyDataBtn.textContent = '¡Copiado!';
        setTimeout(() => {
            copyDataBtn.textContent = originalText;
        }, 1500);
    }).catch(err => {
        console.error('Error al copiar:', err);
        alert('No se pudo copiar al portapapeles. Intente nuevamente.');
    });
}
const intervalToSeconds = (intervalStr) => {
    if (!intervalStr || typeof intervalStr !== 'string') return 0;
    const parts = intervalStr.split(':');
    if (parts.length < 3) return 0;
    return (parseInt(parts[0], 10) * 3600) + (parseInt(parts[1], 10) * 60) + parseFloat(parts[2]);
};

// ==========================================================
// MOTOR DE INSIGHTS AUTOMÁTICOS
// ==========================================================

/**
 * Analiza los datos de un reporte y genera insights en lenguaje natural.
 * @param {Array} reportData - Los datos del reporte (currentReportData).
 * @returns {Array<string>} - Un array de strings, donde cada string es un insight.
 */
function generateInsights(reportData) {
    if (!reportData || reportData.length < 1) {
        return ["No hay suficientes datos para generar un análisis."];
    }

    const insights = [];

    // --- CÁLCULOS GENERALES ---
    const totalTurns = reportData.reduce((sum, row) => sum + row.turnos_atendidos, 0);
    if (totalTurns === 0) return ["No se atendieron turnos en este período."];

    // Calcular promedios generales ponderados para todo el reporte
    let totalWaitSeconds = 0;
    let totalServiceSeconds = 0;
    reportData.forEach(row => {
        const turns = row.turnos_atendidos || 0;
        totalWaitSeconds += intervalToSeconds(row.tiempo_espera_promedio) * turns;
        totalServiceSeconds += intervalToSeconds(row.tiempo_atencion_promedio) * turns;
    });
    const avgGeneralWaitTime = totalWaitSeconds / totalTurns;
    const avgGeneralServiceTime = totalServiceSeconds / totalTurns;

    // --- REGLAS DE ANÁLISIS ---

    // REGLA 1: Identificar el cuello de botella (mayor tiempo de espera)
    const sortedByWait = [...reportData].sort((a, b) => intervalToSeconds(b.tiempo_espera_promedio) - intervalToSeconds(a.tiempo_espera_promedio));
    const slowestItem = sortedByWait[0];
    if (slowestItem) {
        const slowestWaitTime = intervalToSeconds(slowestItem.tiempo_espera_promedio);
        if (slowestWaitTime > avgGeneralWaitTime * 1.5) { // Si es 50% más lento que el promedio
            insights.push(`💡 **Punto Crítico:** "${slowestItem.group_name}" tiene el tiempo de espera más alto (${formatInterval(slowestItem.tiempo_espera_promedio)}), significativamente por encima del promedio. **Acción sugerida:** Analizar si necesita más recursos o personal asignado.`);
        }
    }

    // REGLA 2: Identificar al más eficiente (menor tiempo de espera)
    const fastestItem = sortedByWait[sortedByWait.length - 1];
    if (fastestItem && reportData.length > 2) {
        insights.push(`✅ **Punto Fuerte:** "${fastestItem.group_name}" demuestra ser el más ágil, con el menor tiempo de espera (${formatInterval(fastestItem.tiempo_espera_promedio)}). Se puede usar como un modelo de eficiencia.`);
    }

    // REGLA 3: Detectar desbalance (Mucha espera, pero atención rápida)
    reportData.forEach(row => {
        const waitTime = intervalToSeconds(row.tiempo_espera_promedio);
        const serviceTime = intervalToSeconds(row.tiempo_atencion_promedio);
        if (waitTime > avgGeneralWaitTime * 2 && serviceTime < avgGeneralServiceTime) {
            insights.push(`⚠️ **Alerta de Flujo:** En "${row.group_name}", la espera es muy alta pero la atención es muy rápida. Esto podría indicar un "cuello de botella" antes de que el cliente llegue al funcionario, no en el funcionario mismo.`);
        }
    });

    // REGLA 4: El más trabajador (mayor volumen de turnos)
    const sortedByVolume = [...reportData].sort((a, b) => b.turnos_atendidos - a.turnos_atendidos);
    const busiestItem = sortedByVolume[0];
    if (busiestItem && busiestItem.turnos_atendidos > totalTurns / reportData.length * 1.5) {
        insights.push(`📈 **Alto Volumen:** "${busiestItem.group_name}" gestiona la mayor cantidad de turnos (${busiestItem.turnos_atendidos}). Es el pilar del flujo de trabajo en este período.`);
    }

    if (insights.length === 0) {
        insights.push("El rendimiento general es estable y no se detectaron anomalías significativas en este período.");
    }

    return insights;
}

async function exportToPDF() {
    if (currentReportData.length === 0) {
        alert("No hay datos para exportar. Por favor, genere un reporte primero.");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

    // --- 1. METADATOS Y TÍTULOS ---
    const groupByLabel = document.getElementById('table-header-group').textContent;
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;
    const today = new Date().toLocaleDateString('es-CO');
    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    const margin = 14;

    doc.setFontSize(18);
    doc.setTextColor(40, 58, 90);
    doc.text("Reporte Ejecutivo de Rendimiento", margin, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Período del reporte: ${startDate} al ${endDate}`, margin, 30);
    doc.text(`Agrupado por: ${groupByLabel}`, margin, 36);

    // --- 2. AÑADIR LOS INSIGHTS AUTOMÁTICOS ---
    const insights = generateInsights(currentReportData);

    doc.setFontSize(14);
    doc.setTextColor(40, 58, 90);
    doc.text("Análisis Automático", margin, 50);
    doc.setLineWidth(0.5);
    doc.line(margin, 52, pageWidth - margin, 52);

    const plainTextInsights = insights.map(insight => {
        let cleanText = insight.replace(/💡|✅|⚠️|📈/g, '');
        cleanText = cleanText.replace(/\*\*/g, '');
        return '• ' + cleanText.trim();
    });

    // **AQUÍ ESTÁ LA CORRECCIÓN CLAVE Y ROBUSTA:**
    // 1. Definimos una posición inicial fija para el texto.
    const insightsStartY = 60;

    // 2. CALCULAMOS la altura REAL que ocupará el bloque de texto ANTES de dibujarlo.
    const textBlockDimensions = doc.getTextDimensions(plainTextInsights, { maxWidth: pageWidth - (margin * 2) });
    const textBlockHeight = textBlockDimensions.h;

    // 3. Dibujamos el texto en su posición.
    doc.setFontSize(10);
    doc.setTextColor(50);
    doc.text(plainTextInsights, margin, insightsStartY, { maxWidth: pageWidth - (margin * 2) });

    // 4. La tabla comenzará después del texto + un margen. Esto SIEMPRE será un número válido.
    const tableStartY = insightsStartY + textBlockHeight + 10;

    // --- 3. AÑADIR LA TABLA DE DATOS ---
    const tableHeaders = [groupByLabel, "Turnos Atendidos", "T. Espera Prom.", "T. Atención Prom."];
    const tableBody = currentReportData.map(row => [
        row.group_name,
        row.turnos_atendidos,
        formatInterval(row.tiempo_espera_promedio),
        formatInterval(row.tiempo_atencion_promedio)
    ]);

    doc.autoTable({
        head: [tableHeaders],
        body: tableBody,
        startY: tableStartY, // Usamos nuestra posición calculada
        theme: 'grid',
        headStyles: { fillColor: [22, 162, 255] },
        margin: { left: margin, right: margin }
    });

    // --- 4. AÑADIR EL GRÁFICO ---
    let finalY = doc.lastAutoTable.finalY;
    const chartCanvas = document.getElementById('turns-by-employee-chart');
    const chartImage = chartCanvas.toDataURL('image/png', 1.0);
    const chartHeight = 80;
    const chartWidth = 180;

    if (finalY + chartHeight + 30 > pageHeight) {
        doc.addPage();
        finalY = 20;
    }

    doc.setFontSize(14);
    doc.setTextColor(40, 58, 90);
    doc.text("Gráfico del Reporte", margin, finalY + 15);
    doc.line(margin, finalY + 17, pageWidth - margin, finalY + 17);
    doc.addImage(chartImage, 'PNG', margin, finalY + 20, chartWidth, chartHeight);

    // --- 5. AÑADIR EL PIE DE PÁGINA ---
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
            `Página ${i} de ${pageCount} | Reporte generado el ${today} por Sistema de Turnos Notaría.`,
            margin,
            pageHeight - 10
        );
    }

    // --- 6. DESCARGAR EL ARCHIVO ---
    doc.save(`Reporte_Ejecutivo_${groupByLabel}_${endDate}.pdf`);
}

// --- Funciones de Carga de Datos (load...) ---
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

async function loadClients() {
    clientsTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">Cargando clientes...</td></tr>`;

    const from = (currentPage - 1) * rowsPerPage;
    const to = from + rowsPerPage - 1;

    try {
        // 1. Empezamos a construir la consulta base
        let query = supabase
            .from('clientes')
            .select('*', { count: 'exact' });

        // 2. Si hay un término de búsqueda, AÑADIMOS el filtro a la consulta
        if (currentClientSearch) {
            // Usamos 'ilike' con '%' para buscar todos los números que EMPIECEN con el texto
            query = query.ilike('numero_identificacion', `${currentClientSearch}%`);
        }

        // 3. Continuamos construyendo la consulta con el orden y el rango
        const { data: clients, error, count } = await query
            .order('creado_en', { ascending: false })
            .range(from, to);

        if (error) throw error;

        // El resto de la función es casi igual
        clientsTableBody.innerHTML = '';
        if (clients.length === 0) {
            clientsTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">No se encontraron clientes con esos criterios.</td></tr>`;
            clientPaginationControls.classList.add('hidden');
            return;
        }

        clients.forEach(client => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';

            const registrationDate = new Date(client.creado_en).toLocaleDateString('es-CO', {
                year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            tr.innerHTML = `
                <td class="px-4 py-2">${client.nombre_completo}</td>
                <td class="px-4 py-2">${client.numero_identificacion}</td>
                <td class="px-4 py-2">${registrationDate}</td>
            `;
            clientsTableBody.appendChild(tr);
        });

        renderPaginationControls(count);

    } catch (error) {
        console.error("Error al cargar clientes:", error.message);
        clientsTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-red-400 py-4">Error al cargar la lista de clientes.</td></tr>`;
    }
}

async function loadMessages() {
    messagesTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">Cargando mensajes...</td></tr>`;
    try {
        const { data: messages, error } = await supabase
            .from('mensajes_visualizador')
            .select('*')
            .order('created_at', { ascending: false }); // Mostrar los más recientes primero

        if (error) throw error;

        messagesTableBody.innerHTML = '';
        if (messages.length === 0) {
            messagesTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">No hay mensajes registrados.</td></tr>`;
            return;
        }

        messages.forEach(msg => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            const statusText = msg.is_active ? 'Activo' : 'Inactivo';
            const statusClass = msg.is_active ? 'text-green-400' : 'text-red-400';
            tr.innerHTML = `
                <td class="px-4 py-2">${msg.texto_mensaje}</td>
                <td class="px-4 py-2 ${statusClass}">${statusText}</td>
                <td class="px-4 py-2">
                    <button class="form-button btn-primary text-sm px-3 py-1 mr-2" onclick="handleEditMessage(${msg.id})">Editar</button>
                    <button class="form-button btn-danger text-sm px-3 py-1" onclick="handleDeleteMessage(${msg.id})">Eliminar</button>
                </td>
            `;
            messagesTableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar mensajes:", error.message);
        messagesTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-red-400 py-4">Error al cargar mensajes.</td></tr>`;
    }
}

async function handleSaveMessage(event) {
    event.preventDefault();
    const id = messageIdField.value;
    const messageData = {
        texto_mensaje: messageTextField.value,
        is_active: messageActiveField.checked
    };

    const actionText = id ? 'Actualizar' : 'Crear';
    const confirmed = await showConfirmationModal(`${actionText} Mensaje`, `¿Está seguro de que desea guardar este mensaje?`);
    if (!confirmed) return;

    try {
        if (id) {
            messageData.id = id;
        }

        // Usamos upsert para crear o actualizar
        const { error } = await supabase.from('mensajes_visualizador').upsert(messageData);
        if (error) throw error;

        await showConfirmationModal('Éxito', `Mensaje guardado exitosamente.`);
        messageFormContainer.classList.add('hidden');
        loadMessages(); // Recargar la tabla
    } catch (error) {
        console.error(`Error al guardar mensaje:`, error.message);
        await showConfirmationModal('Error', `Error al guardar mensaje: ${error.message}`);
    }
}

async function handleEditMessage(id) {
    try {
        const { data: msg, error } = await supabase.from('mensajes_visualizador').select('*').eq('id', id).single();
        if (error) throw error;

        messageForm.reset();
        messageIdField.value = msg.id;
        messageTextField.value = msg.texto_mensaje;
        messageActiveField.checked = msg.is_active;
        messageActiveText.textContent = msg.is_active ? 'Activo' : 'Inactivo';

        messageFormTitle.textContent = `Editar Mensaje`;
        messageFormContainer.classList.remove('hidden');
    } catch (error) {
        console.error("Error al cargar mensaje para editar:", error.message);
        await showConfirmationModal('Error', `No se pudo cargar el mensaje: ${error.message}`);
    }
}

async function handleDeleteMessage(id) {
    const confirmed = await showConfirmationModal('Confirmar Eliminación', `¿Está seguro de que desea eliminar este mensaje?`);
    if (!confirmed) return;

    try {
        const { error } = await supabase.from('mensajes_visualizador').delete().eq('id', id);
        if (error) throw error;

        await showConfirmationModal('Éxito', 'Mensaje eliminado exitosamente.');
        loadMessages();
    } catch (error) {
        console.error("Error al eliminar mensaje:", error.message);
        await showConfirmationModal('Error', `No se pudo eliminar el mensaje: ${error.message}`);
    }
}

// Exponer las funciones al ámbito global para los onclick
window.handleEditMessage = handleEditMessage;
window.handleDeleteMessage = handleDeleteMessage;

function renderPaginationControls(totalCount) {
    if (!totalCount || totalCount <= rowsPerPage) {
        clientPaginationControls.classList.add('hidden');
        return;
    }

    clientPaginationControls.classList.remove('hidden');

    const totalPages = Math.ceil(totalCount / rowsPerPage);

    clientPageInfo.textContent = `Página ${currentPage} de ${totalPages}`;

    // Habilitar o deshabilitar los botones según la página actual
    prevClientPage.disabled = currentPage === 1;
    nextClientPage.disabled = currentPage >= totalPages;
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

async function loadReportFilters() {
    try {
        const employeeFilterSelect = document.getElementById('employee-filter');
        const moduleFilterSelect = document.getElementById('module-filter');

        // Verificar que los elementos existen antes de manipularlos
        if (!employeeFilterSelect || !moduleFilterSelect) {
            console.warn("Elementos de filtro no encontrados, puede que la vista de reportes no esté cargada");
            return;
        }

        const [{ data: users, error: userError }, { data: modules, error: moduleError }] = await Promise.all([
            supabase.from('usuarios').select('id_usuario, nombre_completo'),
            supabase.from('modulos').select('id_modulo, nombre_modulo')
        ]);

        if (userError) throw userError;
        if (moduleError) throw moduleError;

        //const { data: users, error: userError } = await supabase.from('usuarios').select('id_usuario, nombre_completo');


        employeeFilterSelect.innerHTML = '<option value="">Todos los Empleados</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id_usuario;
            option.textContent = user.nombre_completo;
            employeeFilterSelect.appendChild(option);
        });

        //const { data: modules, error: moduleError } = await supabase.from('modulos').select('id_modulo, nombre_modulo');


        moduleFilterSelect.innerHTML = '<option value="">Todos los Módulos</option>';
        modules.forEach(mod => {
            const option = document.createElement('option');
            option.value = mod.id_modulo;
            option.textContent = mod.nombre_modulo;
            moduleFilterSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando filtros de reporte:", error);
    }
}

async function loadModules() {
    modulesTableBody.innerHTML = `<tr><td colspan="4" class="text-center text-gray-500 py-4">Cargando módulos...</td></tr>`;
    try {
        const response = await fetch('/api/get-modules');
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Error del servidor');
        }

        const modules = result.modules;

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

async function loadServicesConfig() {
    // Referencias a los elementos del DOM
    const servicesConfigHeader = document.getElementById('services-config-header');
    const servicesConfigBody = document.getElementById('services-config-body');

    // Limpiamos el contenido anterior
    servicesConfigHeader.innerHTML = '';
    servicesConfigBody.innerHTML = `<tr><td colspan="99" class="text-center text-gray-500 py-4">Cargando configuración...</td></tr>`;

    try {
        // Obtenemos los módulos y servicios de la base de datos
        const { data: modules, error: modulesError } = await supabase.from('modulos').select('*').order('nombre_modulo', { ascending: true });
        if (modulesError) throw modulesError;
        allModules = modules; // Asumiendo que allModules es una variable global o de ámbito superior

        const { data: services, error: servicesError } = await supabase.from('servicios').select('*').order('nombre_servicio', { ascending: true });
        if (servicesError) throw servicesError;
        allServices = services; // Asumiendo que allServices es una variable global o de ámbito superior

        // --- INICIO DE LA CORRECCIÓN ---

        // 1. Crear una nueva fila de encabezado en memoria
        const newHeaderRow = document.createElement('tr');

        // 2. Crear y añadir la primera celda "Módulo" a la fila
        const moduleHeaderCell = document.createElement('th');
        moduleHeaderCell.className = 'px-4 py-2 rounded-tl-lg';
        moduleHeaderCell.textContent = 'Módulo';
        newHeaderRow.appendChild(moduleHeaderCell);

        // 3. Recorrer los servicios y añadir cada uno como una celda a la MISMA fila
        allServices.forEach((service, index) => {
            const serviceHeaderCell = document.createElement('th');
            serviceHeaderCell.className = 'px-4 py-2';
            serviceHeaderCell.textContent = service.nombre_servicio;

            // Redondear la esquina superior derecha de la última celda
            if (index === allServices.length - 1) {
                serviceHeaderCell.classList.add('rounded-tr-lg');
            }
            newHeaderRow.appendChild(serviceHeaderCell);
        });

        // 4. Añadir la fila completa al a a la tabla
        servicesConfigHeader.appendChild(newHeaderRow);

        // --- FIN DE LA CORRECIÓN ---

        // Cargar las relaciones actuales entre módulos y servicios
        const { data: moduleServices, error: msError } = await supabase.from('modulos_servicios').select('*');
        if (msError) throw msError;

        currentModuleServiceConfig = {};
        moduleServices.forEach(ms => {
            if (!currentModuleServiceConfig[ms.id_modulo]) {
                currentModuleServiceConfig[ms.id_modulo] = [];
            }
            currentModuleServiceConfig[ms.id_modulo].push(ms.id_servicio);
        });

        // Renderizar el cuerpo de la tabla (esta lógica no cambia)
        servicesConfigBody.innerHTML = '';
        allModules.forEach(mod => {
            const tr = document.createElement('tr');
            let rowHtml = `<td class="px-4 py-2 font-bold">${mod.nombre_modulo}</td>`;
            allServices.forEach(service => {
                const isChecked = currentModuleServiceConfig[mod.id_modulo] && currentModuleServiceConfig[mod.id_modulo].includes(service.id_servicio);
                rowHtml += `
                    <td class="px-4 py-2 text-center">
                        <input type="checkbox" class="w-5 h-5 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                               data-module-id="${mod.id_modulo}" data-service-id="${service.id_servicio}" ${isChecked ? 'checked' : ''}>
                    </td>`;
            });
            tr.innerHTML = rowHtml;
            servicesConfigBody.appendChild(tr);
        });

    } catch (error) {
        console.error("Error al cargar configuración de servicios:", error.message);
        servicesConfigBody.innerHTML = `<tr><td colspan="${allServices.length + 1}" class="text-center text-red-400 py-4">Error al cargar configuración.</td></tr>`;
    }
}

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

async function loadPriorityEditor() {
    priorityModuleSelect.innerHTML = '<option value="">-- Cargando módulos... --</option>';
    priorityListContainer.classList.add('hidden');

    try {
        const { data: modules, error } = await supabase
            .from('modulos')
            .select('id_modulo, nombre_modulo')
            .order('nombre_modulo');

        if (error) throw error;

        priorityModuleSelect.innerHTML = '<option value="">-- Elija un módulo --</option>';
        modules.forEach(module => {
            const option = document.createElement('option');
            option.value = module.id_modulo;
            option.textContent = module.nombre_modulo;
            priorityModuleSelect.appendChild(option);
        });

    } catch (error) {
        console.error("Error cargando módulos para el editor de prioridades:", error);
        priorityModuleSelect.innerHTML = '<option value="">Error al cargar módulos</option>';
    }
}

// --- Funciones de Manejo de Acciones (handle...) ---
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

async function editModule(id) {
    try {
        const response = await fetch(`/api/get-module/${id}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        const mod = result.module;

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
    const confirmed = await showConfirmationModal('Eliminar Módulo', '¿Está seguro de que desea eliminar este módulo? Esta acción no se puede deshacer.');
    if (!confirmed) return;

    try {
        const response = await fetch(`/api/delete-module/${id}`, {
            method: 'DELETE'
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error || 'Error del servidor');
        }

        await showConfirmationModal('Éxito', result.message);
        loadModules();

    } catch (error) {
        console.error("Error al eliminar módulo:", error.message);
        await showConfirmationModal('Error', `Error al eliminar módulo: ${error.message}`);
    }
}

async function generateReport() {
    const start = reportStartDate?.value;
    const end = reportEndDate?.value;
    const employeeId = document.getElementById('employee-filter')?.value || '';
    const moduleId = document.getElementById('module-filter')?.value || '';

    const groupByElement = document.querySelector('input[name="group-by"]:checked');
    const groupBy = groupByElement ? groupByElement.value : 'funcionario';

    currentReportData = [];
    exportMenuBtn.disabled = true;
    reportInsightsContainer.classList.add('hidden'); // <-- AÑADE ESTA LÍNEA
    reportInsightsList.innerHTML = '';

    if (!start || !end) {
        return alert('Por favor, seleccione un rango de fechas.');
    }

    try {
        let apiUrl = `/api/reports?start=${start}&end=${end}&group_by=${groupBy}`;
        if (employeeId) apiUrl += `&user_id=${employeeId}`;
        if (moduleId) apiUrl += `&module_id=${moduleId}`;

        const response = await fetch(apiUrl, { credentials: 'include' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Error del servidor: ${response.status}`);
        }
        const data = await response.json();

        // Limpiar UI
        reportTableBody.innerHTML = '';
        document.getElementById('kpi-total-turns').textContent = '--';
        document.getElementById('kpi-avg-wait').textContent = '--';
        document.getElementById('kpi-avg-service').textContent = '--';
        if (reportChart) reportChart.destroy();

        if (data.length === 0) {
            reportTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-500">No se encontraron datos.</td></tr>`;
            return;
        }

        // ====== INICIO DEL CÓDIGO A AÑADIR/MODIFICAR ======
        // ¡Guardamos los datos en la variable global!
        currentReportData = data;
        // ¡Habilitamos el botón de exportar!
        exportMenuBtn.disabled = false;
        // ====== FIN DEL CÓDIGO A AÑADIR/MODIFICAR ======

        // Justo después de guardar los datos y habilitar el botón de exportar:

        const insights = generateInsights(currentReportData); // ¡Llamamos al motor!
        if (insights.length > 0) {
            insights.forEach(insightText => {
                const li = document.createElement('li');
                li.innerHTML = insightText; // Usamos innerHTML para que reconozca <strong> y <b>
                reportInsightsList.appendChild(li);
            });
            reportInsightsContainer.classList.remove('hidden');
        }

        const totalTurns = data.reduce((sum, row) => sum + (row.turnos_atendidos || 0), 0);
        document.getElementById('kpi-total-turns').textContent = totalTurns;

        // Calcular promedios generales correctamente (ponderado)
        let totalWaitSeconds = 0;
        let totalServiceSeconds = 0;
        data.forEach(row => {
            const turns = row.turnos_atendidos || 0;
            if (row.tiempo_espera_promedio) {
                const parts = row.tiempo_espera_promedio.split(':');
                const seconds = (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseFloat(parts[2]);
                totalWaitSeconds += seconds * turns;
            }
            if (row.tiempo_atencion_promedio) {
                const parts = row.tiempo_atencion_promedio.split(':');
                const seconds = (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseFloat(parts[2]);
                totalServiceSeconds += seconds * turns;
            }
        });

        const avgWaitSeconds = totalTurns > 0 ? totalWaitSeconds / totalTurns : 0;
        const avgServiceSeconds = totalTurns > 0 ? totalServiceSeconds / totalTurns : 0;

        const formatSeconds = (totalSeconds) => {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = Math.round(totalSeconds % 60);
            return `${minutes}m ${seconds}s`;
        };

        document.getElementById('kpi-avg-wait').textContent = formatSeconds(avgWaitSeconds);
        document.getElementById('kpi-avg-service').textContent = formatSeconds(avgServiceSeconds);

        const tableHeader = document.getElementById('table-header-group');
        tableHeader.textContent = groupBy.charAt(0).toUpperCase() + groupBy.slice(1);

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="p-3">${row.group_name}</td>
                <td class="p-3 text-center">${row.turnos_atendidos}</td>
                <td class="p-3">${formatInterval(row.tiempo_espera_promedio)}</td>
                <td class="p-3">${formatInterval(row.tiempo_atencion_promedio)}</td>
            `;
            reportTableBody.appendChild(tr);
        });

        document.getElementById('chart-title').textContent = `Turnos por ${groupBy}`;
        const chartType = groupBy === 'servicio' ? 'doughnut' : 'bar';
        const labels = data.map(row => row.group_name);
        const chartData = data.map(row => row.turnos_atendidos);

        reportChart = new Chart(chartCanvas, {
            type: chartType,
            data: {
                labels: labels,
                datasets: [{
                    label: 'Turnos Atendidos',
                    data: chartData,
                    backgroundColor: chartType === 'bar' ? 'rgba(59, 130, 246, 0.5)' : [
                        'rgba(59, 130, 246, 0.7)', 'rgba(239, 68, 68, 0.7)', 'rgba(245, 158, 11, 0.7)',
                        'rgba(16, 185, 129, 0.7)', 'rgba(139, 92, 246, 0.7)', 'rgba(236, 72, 153, 0.7)'
                    ],
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1
                }]
            },
            options: {
                plugins: { legend: { labels: { color: '#9ca3af' } } },
                scales: chartType === 'bar' ? {
                    y: { beginAtZero: true, ticks: { color: '#9ca3af' } },
                    x: { ticks: { color: '#9ca3af' } }
                } : {}
            }
        });
    } catch (error) {
        console.error("Error al generar el reporte:", error);
        reportTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-400">Error: ${error.message}</td></tr>`;
        if (reportChart) reportChart.destroy();

        exportMenuBtn.disabled = true;
        reportInsightsContainer.classList.add('hidden');
    }
}

async function loadServices() {
    servicesTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">Cargando servicios...</td></tr>`;
    try {
        const { data: services, error } = await supabase
            .from('servicios')
            .select('*')
            .order('nombre_servicio', { ascending: true });

        if (error) throw error;

        servicesTableBody.innerHTML = '';
        if (services.length === 0) {
            servicesTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">No hay servicios registrados.</td></tr>`;
            return;
        }

        services.forEach(service => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            tr.innerHTML = `
                <td class="px-4 py-2">${service.nombre_servicio}</td>
                <td class="px-4 py-2">${service.prefijo_ticket}</td>
                <td class="px-4 py-2">
                    <button class="form-button btn-primary text-sm px-3 py-1 mr-2" onclick="handleEditService(${service.id_servicio})">Editar</button>
                    <button class="form-button btn-danger text-sm px-3 py-1" onclick="handleDeleteService(${service.id_servicio}, '${service.nombre_servicio}')">Eliminar</button>
                </td>
            `;
            servicesTableBody.appendChild(tr);
        });
    } catch (error) {
        console.error("Error al cargar servicios:", error.message);
        servicesTableBody.innerHTML = `<tr><td colspan="3" class="text-center text-red-400 py-4">Error al cargar servicios.</td></tr>`;
    }
}

async function handleSaveService(event) {
    event.preventDefault();
    const id = serviceIdField.value;
    const serviceData = {
        nombre_servicio: serviceNameField.value,
        prefijo_ticket: servicePrefixField.value.toUpperCase()
    };

    const actionText = id ? 'Actualizar' : 'Crear';
    const confirmed = await showConfirmationModal(`${actionText} Servicio`, `¿Está seguro de que desea guardar este servicio?`);
    if (!confirmed) return;

    try {
        if (id) {
            serviceData.id_servicio = id;
        }

        const { error } = await supabase.from('servicios').upsert(serviceData);
        if (error) throw error;

        await showConfirmationModal('Éxito', `Servicio guardado exitosamente.`);
        serviceFormContainer.classList.add('hidden');
        loadServices(); // Recargar la tabla
    } catch (error) {
        console.error(`Error al guardar servicio:`, error.message);
        await showConfirmationModal('Error', `Error al guardar servicio: ${error.message}`);
    }
}

async function handleEditService(id) {
    try {
        const { data: service, error } = await supabase.from('servicios').select('*').eq('id_servicio', id).single();
        if (error) throw error;

        serviceForm.reset();
        serviceIdField.value = service.id_servicio;
        serviceNameField.value = service.nombre_servicio;
        servicePrefixField.value = service.prefijo_ticket;

        serviceFormTitle.textContent = `Editar Servicio: ${service.nombre_servicio}`;
        serviceFormContainer.classList.remove('hidden');
    } catch (error) {
        console.error("Error al cargar servicio para editar:", error.message);
        await showConfirmationModal('Error', `No se pudo cargar el servicio: ${error.message}`);
    }
}

async function handleDeleteService(id, name) {
    const confirmed = await showConfirmationModal('Confirmar Eliminación', `¿Está ABSOLUTAMENTE seguro de que desea eliminar el servicio "${name}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    try {
        const { error } = await supabase.from('servicios').delete().eq('id_servicio', id);
        if (error) throw error;

        await showConfirmationModal('Éxito', 'Servicio eliminado exitosamente.');
        loadServices();
    } catch (error) {
        console.error("Error al eliminar servicio:", error.message);
        await showConfirmationModal('Error', `No se pudo eliminar el servicio: ${error.message}. Es posible que esté en uso.`);
    }
}

// IMPORTANTE: Expón las funciones al ámbito global para que los `onclick` funcionen
window.handleEditService = handleEditService;
window.handleDeleteService = handleDeleteService;

// --- suscripciones realtime ---
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
                // Si la bandera está levantada, ignora el evento y no hagas nada.
                if (isSavingConfig) {
                    return;
                }

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

// ==========================================================
// PUNTO DE ENTRADA DE LA APLICACIÓN
// ==========================================================
document.addEventListener('DOMContentLoaded', init);

