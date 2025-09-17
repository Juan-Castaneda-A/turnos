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
    if (window.ASSIGNED_MODULE_ID !== null) {
        try {
            const { data, error } = await supabase
                .from('modulos')
                .select('nombre_modulo')
                .eq('id_modulo', window.ASSIGNED_MODULE_ID)
                .single();
            if (error) throw error;
            assignedModuleNameElement.textContent = data.nombre_modulo;
            myModuleTitleElement.textContent = `Mi Módulo: ${data.nombre_modulo}`;
        } catch (error) {
            console.error("Error al obtener nombre del módulo:", error.message);
            assignedModuleNameElement.textContent = 'Error';
            myModuleTitleElement.textContent = 'Mi Módulo: Error';
        }
    } else {
        assignedModuleNameElement.textContent = 'No Asignado';
        myModuleTitleElement.textContent = 'Mi Módulo: No Asignado';
        btnCallNext.disabled = true;
        btnRecall.disabled = true;
        btnFinish.disabled = true;
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
        // Primero obtenemos los servicios del módulo
        const { data: moduleServices, error: msError } = await supabase
            .from('modulos_servicios')
            .select('id_servicio')
            .eq('id_modulo', window.ASSIGNED_MODULE_ID);

        if (msError) throw msError;

        const serviceIds = moduleServices.map(ms => ms.id_servicio);

        if (serviceIds.length === 0) {
            pendingTurnsBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">Este módulo no tiene servicios configurados.</td></tr>`;
            btnCallNext.disabled = true;
            return;
        }

        // Luego obtenemos los turnos pendientes para esos servicios
        const { data: turns, error: turnsError } = await supabase
            .from('turnos')
            .select('id_turno, prefijo_turno, numero_turno, hora_solicitud, servicios(nombre_servicio)')
            .eq('estado', 'en espera')
            .in('id_servicio', serviceIds)
            .order('hora_solicitud', { ascending: true });

        if (turnsError) throw turnsError;

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
        console.error("Error al cargar turnos pendientes:", error);
        pendingTurnsBody.innerHTML = `
    <tr>
        <td colspan="2" class="text-center text-red-400 py-4">
            Error al cargar turnos: ${error.message}
        </td>
    </tr>`;
        btnCallNext.disabled = true;
    }
    updateButtonStates();
}

async function loadCurrentTurn() {
    if (window.ASSIGNED_MODULE_ID === null) {
        currentAttendingTurnElement.textContent = '---';
        currentAttendingServiceElement.textContent = 'Módulo no asignado.';
        currentAttendingClientElement.textContent = '-'; // Limpiar nombre del cliente
        currentAttendingTurnId = null;
        updateButtonStates();
        return;
    }

    try {
        console.log(`Buscando turno en atención para módulo ${window.ASSIGNED_MODULE_ID}`);

        // Cambiar a .maybeSingle() para manejar casos sin resultados
        const { data: turns, error } = await supabase
            .from('turnos')
            .select(`
        id_turno,
        prefijo_turno,
        numero_turno,
        servicios:id_servicio(nombre_servicio),
        clientes:id_cliente(nombre_completo)
    `)
            .eq('estado', 'en atencion')
            .eq('id_modulo_atencion', window.ASSIGNED_MODULE_ID)
            .order('hora_llamado', { ascending: false })
            .limit(1);

        if (error) {
            console.error("Error en la consulta:", error);
            throw error;
        }

        console.log("Resultado de la consulta:", turns);

        if (turns && turns.length > 0) {
            const turn = turns[0];
            const turnNumber = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
            const serviceName = turn.servicios?.nombre_servicio || 'Servicio desconocido';

            console.log(`Turno actual encontrado: ${turnNumber} - ${serviceName}`);

            const clientName = turn.clientes?.nombre_completo || 'N/A';


            currentAttendingTurnElement.textContent = turnNumber;
            currentAttendingServiceElement.textContent = serviceName;
            currentAttendingClientElement.textContent = clientName; // <-- MOSTRAMOS EL NOMBRE

            currentAttendingTurnId = turn.id_turno;
        } else {
            console.log("No hay turno en atención actualmente");
            currentAttendingTurnElement.textContent = '---';
            currentAttendingServiceElement.textContent = 'Esperando nuevo turno...';
            currentAttendingClientElement.textContent = '-'; // Limpiar nombre del cliente

            currentAttendingTurnId = null;
        }
    } catch (error) {
        console.error("Error al cargar turno actual:", error);
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
        const today = new Date().toISOString().split('T')[0];
        const { data: history, error } = await supabase
            .from('turnos')
            .select('*')
            .eq('estado', 'atendido')
            .eq('id_modulo_atencion', window.ASSIGNED_MODULE_ID)
            .gte('hora_finalizacion', today)
            .order('hora_finalizacion', { ascending: false });

        if (error) throw error;

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

    turnosChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' },
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
    const confirmed = await showConfirmationModal('Llamar Siguiente Turno', '¿Está seguro de que desea llamar al siguiente turno disponible?');
    if (!confirmed) return;

    btnCallNext.disabled = true;
    try {
        console.log("Obteniendo servicios del módulo...");
        const { data: moduleServices, error: msError } = await supabase
            .from('modulos_servicios')
            .select('id_servicio')
            .eq('id_modulo', window.ASSIGNED_MODULE_ID);

        if (msError) throw msError;

        const serviceIds = moduleServices.map(ms => ms.id_servicio);
        console.log("Servicios del módulo:", serviceIds);

        if (serviceIds.length === 0) {
            throw new Error("Este módulo no tiene servicios configurados");
        }

        console.log("Buscando siguiente turno disponible...");
        const { data: nextTurn, error: nextTurnError } = await supabase
            .from('turnos')
            .select('id_turno, prefijo_turno, numero_turno, id_servicio, servicios(nombre_servicio)')
            .eq('estado', 'en espera')
            .in('id_servicio', serviceIds)
            .order('hora_solicitud', { ascending: true })
            .limit(1)
            .maybeSingle();

        if (nextTurnError) throw nextTurnError;

        if (!nextTurn) {
            console.log("No hay turnos pendientes para llamar");
            await showConfirmationModal('Atención', 'No hay turnos pendientes para llamar.');
            return;
        }

        console.log(`Llamando turno ${nextTurn.prefijo_turno}-${nextTurn.numero_turno}`);

        // Objeto de actualización sin id_funcionario
        const updateData = {
            estado: 'en atencion',
            hora_llamado: new Date().toISOString(),
            id_modulo_atencion: window.ASSIGNED_MODULE_ID
        };

        // Si la columna id_funcionario existe en tu tabla, descomenta esta línea:
        // updateData.id_funcionario = USER_ID;

        const { error: updateError } = await supabase
            .from('turnos')
            .update(updateData)
            .eq('id_turno', nextTurn.id_turno);

        if (updateError) throw updateError;

        // Enviamos un mensaje explícito al visualizador con los datos del nuevo turno.
        console.log("Enviando evento de broadcast 'nuevo_llamado'");
        
        const { data: moduloData } = await supabase.from('modulos').select('nombre_modulo').eq('id_modulo', window.ASSIGNED_MODULE_ID).single();

        turnosChannel.send({
            type: 'broadcast',
            event: 'nuevo_llamado',
            payload: {
                id_turno: nextTurn.id_turno,
                prefijo_turno: nextTurn.prefijo_turno,
                numero_turno: nextTurn.numero_turno,
                nombre_modulo: moduloData.nombre_modulo
            },
        });

        console.log("Registrando log de llamado...");
        await supabase.from('logs_turnos').insert({
            id_turno: nextTurn.id_turno,
            id_usuario: window.USER_ID,
            accion: 'llamado',
            detalles: `Turno ${nextTurn.prefijo_turno}-${nextTurn.numero_turno} llamado al módulo ${window.ASSIGNED_MODULE_ID}`
        });

        console.log("Actualizando interfaz...");
        await loadCurrentTurn();
        await loadPendingTurns();

    } catch (error) {
        console.error("Error al llamar siguiente turno:", error);
        await showConfirmationModal('Error', `Error al llamar turno: ${error.message}`);
    } finally {
        updateButtonStates();
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
        const { error: updateError } = await supabase
            .from('turnos')
            .update({ hora_llamado: new Date().toISOString() })
            .eq('id_turno', currentAttendingTurnId);

        if (updateError) throw updateError;

        // --- AÑADE ESTA SECCIÓN ---
        // Envía un mensaje directo al canal del visualizador
        console.log("Enviando evento de broadcast 'rellamar'");
        turnosChannel.send({
            type: 'broadcast',
            event: 'rellamar',
            payload: { id_turno: currentAttendingTurnId },
        });
        // --- FIN DE LA SECCIÓN A AÑADIR ---

        await supabase.from('logs_turnos').insert({
            id_turno: currentAttendingTurnId,
            id_usuario: window.USER_ID,
            accion: 'rellamado'
        });

        console.log(`Turno ${currentAttendingTurnId} rellamado.`);
    } catch (error) {
        console.error("Error al rellamar turno:", error.message);
        await showConfirmationModal('Error', `Error al rellamar turno: ${error.message}`);
    } finally {
        btnRecall.disabled = false;
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

        const finishedTurnId = currentAttendingTurnId; // Guardamos el ID antes de finalizar

        const { error: updateError } = await supabase
            .from('turnos')
            .update({
                estado: 'atendido',
                hora_finalizacion: new Date().toISOString()
            })
            .eq('id_turno', currentAttendingTurnId);

        if (updateError) throw updateError;

        await supabase.from('logs_turnos').insert({
            id_turno: finishedTurnId,
            id_usuario: window.USER_ID,
            accion: 'finalizado'
        });

        console.log(`Turno ${finishedTurnId} finalizado.`);
        currentAttendingTurnId = null;

        //le decimos explícitamente a la UI que se actualice AHORA MISMO
        await loadCurrentTurn();
        await loadDailyHistory();
        //también enviamos un mensaje para que el visualizador se entere
        turnosChannel.send({
            type: 'broadcast',
            event: 'turno_finalizado',
            payload: { id_turno: finishedTurnId }
        });
    } catch (error) {
        console.error("Error al finalizar turno:", error.message);
        await showConfirmationModal('Error', `Error al finalizar turno: ${error.message}`);
    } finally {
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

// function cleanupRealtimeSubscriptions() {
//     if (channels && channels.length > 0) {
//         console.log("Limpiando suscripciones existentes...");
//         channels.forEach(channel => {
//             try {
//                 supabase.removeChannel(channel);
//             } catch (e) {
//                 console.warn("Error al limpiar canal:", e);
//             }
//         });
//         channels = [];
//     }
// }

// window.onload = async () => {
//     console.log("Inicializando panel de funcionario...");
//     console.log("Usuario ID:", window.USER_ID);
//     console.log("Módulo asignado ID:", window.ASSIGNED_MODULE_ID);

//     await updateAssignedModuleName();
//     console.log("Nombre del módulo actualizado");

//     await loadPendingTurns();
//     console.log("Turnos pendientes cargados");

//     await loadCurrentTurn();
//     console.log("Turno actual cargado");

//     await loadDailyHistory();
//     console.log("Historial diario cargado");

//     setupRealtimeSubscriptions();
//     console.log("Suscripciones en tiempo real configuradas");
// };
// turnosChannel.subscribe();

document.addEventListener('DOMContentLoaded', init);