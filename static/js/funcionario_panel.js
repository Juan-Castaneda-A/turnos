// ==========================================================
// IMPORTACIÓN Y CONFIGURACIÓN INICIAL
// ==========================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';

// Inicializar Supabase
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
console.log("Supabase Client inicializado para Panel de Funcionario.");
console.log("Objeto Supabase:", supabase);
console.log("¿Existe supabase.from?", typeof supabase.from);

const turnosChannel = supabase.channel('turnos_channel'); // Dale un nombre específico

let testFromObject;
try {
    testFromObject = supabase.from('turnos');
    console.log("Objeto retornado por supabase.from('turnos'):", testFromObject);
    console.log("¿Existe testFromObject.on?", typeof testFromObject.on);
} catch (e) {
    console.error("Error al intentar llamar supabase.from('turnos'):", e);
}

// ==========================================================
// REFERENCIAS AL DOM
// ==========================================================
const assignedModuleNameElement = document.getElementById('assigned-module-name');
const myModuleTitleElement = document.getElementById('my-module-title');
const pendingTurnsBody = document.getElementById('pending-turns-body');
const currentAttendingTurnElement = document.getElementById('current-attending-turn');
const currentAttendingServiceElement = document.getElementById('current-attending-service');
const currentAttendingClientElement = document.getElementById('current-attending-client');
const btnCallNext = document.getElementById('btn-call-next');
const btnRecall = document.getElementById('btn-recall');
const btnFinish = document.getElementById('btn-finish');
const dailyHistoryBody = document.getElementById('daily-history-body');

const confirmationModal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

const silenceAlertBtn = document.getElementById('silence-alert-btn');

const transferModal = document.getElementById('transfer-modal');
const transferModalTitle = document.getElementById('transfer-modal-title');
const transferModuleSelect = document.getElementById('transfer-module-select');
const transferModalConfirmBtn = document.getElementById('transfer-modal-confirm-btn');
const transferModalCancelBtn = document.getElementById('transfer-modal-cancel-btn');

let currentAttendingTurnId = null;
let channels = [];
let sortedPendingTurns = [];
// ==========================================================
// FUNCIONES DE LÓGICA
// ==========================================================

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

async function handleApiResponse(response) {
    // Si hay redirección a login, redirigir al usuario
    if (response.status === 302 || response.redirected) {
        window.location.href = '/funcionario/login';
        throw new Error('Sesión expirada');
    }
    
    // Verificar si la respuesta es HTML (página de login)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
        window.location.href = '/funcionario/login';
        throw new Error('Sesión expirada');
    }
    
    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
    }
    
    return response.json();
}

async function updateAssignedModuleName() {
    try {
        const response = await fetch('/api/funcionario/get-module-name');
        const result = await handleApiResponse(response);

        if (!result.success) {
            throw new Error(result.error);
        }

        const moduleName = result.module_name;
        assignedModuleNameElement.textContent = moduleName;
        myModuleTitleElement.textContent = `Mi Módulo: ${moduleName}`;

        if (moduleName === 'No Asignado') {
            btnCallNext.disabled = true;
            btnRecall.disabled = true;
            btnFinish.disabled = true;
        }
    } catch (error) {
        console.error("Error al obtener nombre del módulo:", error.message);
        
        // Solo mostrar error si no es una redirección
        if (!error.message.includes('Sesión expirada')) {
            assignedModuleNameElement.textContent = 'Error';
            myModuleTitleElement.textContent = 'Mi Módulo: Error';
        }
    }
}



function updateButtonStates() {
    if (window.ASSIGNED_MODULE_ID === null) {
        btnCallNext.disabled = true;
        btnRecall.disabled = true;
        btnFinish.disabled = true;
        return;
    }

    const hasCurrentTurn = currentAttendingTurnId !== null;
    const hasPendingTurns = pendingTurnsBody.querySelector('.table-row') !== null &&
        pendingTurnsBody.querySelector('.text-gray-500') === null &&
        pendingTurnsBody.querySelector('.text-red-400') === null;

    btnCallNext.disabled = hasCurrentTurn || !hasPendingTurns;
    btnRecall.disabled = !hasCurrentTurn;
    btnFinish.disabled = !hasCurrentTurn;
}


async function openTransferModal(turnId, turnName) {
    console.log(`Abriendo modal para transferir turno: ${turnId} (${turnName})`);
    
    // 1. Guardamos el ID del turno en el modal para usarlo después
    transferModal.dataset.turnId = turnId;
    transferModalTitle.textContent = `Transferir Turno ${turnName}`;
    transferModuleSelect.innerHTML = '<option value="">Cargando módulos...</option>';
    transferModal.classList.remove('hidden');

    try {
        // 2. Llamamos a la API para obtener los módulos de destino
        const response = await fetch('/api/funcionario/get-transfer-targets');
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        const modules = result.modules;
        transferModuleSelect.innerHTML = '<option value="">-- Seleccione un módulo --</option>';

        if (modules.length === 0) {
            transferModuleSelect.innerHTML = '<option value="">No hay otros módulos activos</option>';
            transferModalConfirmBtn.disabled = true;
            return;
        }

        // 3. Poblamos el <select>
        modules.forEach(mod => {
            const option = document.createElement('option');
            option.value = mod.id_modulo;
            option.textContent = mod.nombre_modulo;
            transferModuleSelect.appendChild(option);
        });
        transferModalConfirmBtn.disabled = false;

    } catch (error) {
        console.error("Error cargando módulos de transferencia:", error.message);
        transferModuleSelect.innerHTML = `<option value="">Error al cargar</option>`;
        transferModalConfirmBtn.disabled = true;
    }
}

async function handleTransferConfirm() {
    const turnId = transferModal.dataset.turnId;
    const targetModuleId = transferModuleSelect.value;

    if (!targetModuleId) {
        alert("Por favor, seleccione un módulo de destino.");
        return;
    }

    transferModalConfirmBtn.disabled = true;
    transferModalConfirmBtn.textContent = "Transfiriendo...";

    try {
        // 1. Llamamos a la API para ejecutar la transferencia
        const response = await fetch('/api/funcionario/transfer-turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                turn_id: parseInt(turnId),
                target_module_id: parseInt(targetModuleId)
            })
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        // 2. ¡Éxito! Cerramos el modal
        transferModal.classList.add('hidden');
        await showConfirmationModal('Éxito', result.message);
        
        // 3. NO necesitamos recargar la lista de turnos aquí.
        // El broadcast 'turn_transferred' que acabamos de disparar
        // será recibido por nuestro propio listener y actualizará la lista.

    } catch (error) {
        console.error("Error al transferir turno:", error.message);
        await showConfirmationModal('Error', `Error al transferir: ${error.message}`);
    } finally {
        transferModalConfirmBtn.disabled = false;
        transferModalConfirmBtn.textContent = "Confirmar Transferencia";
    }
}

// ==========================================================
// FUNCIONES DE RENDERIZADO (NUEVAS)
// (Estas funciones solo actualizan el HTML)
// ==========================================================

function renderPendingTurns(turns) {
    pendingTurnsBody.innerHTML = '';
    
    if (window.ASSIGNED_MODULE_ID === null) {
        pendingTurnsBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">Asigne un módulo a este funcionario para ver turnos.</td></tr>`;
        btnCallNext.disabled = true;
        return;
    }

    if (!turns || turns.length === 0) {
        pendingTurnsBody.innerHTML = `<tr><td colspan="3" class="text-center text-gray-500 py-4">No hay turnos pendientes.</td></tr>`;
        btnCallNext.disabled = true;
    } else {
        sortedPendingTurns = turns; // Actualizamos la variable global
        turns.forEach(turn => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            // ¡Corrección! Asegurarnos de que 'turn' no sea undefined
            const turnName = `${turn.prefijo_turno || '?'}-${String(turn.numero_turno || 0).padStart(3, '0')}`;

            tr.innerHTML = `
                <td class="px-4 py-2">${turnName}</td>
                <td class="px-4 py-2">${turn.servicios?.nombre_servicio || 'Servicio no disponible'}</td>
                <td class="px-4 py-2">
                    <button 
                        class="form-button btn-primary text-sm px-3 py-1" 
                        onclick="openTransferModal(${turn.id_turno}, '${turnName}')">
                        Transferir
                    </button>
                </td>
            `;
            pendingTurnsBody.appendChild(tr);
        });
        btnCallNext.disabled = false;
    }
}

function renderCurrentTurn(turn) {
    if (window.ASSIGNED_MODULE_ID === null) {
        currentAttendingTurnElement.textContent = '---';
        currentAttendingServiceElement.textContent = 'Módulo no asignado.';
        currentAttendingClientElement.textContent = '-';
        currentAttendingTurnId = null;
        return;
    }

    if (turn) {
        const turnNumber = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
        const serviceName = turn.servicios?.nombre_servicio || 'Servicio desconocido';
        const clientName = turn.clientes?.nombre_completo || 'N/A';

        currentAttendingTurnElement.textContent = turnNumber;
        currentAttendingServiceElement.textContent = serviceName;
        currentAttendingClientElement.textContent = clientName;
        currentAttendingTurnId = turn.id_turno;
    } else {
        currentAttendingTurnElement.textContent = '---';
        currentAttendingServiceElement.textContent = 'Esperando nuevo turno...';
        currentAttendingClientElement.textContent = '-';
        currentAttendingTurnId = null;
    }
}

function renderDailyHistory(history) {
    dailyHistoryBody.innerHTML = '';

    if (window.ASSIGNED_MODULE_ID === null) {
        dailyHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">Asigne un módulo a este funcionario para ver historial.</td></tr>`;
        return;
    }

    if (!history || history.length === 0) {
        dailyHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">No hay turnos atendidos hoy.</td></tr>`;
    } else {
        history.forEach(turn => {
            const tr = document.createElement('tr');
            tr.className = 'table-row';
            const finalizationTime = new Date(turn.hora_finalizacion).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
            tr.innerHTML = `
                <td class="px-4 py-2">${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}</td>
                <td class="px-4 py-2">${finalizationTime}</td>
            `;
            dailyHistoryBody.appendChild(tr);
        });
    }
}

// ==========================================================
// LÓGICA DE CARGA DE DATOS (MODIFICADA)
// ==========================================================

async function loadAllPanelData() {
    // 1. Hacemos UNA SOLA llamada a nuestra nueva API
    const response = await fetch('/api/funcionario/get-panel-data');
    
    if (!response.ok) {
        // Si la API maestra falla, mostramos el error en todas las secciones
        const errorMsg = `Error HTTP ${response.status}: No se pudo cargar datos del panel.`;
        console.error(errorMsg);
        pendingTurnsBody.innerHTML = `<tr><td colspan="3" class="text-center text-red-400 py-4">${errorMsg}</td></tr>`;
        currentAttendingServiceElement.textContent = 'Error al cargar.';
        dailyHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center text-red-400 py-4">${errorMsg}</td></tr>`;
        return; // Detenemos la ejecución
    }
    
    const result = await response.json();

    if (!result.success) {
        console.error("Error en la respuesta de la API:", result.error);
        return; // Detenemos la ejecución
    }

    const { pending_turns, current_turn, daily_history } = result.data;

    // 2. Llamamos a las funciones de "renderizado"
    renderPendingTurns(pending_turns);
    renderCurrentTurn(current_turn);
    renderDailyHistory(daily_history);

    // 3. Actualizamos el estado de los botones (esta función no cambia)
    updateButtonStates();
}


function setupRealtimeSubscriptions() {
    console.log("Configurando suscripciones en tiempo real para el panel...");

    // --- ¡LÓGICA DEBOUNCE / MUTEX (MODIFICADA)! ---
    let reloadTimeout;
    let isReloading = false; 

    const debouncedReloadAll = () => {
        clearTimeout(reloadTimeout); 
        
        reloadTimeout = setTimeout(async () => {
            if (isReloading) {
                console.log("DEBOUNCED RELOAD: Ignorado, recarga ya en curso.");
                return;
            }

            isReloading = true;
            console.log("DEBOUNCED RELOAD: Recargando TODO el panel...");
            
            try {
                // ¡AHORA SOLO LLAMAMOS A UNA FUNCIÓN!
                await loadAllPanelData();
            } catch (e) {
                console.error("Error durante la recarga 'debounced':", e);
            } finally {
                isReloading = false;
                console.log("DEBOUNCED RELOAD: Recarga completada.");
            }
        }, 500); // 500ms de espera
    };
    // --- FIN DE LA MODIFICACIÓN ---

    turnosChannel.on(
        'postgres_changes', 
        { 
            event: '*',
            schema: 'public', 
            table: 'turnos', 
            filter: `id_organizacion=eq.${window.ORGANIZACION_ID}` 
        },
        (payload) => {
            console.log(`Cambio en 'turnos' detectado: ${payload.eventType}`);
            // Cada vez que algo cambia, llamamos al amortiguador.
            debouncedReloadAll();
        }
    ).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Panel de funcionario conectado al canal de tiempo real.');
        }
    });
}

// ==========================================================
// EVENT LISTENERS PARA LOS BOTONES
// ==========================================================

btnCallNext.addEventListener('click', async () => {
    if (sortedPendingTurns.length === 0) {
        await showConfirmationModal('Atención', 'No hay turnos pendientes para llamar.');
        return;
    }
    const confirmed = await showConfirmationModal('Llamar Siguiente Turno', '¿Está seguro de que desea llamar al siguiente turno disponible?');
    if (!confirmed) return;

    btnCallNext.disabled = true;
    try {
        // 1. Llamamos a nuestra API
        const response = await fetch('/api/funcionario/call-next', {
            method: 'POST'
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        // 2. La API nos devuelve el turno que llamó
        const nextTurn = result.called_turn;
        console.log(`Turno ${nextTurn.prefijo_turno}-${nextTurn.numero_turno} llamado desde el backend.`);

        // 3. Enviamos el broadcast al visualizador (¡esto no cambia!)
        console.log("Enviando evento de broadcast 'nuevo_llamado'");
        const { data: moduloData } = await supabase.from('modulos').select('nombre_modulo').eq('id_modulo', window.ASSIGNED_MODULE_ID).single(); // <-- ¡ESPERA!

        // --- ¡¡¡CORRECCIÓN IMPORTANTE!!! ---
        // Ya no necesitamos esta consulta a 'modulos', el nombre está en la variable global
        // const { data: moduloData } = ...
        const moduleName = assignedModuleNameElement.textContent || "Módulo"; // Leemos el nombre del módulo del DOM

        turnosChannel.send({
            type: 'broadcast',
            event: 'nuevo_llamado',
            payload: {
                id_turno: nextTurn.id_turno,
                prefijo_turno: nextTurn.prefijo_turno,
                numero_turno: nextTurn.numero_turno,
                nombre_modulo: moduleName
            },
        });
        // --- FIN DE LA CORRECCIÓN ---

        console.log("Actualizando interfaz...");
        // await loadCurrentTurn();
        // await loadPendingTurns();

    } catch (error) {
        console.error("Error al llamar siguiente turno:", error.message);
        await showConfirmationModal('Error', `Error al llamar turno: ${error.message}`);
    } finally {
        updateButtonStates(); // Esto re-evaluará si 'btnCallNext' debe estar disabled
    }
});

btnRecall.addEventListener('click', async () => {
    if (!currentAttendingTurnId) {
        await showConfirmationModal('Atención', 'No hay un turno en curso para rellamar.');
        return;
    }
    // No necesitamos confirmación para un simple rellamado, es una acción rápida.
    // const confirmed = await showConfirmationModal('Rellamar Turno', '...');
    // if (!confirmed) return;

    btnRecall.disabled = true;
    try {
        // 1. Llamamos a nuestra API (esto no cambia)
        const response = await fetch('/api/funcionario/recall-turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turn_id: currentAttendingTurnId })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        // --- ¡ESTA ES LA CORRECCIÓN! ---
        // 2. Leemos los datos del turno DESDE EL DOM (que ya los tiene)
        const turnText = currentAttendingTurnElement.textContent; // "I-005"
        const moduleName = assignedModuleNameElement.textContent; // "Modulo 01"

        const turnParts = turnText.split('-');
        const turnPrefix = turnParts[0];
        const turnNumber = parseInt(turnParts[1], 10);
        
        // 3. Enviamos un broadcast con TODA la información
        console.log("Enviando evento de broadcast 'rellamar' con datos completos");
        turnosChannel.send({
            type: 'broadcast',
            event: 'rellamar',
            payload: { 
                id_turno: currentAttendingTurnId,
                prefijo_turno: turnPrefix,
                numero_turno: turnNumber,
                nombre_modulo: moduleName
            },
        });
        // --- FIN DE LA CORRECCIÓN ---

        console.log(`Turno ${currentAttendingTurnId} rellamado.`);
    } catch (error) {
        console.error("Error al rellamar turno:", error.message);
        await showConfirmationModal('Error', `Error al rellamar turno: ${error.message}`);
    } finally {
        // Hacemos que el botón se reactive después de 1 segundo para evitar spam
        setTimeout(() => {
            btnRecall.disabled = false;
            updateButtonStates();
        }, 1000);
    }
});

btnFinish.addEventListener('click', async () => {
    if (!currentAttendingTurnId) {
        await showConfirmationModal('Atención', 'No hay un turno en curso para finalizar.');
        return;
    }
    const confirmed = await showConfirmationModal('Finalizar Turno', '¿Está seguro de que desea finalizar el turno actual?');
    if (!confirmed) return;

    btnFinish.disabled = true;
    try {
        const finishedTurnId = currentAttendingTurnId; 

        // 1. Llamamos a nuestra API. Su único trabajo es actualizar la BD.
        const response = await fetch('/api/funcionario/finish-turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turn_id: currentAttendingTurnId })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        console.log(`Turno ${finishedTurnId} finalizado.`);
        currentAttendingTurnId = null;

        // --- ¡EL BROADCAST SE HA ELIMINADO! ---
        // Ya no enviamos un 'turno_finalizado'.
        // Confiamos en que el 'postgres_changes' (de la BD) 
        // hará el trabajo de actualizar la UI.
        
    } catch (error) {
        console.error("Error al finalizar turno:", error.message);
        await showConfirmationModal('Error', `Error al finalizar turno: ${error.message}`);
    } finally {
        // El 'postgres_changes' se encargará de re-habilitar los botones
        // llamando a updateButtonStates() a través del debouncer.
        updateButtonStates();
    }
});

silenceAlertBtn.addEventListener('click', () => {
    turnosChannel.send({
        type: 'broadcast',
        event: 'silence_alert',
        payload: { message: 'Por favor, guardar silencio' }
    });
    console.log("Alerta de silencio enviada.");
});

transferModalConfirmBtn.addEventListener('click', handleTransferConfirm);
transferModalCancelBtn.addEventListener('click', () => {
    transferModal.classList.add('hidden');
});

window.openTransferModal = openTransferModal;

// ==========================================================
// INICIO DE LA APLICACIÓN (MODIFICADO)
// ==========================================================
async function init() {
    console.log("Inicializando panel de funcionario...");
    await updateAssignedModuleName(); // Esta es separada y está bien
    await loadAllPanelData();         // Llamamos a nuestra nueva función
    // updateButtonStates(); // loadAllPanelData() ya llama a esto
    setupRealtimeSubscriptions();
    console.log("Panel inicializado.");
}

document.addEventListener('DOMContentLoaded', init);