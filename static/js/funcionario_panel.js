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

async function updateAssignedModuleName() {
    try {
        const response = await fetch('/api/funcionario/get-module-name');
        const result = await response.json();
        
        if (!response.ok || !result.success) {
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
        assignedModuleNameElement.textContent = 'Error';
        myModuleTitleElement.textContent = 'Mi Módulo: Error';
    }
}

async function loadPendingTurns() {
    pendingTurnsBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">Cargando turnos...</td></tr>`;

    if (window.ASSIGNED_MODULE_ID === null) {
        pendingTurnsBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">Asigne un módulo a este funcionario para ver turnos.</td></tr>`;
        btnCallNext.disabled = true;
        return;
    }

    try {
        // 1. Llamamos a nuestra nueva API segura
        const response = await fetch('/api/funcionario/get-pending-turns');
        const result = await response.json();

        if (!response.ok || !result.success) {
            // Si el error es "No hay módulo", lo mostramos
            if (result.error === "Funcionario no tiene módulo asignado") {
                pendingTurnsBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">No tiene módulo asignado.</td></tr>`;
                btnCallNext.disabled = true;
                return;
            }
            throw new Error(result.error);
        }

        const turns = result.turns; // ¡Obtenemos los turnos ya ordenados!

        // 2. Guardamos los turnos para el botón "Llamar Siguiente"
        sortedPendingTurns = turns; 

        // 3. El resto de tu lógica para "pintar" la tabla es IDÉNTICA
        pendingTurnsBody.innerHTML = '';
        if (turns.length === 0) {
            pendingTurnsBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">No hay turnos pendientes.</td></tr>`;
            btnCallNext.disabled = true;
        } else {
            turns.forEach(turn => {
                const tr = document.createElement('tr');
                tr.className = 'table-row';
                tr.innerHTML = `
                    <td class="px-4 py-2">${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}</td>
                    <td class="px-4 py-2">${turn.servicios?.nombre_servicio || 'Servicio no disponible'}</td>
                `;
                pendingTurnsBody.appendChild(tr);
            });
            btnCallNext.disabled = false;
        }
    } catch (error) {
        console.error("Error al cargar turnos pendientes:", error.message);
        pendingTurnsBody.innerHTML = `<tr><td colspan="2" class="text-center text-red-400 py-4">Error al cargar turnos.</td></tr>`;
        btnCallNext.disabled = true;
    }
    updateButtonStates();
}

async function loadCurrentTurn() {
    if (window.ASSIGNED_MODULE_ID === null) {
        currentAttendingTurnElement.textContent = '---';
        currentAttendingServiceElement.textContent = 'Módulo no asignado.';
        currentAttendingClientElement.textContent = '-';
        currentAttendingTurnId = null;
        updateButtonStates();
        return;
    }

    try {
        const response = await fetch('/api/funcionario/get-current-turn');
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        const turn = result.turn; // Puede ser 'null' si no hay turno

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
    } catch (error) {
        console.error("Error al cargar turno actual:", error.message);
        currentAttendingTurnElement.textContent = 'Error';
        currentAttendingServiceElement.textContent = 'Error al cargar turno.';
        currentAttendingClientElement.textContent = 'Error';
        currentAttendingTurnId = null;
    }
    updateButtonStates();
}

async function loadDailyHistory() {
    dailyHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">Cargando historial...</td></tr>`;
    if (window.ASSIGNED_MODULE_ID === null) {
        dailyHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">Asigne un módulo a este funcionario para ver historial.</td></tr>`;
        return;
    }

    try {
        const response = await fetch('/api/funcionario/get-daily-history');
        const result = await response.json();
        
        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }
        
        const history = result.history;

        // El resto de tu lógica para "pintar" la tabla es IDÉNTICA
        dailyHistoryBody.innerHTML = '';
        if (history.length === 0) {
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
    } catch (error) {
        console.error("Error al cargar historial diario:", error.message);
        dailyHistoryBody.innerHTML = `<tr><td colspan="2" class="text-center text-red-400 py-4">Error al cargar historial.</td></tr>`;
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

function setupRealtimeSubscriptions() {
    console.log("Configurando suscripciones en tiempo real para el panel...");

    turnosChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'turnos', filter: `id_organizacion=eq.${window.ORGANIZACION_ID}` },
        (payload) => {
            console.log(`Cambio en 'turnos' detectado: ${payload.eventType}`);

            switch (payload.eventType) {
                case 'INSERT':
                    // Un nuevo turno fue solicitado por un cliente.
                    // Todos los funcionarios deben actualizar su lista de pendientes.
                    console.log("Nuevo turno en espera. Actualizando lista de pendientes.");
                    loadPendingTurns();
                    break;

                case 'UPDATE':
                    // Un turno fue modificado. Lo más común es un cambio de estado.

                    // 1. SIEMPRE actualizamos la lista de pendientes.
                    // Si otro funcionario llamó un turno, éste desaparece de la lista de pendientes.
                    loadPendingTurns();

                    // 2. Verificamos si el cambio fue una FINALIZACIÓN.
                    // Esto es mucho más preciso que solo mirar el nuevo estado.
                    if (payload.old.estado === 'en atencion' && payload.new.estado === 'atendido') {
                        console.log("Un turno fue finalizado. Actualizando el historial del día.");
                        
                        // Recargamos el historial. Tu función ya filtra por tu módulo, así que es seguro.
                        loadDailyHistory();
                        
                        // ADICIONAL: Si el turno finalizado era el que TÚ estabas atendiendo,
                        // debemos limpiar tu panel de "Turno Actual".
                        if (payload.old.id_turno === currentAttendingTurnId) {
                             console.log("Era mi turno, limpiando el panel de atención actual.");
                             loadCurrentTurn(); // Esta función ya sabe mostrar "---" si no hay turno.
                        }
                    }
                    break;
                
                case 'DELETE':
                    // Si por alguna razón se elimina un turno, actualizamos la lista.
                    console.log("Un turno fue eliminado. Actualizando lista de pendientes.");
                    loadPendingTurns();
                    break;
            }
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
        await loadCurrentTurn();
        await loadPendingTurns();

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
    const confirmed = await showConfirmationModal('Rellamar Turno', '¿Está seguro de que desea rellamar el turno actual?');
    if (!confirmed) return;

    btnRecall.disabled = true;
    try {
        // 1. Llamamos a nuestra API
        const response = await fetch('/api/funcionario/recall-turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turn_id: currentAttendingTurnId })
        });
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        // 2. Enviamos el broadcast (¡esto no cambia!)
        console.log("Enviando evento de broadcast 'rellamar'");
        turnosChannel.send({
            type: 'broadcast',
            event: 'rellamar',
            payload: { id_turno: currentAttendingTurnId },
        });

        console.log(`Turno ${currentAttendingTurnId} rellamado.`);
    } catch (error) {
        console.error("Error al rellamar turno:", error.message);
        await showConfirmationModal('Error', `Error al rellamar turno: ${error.message}`);
    } finally {
        btnRecall.disabled = false; // El botón se puede volver a presionar
        updateButtonStates();
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

        // 1. Llamamos a nuestra API (esto no cambia)
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

        // --- ¡LÍNEAS ELIMINADAS! ---
        // Ya no llamamos a loadCurrentTurn() ni loadDailyHistory() aquí.
        // Dejaremos que el evento de Realtime (que se recibe 1ms después)
        // se encargue de actualizar la UI.
        // await loadCurrentTurn();  <-- ELIMINADA
        // await loadDailyHistory(); <-- ELIMINADA
        
        // 3. Enviamos el broadcast (esto no cambia y ahora es lo único que actualiza la UI)
        turnosChannel.send({
            type: 'broadcast',
            event: 'turno_finalizado',
            payload: { id_turno: finishedTurnId }
        });
        
    } catch (error) {
        console.error("Error al finalizar turno:", error.message);
        await showConfirmationModal('Error', `Error al finalizar turno: ${error.message}`);
    } finally {
        // 'updateButtonStates()' sigue aquí, pero las llamadas de Realtime
        // lo volverán a llamar, asegurando el estado correcto.
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

// ==========================================================
// INICIO DE LA APLICACIÓN
// ==========================================================
// (Función autoejecutable que se corre al cargar el script)
async function init() {
    console.log("Inicializando panel de funcionario...");
    await updateAssignedModuleName();
    await loadPendingTurns();
    await loadCurrentTurn();
    await loadDailyHistory();
    updateButtonStates();
    setupRealtimeSubscriptions();
    console.log("Panel inicializado.");
}

document.addEventListener('DOMContentLoaded', init);