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

const chatModal = document.getElementById('chat-modal');
const openChatBtn = document.getElementById('open-chat-btn');
const closeChatBtn = document.getElementById('close-chat-btn');
const chatRoomList = document.getElementById('chat-room-list');
const chatMessageHeader = document.getElementById('chat-message-header');
const chatMessageArea = document.getElementById('chat-message-area');
const chatMessageForm = document.getElementById('chat-message-form');
const chatMessageInput = document.getElementById('chat-message-input');
const chatSendBtn = document.getElementById('chat-send-btn');

let currentAttendingTurnId = null;
let channels = [];
let sortedPendingTurns = [];
let currentChatRoomId = null;
let userCacheMap = new Map();
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
// FUNCIONES DEL CHAT
// ==========================================================

// --- 1. Abrir y Cerrar el Modal ---

async function openChat() {
    console.log("Abriendo chat...");
    chatModal.classList.remove('hidden');
    // Reseteamos la UI cada vez que se abre
    chatMessageHeader.querySelector('h3').textContent = "Seleccione un chat";
    chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-gray-500">No hay mensajes cargados.</p></div>';
    chatMessageInput.disabled = true;
    chatSendBtn.disabled = true;
    currentChatRoomId = null;

    openChatBtn.classList.remove('animate-pulse', 'bg-red-600', 'hover:bg-red-700');
    openChatBtn.classList.add('bg-green-600', 'hover:bg-green-700');

    // Cargamos la lista de salas de chat
    await loadChatRooms();
}

function closeChat() {
    chatModal.classList.add('hidden');
}

// --- 2. Cargar la Lista de Salas de Chat ---

async function loadChatRooms() {
    chatRoomList.innerHTML = '<p class="text-gray-500 text-sm">Cargando chats...</p>';
    try {
        const response = await fetch('/api/chat/rooms');
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error);

        chatRoomList.innerHTML = ''; // Limpiamos "Cargando..."

        if (result.rooms.length === 0) {
            chatRoomList.innerHTML = '<p class="text-gray-500 text-sm">No hay chats disponibles.</p>';
            return;
        }

        result.rooms.forEach(room => {
            const roomElement = document.createElement('button');
            roomElement.className = "w-full text-left px-4 py-3 rounded-lg text-gray-200 hover:bg-gray-700 focus:outline-none focus:bg-teal-600";
            roomElement.textContent = room.nombre;
            // Guardamos los datos en el elemento para usarlos al hacer clic
            roomElement.dataset.roomId = room.id;
            roomElement.dataset.roomName = room.nombre;

            // ¡IMPORTANTE! Añadimos el 'onclick'
            roomElement.onclick = () => {
                // Quitamos el 'focus' de todos los demás
                document.querySelectorAll('#chat-room-list button').forEach(btn => btn.classList.remove('focus:bg-teal-600'));
                // Añadimos el 'focus' a este
                roomElement.classList.add('focus:bg-teal-600');
                // Cargamos la sala
                selectChatRoom(room.id, room.nombre);
            };

            chatRoomList.appendChild(roomElement);
        });

    } catch (error) {
        console.error("Error al cargar salas de chat:", error.message);
        chatRoomList.innerHTML = '<p class="text-red-400 text-sm">Error al cargar chats.</p>';
    }
}

// --- 3. Seleccionar una Sala y Cargar sus Mensajes ---

async function selectChatRoom(roomId, roomName) {
    console.log(`Seleccionando sala: ${roomName} (ID: ${roomId})`);

    // Actualizamos el estado global
    currentChatRoomId = roomId;

    const roomButton = document.querySelector(`#chat-room-list button[data-room-id="${roomId}"]`);
    if (roomButton) {
        const dot = roomButton.querySelector('.notification-dot');
        if (dot) dot.remove();
    }

    // Actualizamos la UI
    chatMessageHeader.querySelector('h3').textContent = roomName;
    chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-gray-500">Cargando mensajes...</p></div>';
    chatMessageInput.disabled = false; // Habilitamos el input
    chatSendBtn.disabled = false;
    chatMessageInput.focus();

    // Llamamos a la API para cargar el historial
    await loadChatMessages(roomId);
}

async function loadChatMessages(roomId) {
    try {
        const response = await fetch(`/api/chat/messages/${roomId}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error);

        chatMessageArea.innerHTML = ''; // Limpiamos "Cargando..."

        if (result.messages.length === 0) {
            chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-gray-500">No hay mensajes. ¡Sé el primero en saludar!</p></div>';
            return;
        }

        // Renderizamos cada mensaje
        result.messages.forEach(msg => {
            const isMe = msg.sender_id === window.USER_ID; // Comparamos con el ID del funcionario logueado
            renderMessage(msg, isMe);
        });

        // Scroll automático al fondo
        chatMessageArea.scrollTop = chatMessageArea.scrollHeight;

    } catch (error) {
        console.error("Error al cargar mensajes:", error.message);
        chatMessageArea.innerHTML = '<div class="flex justify-center items-center h-full"><p class="text-red-400">Error al cargar mensajes.</p></div>';
    }
}

// --- 4. Renderizar un solo mensaje (Función "Ayudante") ---

function renderMessage(message, isMe) {
    const bubble = document.createElement('div');
    bubble.className = `p-3 max-w-xs md:max-w-md chat-bubble-${isMe ? 'sent' : 'received'}`;

    // --- ¡ESTA ES LA LÓGICA DEL CACHÉ! ---
    // Usamos el caché para buscar el nombre.
    // Si el mensaje viene del 'loadChatMessages', tendrá 'message.sender.nombre_completo'.
    // Si viene de Realtime, solo tendrá 'message.sender_id' y usaremos el caché.
    let senderName = 'Usuario Desconocido';
    if (isMe) {
        senderName = 'Tú';
    } else if (message.sender && message.sender.nombre_completo) {
        senderName = message.sender.nombre_completo; // De la API
    } else if (message.sender_id) {
        senderName = userCacheMap.get(message.sender_id) || 'Usuario'; // De Realtime
    }
    const sentTime = new Date(message.sent_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    bubble.innerHTML = `
        <p class="font-bold text-sm ${isMe ? 'text-teal-100' : 'text-green-300'}">${senderName}</p>
        <p class="text-base">${message.content}</p>
        <p class="text-xs text-right opacity-70 mt-1">${sentTime}</p>
    `;

    chatMessageArea.appendChild(bubble);

    chatMessageArea.scrollTop = chatMessageArea.scrollHeight;
}

// --- 5. Enviar un Mensaje Nuevo ---

async function handleSendMessage(event) {
    event.preventDefault(); // Evita que la página se recargue
    const content = chatMessageInput.value;

    if (!content.trim() || !currentChatRoomId) {
        return; // No enviar mensajes vacíos o sin sala
    }

    // Deshabilitamos el form temporalmente para evitar doble envío
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

        // ¡Éxito!
        chatMessageInput.value = ''; // Limpiamos el input

        // NO necesitamos llamar a renderMessage() aquí.
        // El truco es que el Realtime (que configuraremos en Fase 4)
        // verá este nuevo mensaje en la BD y se lo enviará a TODOS,
        // ¡incluyéndonos a nosotros! Esto evita mensajes duplicados.

    } catch (error) {
        console.error("Error al enviar mensaje:", error.message);
        // Opcional: mostrar un error al usuario
    } finally {
        // Volvemos a habilitar el form
        chatMessageInput.disabled = false;
        chatSendBtn.disabled = false;
        chatMessageInput.focus();
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

async function loadUserCache() {
    try {
        const response = await fetch('/api/get-users-list');
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error);

        // Limpiamos el caché y lo volvemos a llenar
        userCacheMap.clear();
        result.users.forEach(user => {
            userCacheMap.set(user.id_usuario, user.nombre_completo);
        });
        console.log("Caché de usuarios cargado.");
    } catch (error) {
        console.error("Error al cargar caché de usuarios:", error.message);
    }
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

    // 1. Creamos un nuevo canal para los mensajes
    const chatMessagesChannel = supabase.channel('chat_messages_channel');

    chatMessagesChannel.on(
        'postgres_changes',
        {
            event: 'INSERT', // Solo nos importan los NUEVOS mensajes
            schema: 'public',
            table: 'chat_messages',
            filter: `id_organizacion=eq.${window.ORGANIZACION_ID}` // Filtrado por Org
        },
        (payload) => {
            console.log("Nuevo mensaje de chat recibido:", payload.new);
            const msg = payload.new;
            const isMe = msg.sender_id === window.USER_ID;

            // 1. ¿El chat está abierto y es la sala correcta?
            if (!chatModal.classList.contains('hidden') && msg.room_id === currentChatRoomId) {
                // Si estamos viendo la sala, renderiza el mensaje
                renderMessage(msg, isMe);
            } else {
                // Si no, mostramos una notificación
                showChatNotification(msg.room_id);
            }
        }
    ).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Panel de funcionario conectado al canal de chat.');
        }
    });
}

function showChatNotification(roomId) {
    // 1. Añade un punto rojo al botón principal de "Chat"
    openChatBtn.classList.add('animate-pulse'); // Hacemos que parpadee
    openChatBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
    openChatBtn.classList.add('bg-red-600', 'hover:bg-red-700');

    // 2. (Opcional) Añade un punto a la sala específica en la lista
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
    await loadUserCache();
    setupRealtimeSubscriptions();

    openChatBtn.addEventListener('click', openChat);
    closeChatBtn.addEventListener('click', closeChat);
    chatMessageForm.addEventListener('submit', handleSendMessage);

    console.log("Panel inicializado.");
}

document.addEventListener('DOMContentLoaded', init);