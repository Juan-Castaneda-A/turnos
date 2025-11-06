// ==========================================================
// IMPORTACIÓN Y CONFIGURACIÓN INICIAL
// ==========================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';

// Inicializar Supabase
//const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
//console.log("Supabase Client inicializado para Panel de Funcionario.");
//console.log("Objeto Supabase:", supabase);
//console.log("¿Existe supabase.from?", typeof supabase.from);

//const turnosChannel = supabase.channel('turnos_channel'); // Dale un nombre específico
let supabase, turnosChannel;

// ==========================================================
// REFERENCIAS AL DOM
// ==========================================================
let assignedModuleNameElement, myModuleTitleElement, pendingTurnsBody,
    currentAttendingTurnElement, currentAttendingServiceElement, currentAttendingClientElement,
    btnCallNext, btnRecall, btnFinish, dailyHistoryBody,
    confirmationModal, modalTitle, modalMessage, modalConfirmBtn, modalCancelBtn,
    silenceAlertBtn,
    transferModal, transferModalTitle, transferModuleSelect,
    transferModalConfirmBtn, transferModalCancelBtn, btnTransferCurrent, chatModal, openChatBtn, closeChatBtn, chatRoomList, chatMessageHeader,
    chatMessageArea, chatMessageForm, chatMessageInput, chatSendBtn;

let currentAttendingTurnId = null;
let sortedPendingTurns = [];

let currentChatRoomId = null; // Para saber qué sala estamos viendo
let userCacheMap = new Map();

// ==========================================================
// INICIO DE LA APLICACIÓN (Punto de entrada)
// ==========================================================
document.addEventListener('DOMContentLoaded', init);

async function init() {
    console.log("Inicializando panel de funcionario...");

    supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
    turnosChannel = supabase.channel('turnos_channel');
    console.log("Supabase Client inicializado para Panel de Funcionario.");

    assignedModuleNameElement = document.getElementById('assigned-module-name');
    myModuleTitleElement = document.getElementById('my-module-title');
    pendingTurnsBody = document.getElementById('pending-turns-body');
    currentAttendingTurnElement = document.getElementById('current-attending-turn');
    currentAttendingServiceElement = document.getElementById('current-attending-service');
    currentAttendingClientElement = document.getElementById('current-attending-client');
    btnCallNext = document.getElementById('btn-call-next');
    btnRecall = document.getElementById('btn-recall');
    btnFinish = document.getElementById('btn-finish');
    dailyHistoryBody = document.getElementById('daily-history-body');
    confirmationModal = document.getElementById('confirmation-modal');
    modalTitle = document.getElementById('modal-title');
    modalMessage = document.getElementById('modal-message');
    modalConfirmBtn = document.getElementById('modal-confirm-btn');
    modalCancelBtn = document.getElementById('modal-cancel-btn');
    silenceAlertBtn = document.getElementById('silence-alert-btn');

    // Asignamos el nuevo modal de transferencia
    transferModal = document.getElementById('transfer-modal');
    transferModalTitle = document.getElementById('transfer-modal-title');
    transferModuleSelect = document.getElementById('transfer-module-select');
    transferModalConfirmBtn = document.getElementById('transfer-modal-confirm-btn');
    transferModalCancelBtn = document.getElementById('transfer-modal-cancel-btn'); // <-- El que daba error
    btnTransferCurrent = document.getElementById('btn-transfer-current'); // <-- El nuevo botón

    chatModal = document.getElementById('chat-modal');
    openChatBtn = document.getElementById('open-chat-btn');
    closeChatBtn = document.getElementById('close-chat-btn');
    chatRoomList = document.getElementById('chat-room-list');
    chatMessageHeader = document.getElementById('chat-message-header');
    chatMessageArea = document.getElementById('chat-message-area');
    chatMessageForm = document.getElementById('chat-message-form');
    chatMessageInput = document.getElementById('chat-message-input');
    chatSendBtn = document.getElementById('chat-send-btn');

    openChatBtn.addEventListener('click', openChat);
    closeChatBtn.addEventListener('click', closeChat);
    chatMessageForm.addEventListener('submit', handleSendMessage);

    loadUserCache();

    // 4. ASIGNAMOS TODOS LOS EVENT LISTENERS (AHORA ES SEGURO)
    btnCallNext.addEventListener('click', onCallNext);
    btnRecall.addEventListener('click', onRecall);
    btnFinish.addEventListener('click', onFinish);
    silenceAlertBtn.addEventListener('click', onSilenceAlert);

    transferModalCancelBtn.addEventListener('click', () => {
        transferModal.classList.add('hidden');
    });

    transferModalConfirmBtn.addEventListener('click', handleTransferConfirm);

    btnTransferCurrent.addEventListener('click', () => {
        const turnId = currentAttendingTurnId;
        const turnName = currentAttendingTurnElement.textContent;
        if (!turnId) return; // No hacer nada si no hay turno

        // Reutilizamos la misma función del modal de transferencia
        openTransferModal(turnId, turnName);
    });

    await updateAssignedModuleName();
    await loadPendingTurns();
    await loadCurrentTurn();
    await loadDailyHistory();
    updateButtonStates();
    setupRealtimeSubscriptions();
    console.log("Panel inicializado.");

}

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
        const { data: moduleServices, error: msError } = await supabase
            .from('modulos_servicios')
            .select('id_servicio, prioridad')
            .eq('id_modulo', window.ASSIGNED_MODULE_ID);

        if (msError) throw msError;

        if (moduleServices.length === 0) {
            pendingTurnsBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">Este módulo no tiene servicios configurados.</td></tr>`;
            btnCallNext.disabled = true;
            return;
        }

        const priorityMap = new Map(moduleServices.map(ms => [ms.id_servicio, ms.prioridad]));
        const serviceIds = moduleServices.map(ms => ms.id_servicio);

        const { data: turns, error: turnsError } = await supabase
            .from('turnos')
            // Corregimos la ambigüedad aquí también, por si acaso
            .select('id_turno, prefijo_turno, numero_turno, hora_solicitud, id_servicio, servicios:id_servicio(nombre_servicio)')
            .eq('estado', 'en espera')
            .in('id_servicio', serviceIds)
            .is('id_modulo_reasignado', null) // <-- Solo turnos que no han sido reasignados a otro
            .order('hora_solicitud', { ascending: true });

        if (turnsError) throw turnsError;

        // --- LÓGICA DE TURNOS REASIGNADOS ---
        // (Esta es la lógica que faltaba en tu versión vieja)
        const { data: reasignedTurns, error: reasignedError } = await supabase
            .from('turnos')
            .select('id_turno, prefijo_turno, numero_turno, hora_solicitud, id_servicio, servicios:id_servicio(nombre_servicio)')
            .eq('estado', 'en espera')
            .eq('id_modulo_reasignado', window.ASSIGNED_MODULE_ID); // <-- Turnos reasignados A MÍ

        if (reasignedError) throw reasignedError;

        // Combinamos las dos listas
        const allPendingTurns = [...turns, ...reasignedTurns];

        // Ordenamos los turnos
        allPendingTurns.sort((a, b) => {
            // Damos prioridad 0 (la más alta) a los turnos reasignados
            const priorityA = a.id_modulo_reasignado === window.ASSIGNED_MODULE_ID ? 0 : (priorityMap.get(a.id_servicio) ?? 99);
            const priorityB = b.id_modulo_reasignado === window.ASSIGNED_MODULE_ID ? 0 : (priorityMap.get(b.id_servicio) ?? 99);

            if (priorityA < priorityB) return -1;
            if (priorityA > priorityB) return 1;

            return new Date(a.hora_solicitud) - new Date(b.hora_solicitud);
        });

        sortedPendingTurns = allPendingTurns; // Guardamos la lista ordenada

        // Renderizamos
        pendingTurnsBody.innerHTML = '';
        if (allPendingTurns.length === 0) {
            pendingTurnsBody.innerHTML = `<tr><td colspan="2" class="text-center text-gray-500 py-4">No hay turnos pendientes.</td></tr>`;
            btnCallNext.disabled = true;
        } else {
            allPendingTurns.forEach(turn => {
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
        console.log(`Buscando turno en atención para módulo ${window.ASSIGNED_MODULE_ID}`);

        const { data: turns, error } = await supabase
            .from('turnos')
            .select(`
                id_turno, prefijo_turno, numero_turno,
                servicios:id_servicio(nombre_servicio),
                clientes:id_cliente(nombre_completo)
            `)
            .eq('estado', 'en atencion')
            .eq('id_modulo_atencion', window.ASSIGNED_MODULE_ID)
            .order('hora_llamado', { ascending: false })
            .limit(1);

        if (error) throw error;
        console.log("Resultado de la consulta:", turns);

        if (turns && turns.length > 0) {
            const turn = turns[0];
            const turnNumber = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
            const serviceName = turn.servicios?.nombre_servicio || 'Servicio desconocido';
            const clientName = turn.clientes?.nombre_completo || 'N/A';
            console.log(`Turno actual encontrado: ${turnNumber} - ${serviceName}`);
            currentAttendingTurnElement.textContent = turnNumber;
            currentAttendingServiceElement.textContent = serviceName;
            currentAttendingClientElement.textContent = clientName;
            currentAttendingTurnId = turn.id_turno;
        } else {
            console.log("No hay turno en atención actualmente");
            currentAttendingTurnElement.textContent = '---';
            currentAttendingServiceElement.textContent = 'Esperando nuevo turno...';
            currentAttendingClientElement.textContent = '-';
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

                // --- ESTA ES LA LÍNEA CORREGIDA ---
                // (Sin la celda vacía al principio)
                tr.innerHTML = `
<td class="px-4 py-2">${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}</td>
<td class="px-4 py-2">${finalizationTime}</td>
`;
                // --- FIN DE LA CORRECCIÓN ---

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
        btnTransferCurrent.disabled = true;
        return;
    }

    const hasCurrentTurn = currentAttendingTurnId !== null;
    const hasPendingTurns = pendingTurnsBody.querySelector('.table-row') !== null &&
        pendingTurnsBody.querySelector('.text-gray-500') === null &&
        pendingTurnsBody.querySelector('.text-red-400') === null;

    btnCallNext.disabled = hasCurrentTurn || !hasPendingTurns;
    btnRecall.disabled = !hasCurrentTurn;
    btnFinish.disabled = !hasCurrentTurn;
    btnTransferCurrent.disabled = !hasCurrentTurn;
}

async function openTransferModal(turnId, turnName) {
    console.log(`Abriendo modal para transferir turno: ${turnId} (${turnName})`);

    transferModal.dataset.turnId = turnId;
    transferModalTitle.textContent = `Transferir Turno ${turnName}`;
    transferModuleSelect.innerHTML = '<option value="">Cargando módulos...</option>';
    transferModal.classList.remove('hidden');

    try {
        const { data: modules, error } = await supabase
            .from('modulos')
            .select('id_modulo, nombre_modulo')
            .eq('estado', 'activo')
            .neq('id_modulo', window.ASSIGNED_MODULE_ID); // Excluir mi propio módulo

        if (error) throw error;
        const modulesData = modules;
        transferModuleSelect.innerHTML = '<option value="">-- Seleccione un módulo --</option>';

        if (modulesData.length === 0) {
            transferModuleSelect.innerHTML = '<option value="">No hay otros módulos activos</option>';
            transferModalConfirmBtn.disabled = true;
            return;
        }

        modulesData.forEach(mod => {
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

        transferModal.classList.add('hidden');
        await showConfirmationModal('Éxito', result.message);

    } catch (error) {
        console.error("Error al transferir turno:", error.message);
        await showConfirmationModal('Error', `Error al transferir: ${error.message}`);
    } finally {
        transferModalConfirmBtn.disabled = false;
        transferModalConfirmBtn.textContent = "Confirmar Transferencia";
        // Recargamos los datos ya que un turno fue modificado
        await loadCurrentTurn();
        await loadPendingTurns();
    }
}

function setupRealtimeSubscriptions() {
    console.log("Configurando suscripciones en tiempo real para el panel...");

    turnosChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' },
        (payload) => {
            console.log(`Cambio en 'turnos' detectado: ${payload.eventType}`);

            // Lógica unificada: cualquier cambio en 'turnos' recarga todo
            // para mantener la consistencia.
            loadPendingTurns();

            // Solo recargamos el turno actual si no somos nosotros los que lo estamos
            // finalizando (para evitar que se limpie antes de tiempo)
            if (payload.new.estado !== 'atendido' || payload.new.id_turno !== currentAttendingTurnId) {
                loadCurrentTurn();
            }

            if (payload.eventType === 'INSERT' ||
                (payload.old.estado !== 'atendido' && payload.new.estado === 'atendido')) {
                loadDailyHistory();
            }
        }
    ).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Panel de funcionario conectado al canal de tiempo real.');
        }
    });

    const chatMessagesChannel = supabase.channel('chat_messages_channel');
    chatMessagesChannel.on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `id_organizacion=eq.1` // ¡Asumimos Org 1!
        },
        (payload) => {
            console.log("Nuevo mensaje de chat recibido:", payload.new);
            const msg = payload.new;
            const isMe = msg.sender_id === window.USER_ID;

            // Si estamos viendo la sala correcta, renderiza el mensaje
            if (!chatModal.classList.contains('hidden') && msg.room_id === currentChatRoomId) {
                renderMessage(msg, isMe);
            } else {
                // Si no, muestra una notificación
                showChatNotification(msg.room_id);
            }
        }
    ).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Panel de funcionario conectado al canal de chat.');
        }
    });

    const chatParticipantsChannel = supabase.channel('chat_participants_channel');
    chatParticipantsChannel.on(
        'postgres_changes',
        {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_participants',
            filter: `user_id=eq.${window.USER_ID}` // ¡Cuando me añaden a MÍ!
        },
        (payload) => {
            console.log("¡Me han añadido a una nueva sala de chat!", payload.new);
            // Si el modal de chat está abierto, recarga la lista de salas
            if (!chatModal.classList.contains('hidden')) {
                loadChatRooms();
            }
        }
    ).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Panel conectado al canal de participantes de chat.');
        }
    });
}

// ==========================================================
// HANDLERS DE EVENTOS (Separados de init)
// ==========================================================
async function onCallNext() {
    if (sortedPendingTurns.length === 0) {
        await showConfirmationModal('Atención', 'No hay turnos pendientes para llamar.');
        return;
    }

    const confirmed = await showConfirmationModal('Llamar Siguiente Turno', '¿Está seguro de que desea llamar al siguiente turno disponible?');
    if (!confirmed) return;

    btnCallNext.disabled = true;
    try {
        const nextTurn = sortedPendingTurns[0];
        console.log(`Llamando turno ${nextTurn.prefijo_turno}-${nextTurn.numero_turno}`);

        const updateData = {
            estado: 'en atencion',
            hora_llamado: new Date().toISOString(),
            id_modulo_atencion: window.ASSIGNED_MODULE_ID,
            id_modulo_reasignado: null // Limpiamos la reasignación
        };

        const { error: updateError } = await supabase
            .from('turnos')
            .update(updateData)
            .eq('id_turno', nextTurn.id_turno);

        if (updateError) throw updateError;

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
            id_organizacion: 1 // <-- !!!!!!!!!!! ASUME ORG 1 !!!!!!!!!!!
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
}

async function onRecall() {
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

        console.log("Enviando evento de broadcast 'rellamar'");
        turnosChannel.send({
            type: 'broadcast',
            event: 'rellamar',
            payload: { id_turno: currentAttendingTurnId },
        });

        await supabase.from('logs_turnos').insert({
            id_turno: currentAttendingTurnId,
            id_usuario: window.USER_ID,
            accion: 'rellamado',
            id_organizacion: 1 // <-- !!!!!!!!!!! ASUME ORG 1 !!!!!!!!!!!
        });

        console.log(`Turno ${currentAttendingTurnId} rellamado.`);
    } catch (error) {
        console.error("Error al rellamar turno:", error.message);
        await showConfirmationModal('Error', `Error al rellamar turno: ${error.message}`);
    } finally {
        btnRecall.disabled = false;
        updateButtonStates();
    }
}

async function onFinish() {
    if (!currentAttendingTurnId) {
        await showConfirmationModal('Atención', 'No hay un turno en curso para finalizar.');
        return;
    }
    const confirmed = await showConfirmationModal('Finalizar Turno', '¿Está seguro de que desea finalizar el turno actual?');
    if (!confirmed) return;

    btnFinish.disabled = true;
    try {
        const finishedTurnId = currentAttendingTurnId;

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
            accion: 'finalizado',
            id_organizacion: 1 // <-- !!!!!!!!!!! ASUME ORG 1 !!!!!!!!!!!
        });

        console.log(`Turno ${finishedTurnId} finalizado.`);
        currentAttendingTurnId = null;

        await loadCurrentTurn();
        await loadDailyHistory();

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
}

function onSilenceAlert() {
    turnosChannel.send({
        type: 'broadcast',
        event: 'silence_alert',
        payload: { message: 'Por favor, guardar silencio' }
    });
    console.log("Alerta de silencio enviada.");
}

async function loadUserCache() {
    // Esta función es para poder mostrar "De: Juan" en los mensajes
    // sin tener que consultarlo cada vez.
    try {
        const { data: users, error } = await supabase.from('usuarios').select('id_usuario, nombre_completo').eq('id_organizacion', 1); // Asumimos Org 1
        if (error) throw error;

        userCacheMap.clear();
        users.forEach(user => {
            userCacheMap.set(user.id_usuario, user.nombre_completo);
        });
        console.log("Caché de usuarios cargado.");
    } catch (error) {
        console.error("Error al cargar caché de usuarios:", error.message);
    }
}

async function openChat() {
    console.log("Abriendo chat...");
    chatModal.classList.remove('hidden');
    chatMessageHeader.querySelector('h3').textContent = "Seleccione un chat";
    chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-gray-500">No hay mensajes cargados.</p></div>';
    chatMessageInput.disabled = true;
    chatSendBtn.disabled = true;
    currentChatRoomId = null;

    // Limpia la notificación del botón principal
    openChatBtn.classList.remove('animate-pulse', 'bg-red-600', 'hover:bg-red-700');
    openChatBtn.classList.add('bg-green-600', 'hover:bg-green-700');

    await loadChatRooms();
}

function closeChat() {
    chatModal.classList.add('hidden');
}

async function loadChatRooms() {
    chatRoomList.innerHTML = '<p class="text-gray-500 text-sm p-4 text-center">Cargando chats...</p>';
    try {
        // 1. Cargamos las salas "normales" (como el Chat Global)
        const response = await fetch('/api/chat/rooms');
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error);

        chatRoomList.innerHTML = ''; // Limpiamos "Cargando..."

        // Renderizamos las salas (Chat Global)
        result.rooms.forEach(room => {
            const roomElement = document.createElement('button');
            roomElement.className = "w-full text-left px-4 py-3 rounded-lg text-gray-200 hover:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:bg-blue-600 font-bold";
            roomElement.textContent = `🌐 ${room.nombre}`; // Añadimos un ícono
            roomElement.dataset.roomId = room.id;
            roomElement.dataset.roomName = room.nombre;

            // Este onclick es el "viejo"
            roomElement.onclick = () => {
                selectChatRoom(room.id, room.nombre);
            };
            chatRoomList.appendChild(roomElement);
        });

        // 2. Añadimos un divisor
        const divider = document.createElement('hr');
        divider.className = 'border-gray-700 my-2';
        chatRoomList.appendChild(divider);

        // 3. Renderizamos los usuarios del caché (el que carga loadUserCache())
        if (userCacheMap.size === 0) {
            await loadUserCache(); // Por si acaso no se ha cargado
        }

        userCacheMap.forEach((userName, userId) => {
            // No mostrarme a mí mismo en la lista de DMs
            if (userId === window.USER_ID) return;

            const userElement = document.createElement('button');
            userElement.className = "w-full text-left px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-700 focus:outline-none focus:ring-blue-500 focus:bg-blue-600";
            userElement.textContent = `👤 ${userName}`; // Añadimos ícono
            userElement.dataset.userId = userId;
            userElement.dataset.userName = userName;

            // Este onclick es el "nuevo"
            userElement.onclick = () => {
                openDirectMessage(userId, userName);
            };
            chatRoomList.appendChild(userElement);
        });


    } catch (error) {
        console.error("Error al cargar salas de chat:", error.message);
        chatRoomList.innerHTML = '<p class="text-red-400 text-sm p-4 text-center">Error al cargar chats.</p>';
    }
}

async function openDirectMessage(targetUserId, targetUserName) {
    console.log(`Intentando abrir DM con ${targetUserName} (ID: ${targetUserId})`);
    // Mostramos un "cargando" temporal en el chat
    chatMessageHeader.querySelector('h3').textContent = `Conectando con ${targetUserName}...`;
    chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-gray-500">Creando chat...</p></div>';
    currentChatRoomId = null; // Reseteamos la sala actual

    try {
        const response = await fetch('/api/chat/get-or-create-dm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_user_id: targetUserId })
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error);

        // ¡Éxito! La API nos dio la room_id (nueva o vieja)
        // Ahora la seleccionamos
        selectChatRoom(result.room_id, targetUserName);

    } catch (error) {
        console.error("Error al crear o encontrar el DM:", error.message);
        chatMessageArea.innerHTML = `<p class="text-red-400">Error: ${error.message}</p>`;
    }
}

async function selectChatRoom(roomId, roomName) {
    console.log(`Seleccionando sala: ${roomName} (ID: ${roomId})`);
    currentChatRoomId = roomId;

    // Limpia la notificación de esa sala
    const roomButton = document.querySelector(`#chat-room-list button[data-room-id="${roomId}"]`);
    if (roomButton) {
        const dot = roomButton.querySelector('.notification-dot');
        if (dot) dot.remove();
    }

    chatMessageHeader.querySelector('h3').textContent = roomName;
    chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-gray-500">Cargando mensajes...</p></div>';
    chatMessageInput.disabled = false;
    chatSendBtn.disabled = false;
    chatMessageInput.focus();

    await loadChatMessages(roomId);
}

async function loadChatMessages(roomId) {
    try {
        const response = await fetch(`/api/chat/messages/${roomId}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error);

        chatMessageArea.innerHTML = '';

        if (result.messages.length === 0) {
            chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-gray-500">No hay mensajes. ¡Sé el primero en saludar!</p></div>';
            return;
        }

        result.messages.forEach(msg => {
            const isMe = msg.sender_id === window.USER_ID;
            renderMessage(msg, isMe);
        });

        chatMessageArea.scrollTop = chatMessageArea.scrollHeight; // Scroll al fondo

    } catch (error) {
        console.error("Error al cargar mensajes:", error.message);
        chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-red-400">Error al cargar mensajes.</p></div>';
    }
}

function renderMessage(message, isMe) {
    // Si el área de "No hay mensajes" está visible, la borra
    const placeholder = chatMessageArea.querySelector('.text-gray-500');
    if (placeholder) placeholder.parentElement.remove();

    const bubble = document.createElement('div');

    // 1. Clases con 'w-fit' para que la burbuja se encoja
    const bubbleClasses = isMe
        ? 'flex flex-col w-fit bg-blue-600 text-white p-3 rounded-lg max-w-xs self-end'
        : 'flex flex-col w-fit bg-gray-700 text-gray-200 p-3 rounded-lg max-w-xs self-start';
    bubble.className = bubbleClasses;

    // (Obtenemos los datos como antes)
    let senderName = 'Usuario Desconocido';
    if (isMe) {
        senderName = 'Tú';
    } else if (message.sender && message.sender.nombre_completo) {
        senderName = message.sender.nombre_completo;
    } else if (message.sender_id) {
        senderName = userCacheMap.get(message.sender_id) || 'Usuario';
    }
    const sentTime = new Date(message.sent_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    // --- 2. ¡LA CORRECCIÓN! ---
    // El HTML está todo en una sola línea, sin espacios ni saltos de línea.
    bubble.innerHTML = `<span class="font-bold text-sm ${isMe ? 'text-blue-200' : 'text-green-300'}">${senderName}</span><p class="text-base break-words">${message.content}</p><span class="text-xs opacity-70 mt-1 self-end">${sentTime}</span>`;
    // --- FIN DE LA CORRECCIÓN ---

    // El contenedor debe ser 'flex' para que 'self-start' y 'self-end' funcionen
    chatMessageArea.style.display = 'flex';
    chatMessageArea.style.flexDirection = 'column';
    chatMessageArea.style.gap = '0.75rem'; // espacio entre burbujas

    chatMessageArea.appendChild(bubble);
    chatMessageArea.scrollTop = chatMessageArea.scrollHeight;
}

async function handleSendMessage(event) {
    event.preventDefault();
    const content = chatMessageInput.value;

    if (!content.trim() || !currentChatRoomId) return;

    chatMessageInput.disabled = true;
    chatSendBtn.disabled = true;

    try {
        const response = await fetch('/api/chat/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                room_id: currentChatRoomId,
                content: content
            })
        });

        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error);
        chatMessageInput.value = '';

    } catch (error) {
        console.error("Error al enviar mensaje:", error.message);
    } finally {
        chatMessageInput.disabled = false;
        chatSendBtn.disabled = false;
        chatMessageInput.focus();
    }
}

function showChatNotification(roomId) {
    openChatBtn.classList.add('animate-pulse');
    openChatBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
    openChatBtn.classList.add('bg-red-600', 'hover:bg-red-700');

    const roomButton = document.querySelector(`#chat-room-list button[data-room-id="${roomId}"]`);
    if (roomButton && !roomButton.querySelector('.notification-dot')) {
        const dot = document.createElement('span');
        dot.className = 'notification-dot w-3 h-3 bg-red-500 rounded-full inline-block ml-2';
        roomButton.appendChild(dot);
    }
}

// ==========================================================
// EVENT LISTENERS PARA LOS BOTONES
// ==========================================================

// btnCallNext.addEventListener('click', async () => {

//     if (sortedPendingTurns.length === 0) {
//         await showConfirmationModal('Atención', 'No hay turnos pendientes para llamar.');
//         return;
//     }

//     const confirmed = await showConfirmationModal('Llamar Siguiente Turno', '¿Está seguro de que desea llamar al siguiente turno disponible?');
//     if (!confirmed) return;

//     btnCallNext.disabled = true;
//     try {
//         // console.log("Obteniendo servicios del módulo...");
//         // const { data: moduleServices, error: msError } = await supabase
//         //     .from('modulos_servicios')
//         //     .select('id_servicio')
//         //     .eq('id_modulo', window.ASSIGNED_MODULE_ID);

//         // if (msError) throw msError;

//         // const serviceIds = moduleServices.map(ms => ms.id_servicio);
//         // console.log("Servicios del módulo:", serviceIds);

//         // if (serviceIds.length === 0) {
//         //     throw new Error("Este módulo no tiene servicios configurados");
//         // }

//         // console.log("Buscando siguiente turno disponible...");
//         // const { data: nextTurn, error: nextTurnError } = await supabase
//         //     .from('turnos')
//         //     .select('id_turno, prefijo_turno, numero_turno, id_servicio, servicios(nombre_servicio)')
//         //     .eq('estado', 'en espera')
//         //     .in('id_servicio', serviceIds)
//         //     .order('hora_solicitud', { ascending: true })
//         //     .limit(1)
//         //     .maybeSingle();

//         // if (nextTurnError) throw nextTurnError;

//         // if (!nextTurn) {
//         //     console.log("No hay turnos pendientes para llamar");
//         //     await showConfirmationModal('Atención', 'No hay turnos pendientes para llamar.');
//         //     return;
//         // }
//         const nextTurn = sortedPendingTurns[0];
//         console.log(`Llamando turno ${nextTurn.prefijo_turno}-${nextTurn.numero_turno}`);

//         // Objeto de actualización sin id_funcionario
//         const updateData = {
//             estado: 'en atencion',
//             hora_llamado: new Date().toISOString(),
//             id_modulo_atencion: window.ASSIGNED_MODULE_ID
//         };

//         // Si la columna id_funcionario existe en tu tabla, descomenta esta línea:
//         // updateData.id_funcionario = USER_ID;

//         const { error: updateError } = await supabase
//             .from('turnos')
//             .update(updateData)
//             .eq('id_turno', nextTurn.id_turno);

//         if (updateError) throw updateError;

//         // Enviamos un mensaje explícito al visualizador con los datos del nuevo turno.
//         console.log("Enviando evento de broadcast 'nuevo_llamado'");

//         const { data: moduloData } = await supabase.from('modulos').select('nombre_modulo').eq('id_modulo', window.ASSIGNED_MODULE_ID).single();

//         turnosChannel.send({
//             type: 'broadcast',
//             event: 'nuevo_llamado',
//             payload: {
//                 id_turno: nextTurn.id_turno,
//                 prefijo_turno: nextTurn.prefijo_turno,
//                 numero_turno: nextTurn.numero_turno,
//                 nombre_modulo: moduloData.nombre_modulo
//             },
//         });

//         console.log("Registrando log de llamado...");
//         await supabase.from('logs_turnos').insert({
//             id_turno: nextTurn.id_turno,
//             id_usuario: window.USER_ID,
//             accion: 'llamado',
//             detalles: `Turno ${nextTurn.prefijo_turno}-${nextTurn.numero_turno} llamado al módulo ${window.ASSIGNED_MODULE_ID}`
//         });

//         console.log("Actualizando interfaz...");
//         await loadCurrentTurn();
//         await loadPendingTurns();

//     } catch (error) {
//         console.error("Error al llamar siguiente turno:", error);
//         await showConfirmationModal('Error', `Error al llamar turno: ${error.message}`);
//     } finally {
//         updateButtonStates();
//     }
// });

// btnRecall.addEventListener('click', async () => {
//     if (!currentAttendingTurnId) {
//         await showConfirmationModal('Atención', 'No hay un turno en curso para rellamar.');
//         return;
//     }
//     const confirmed = await showConfirmationModal('Rellamar Turno', '¿Está seguro de que desea rellamar el turno actual?');
//     if (!confirmed) return;

//     btnRecall.disabled = true;
//     try {
//         const { error: updateError } = await supabase
//             .from('turnos')
//             .update({ hora_llamado: new Date().toISOString() })
//             .eq('id_turno', currentAttendingTurnId);

//         if (updateError) throw updateError;

//         // --- AÑADE ESTA SECCIÓN ---
//         // Envía un mensaje directo al canal del visualizador
//         console.log("Enviando evento de broadcast 'rellamar'");
//         turnosChannel.send({
//             type: 'broadcast',
//             event: 'rellamar',
//             payload: { id_turno: currentAttendingTurnId },
//         });
//         // --- FIN DE LA SECCIÓN A AÑADIR ---

//         await supabase.from('logs_turnos').insert({
//             id_turno: currentAttendingTurnId,
//             id_usuario: window.USER_ID,
//             accion: 'rellamado'
//         });

//         console.log(`Turno ${currentAttendingTurnId} rellamado.`);
//     } catch (error) {
//         console.error("Error al rellamar turno:", error.message);
//         await showConfirmationModal('Error', `Error al rellamar turno: ${error.message}`);
//     } finally {
//         btnRecall.disabled = false;
//         updateButtonStates();
//     }
// });

// btnFinish.addEventListener('click', async () => {
//     if (!currentAttendingTurnId) {
//         await showConfirmationModal('Atención', 'No hay un turno en curso para finalizar.');
//         return;
//     }
//     const confirmed = await showConfirmationModal('Finalizar Turno', '¿Está seguro de que desea finalizar el turno actual?');
//     if (!confirmed) return;

//     btnFinish.disabled = true;
//     try {

//         const finishedTurnId = currentAttendingTurnId; // Guardamos el ID antes de finalizar

//         const { error: updateError } = await supabase
//             .from('turnos')
//             .update({
//                 estado: 'atendido',
//                 hora_finalizacion: new Date().toISOString()
//             })
//             .eq('id_turno', currentAttendingTurnId);

//         if (updateError) throw updateError;

//         await supabase.from('logs_turnos').insert({
//             id_turno: finishedTurnId,
//             id_usuario: window.USER_ID,
//             accion: 'finalizado'
//         });

//         console.log(`Turno ${finishedTurnId} finalizado.`);
//         currentAttendingTurnId = null;

//         //le decimos explícitamente a la UI que se actualice AHORA MISMO
//         await loadCurrentTurn();
//         await loadDailyHistory();
//         //también enviamos un mensaje para que el visualizador se entere
//         turnosChannel.send({
//             type: 'broadcast',
//             event: 'turno_finalizado',
//             payload: { id_turno: finishedTurnId }
//         });
//     } catch (error) {
//         console.error("Error al finalizar turno:", error.message);
//         await showConfirmationModal('Error', `Error al finalizar turno: ${error.message}`);
//     } finally {
//         updateButtonStates();
//     }
// });

// silenceAlertBtn.addEventListener('click', () => {
//     turnosChannel.send({
//         type: 'broadcast',
//         event: 'silence_alert',
//         payload: { message: 'Por favor, guardar silencio' }
//     });
//     console.log("Alerta de silencio enviada.");
// });


// window.openTransferModal = openTransferModal;

// ==========================================================
// INICIO DE LA APLICACIÓN
// ==========================================================
// (Función autoejecutable que se corre al cargar el script)
// async function init() {
//     console.log("Inicializando panel de funcionario...");
//     await updateAssignedModuleName();
//     await loadPendingTurns();
//     await loadCurrentTurn();
//     await loadDailyHistory();
//     updateButtonStates();
//     setupRealtimeSubscriptions();
//     console.log("Panel inicializado.");
// }

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

