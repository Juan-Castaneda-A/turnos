import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';

// Inicializar Supabase
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
console.log("Supabase Client inicializado para Visualizador.");
console.log("Objeto Supabase:", supabase); // DEBUG: Inspeccionar el objeto supabase
console.log("¿Existe supabase.from?", typeof supabase.from); // DEBUG: Verificar si .from existe

const messageTickerContainer = document.getElementById('message-ticker-container');
const messageTickerText = document.getElementById('message-ticker-text');

// Declaramos las variables aquí, pero las asignaremos cuando el DOM esté listo.
let currentTurnNumberElement, currentTurnModuleElement, currentTurnDisplayElement,
    callHistoryElement, modulesStatusBodyElement, silenceBanner;

let lastCalledTurnId = null; // Para evitar reproducir el sonido múltiples veces para el mismo turno
let spanishVoice = null;// Variable global para guardar la voz en español una vez que la encontremos
//let audioEnabled = false;

let activeMessages = [];      // Array para guardar los mensajes activos
let currentMessageIndex = 0;  // Índice del mensaje que se está mostrando
let tickerIntervalId = null;  // Para poder detener/reiniciar el intervalo
const TICKER_INTERVAL = 10000; // Tiempo en milisegundos para cambiar de mensaje (10 segundos)

// ==========================================================
// FUNCIONES DE LÓGICA (Tus funciones de TTS y otras se quedan igual)
// ==========================================================

// Function to convert numbers to Spanish words (simplified for turn numbers)
function numberToWordsSpanish(num) {
    if (num === 0) return "cero";
    if (num < 0) return "menos " + numberToWordsSpanish(Math.abs(num));

    const units = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const teens = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
    const tens = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    const specialTeens = {
        21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro", 25: "veinticinco",
        26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve"
    };

    let words = [];
    let currentNum = num;

    if (currentNum >= 100) {
        const hundredsVal = Math.floor(currentNum / 100);
        if (hundredsVal === 1 && currentNum % 100 === 0) {
            words.push("cien");
        } else {
            words.push(units[hundredsVal] === "uno" ? "ciento" : (units[hundredsVal] + "cientos"));
        }
        currentNum %= 100;
    }

    if (currentNum in specialTeens) {
        words.push(specialTeens[currentNum]);
    } else if (currentNum >= 20) {
        words.push(tens[Math.floor(currentNum / 10)]);
        if (currentNum % 10 !== 0) {
            words.push("y", units[currentNum % 10]);
        }
    } else if (currentNum >= 10) {
        words.push(teens[currentNum - 10]);
    } else if (currentNum > 0) {
        words.push(units[currentNum]);
    }

    return words.join(" ").trim();
}

// Función para cargar y seleccionar la voz en español
function loadSpanishVoice() {
    // getVoices() puede cargar las voces de forma asíncrona
    const voices = window.speechSynthesis.getVoices();
    spanishVoice = voices.find(voice => voice.lang.startsWith('es-')) || voices[0];
    console.log("Voz seleccionada:", spanishVoice);
}

// El evento 'voiceschanged' se dispara cuando la lista de voces está lista
window.speechSynthesis.onvoiceschanged = loadSpanishVoice;

function announceTurn(prefijoTurno, numeroTurno, nombreModulo) {
    if (!spanishVoice) {
        loadSpanishVoice();
    }

    // Obtenemos la referencia al panel que vamos a animar
    const turnDisplaySection = document.getElementById('current-turn-display');
    const callSound = document.getElementById('call-sound'); // Referencia al sonido de campana

    const turnoCompleto = `${prefijoTurno}-${String(numeroTurno).padStart(3, '0')}`;
    const moduloCompleto = `Diríjase al Módulo ${nombreModulo.split(' ')[1]}`;

    // Actualizamos el contenido del panel
    document.getElementById('current-turn-number').textContent = turnoCompleto;
    document.getElementById('current-turn-module').textContent = moduloCompleto;

    // 1. AÑADIMOS la clase para activar la animación de crecimiento
    turnDisplaySection.classList.add('fullscreen-mode');

    // Función para revertir la animación
    const shrinkPanel = () => {
        turnDisplaySection.classList.remove('fullscreen-mode');
    };

    // 2. Preparamos la voz
    const numeroTurnoEnPalabras = numberToWordsSpanish(parseInt(numeroTurno, 10));
    const moduleNumberStr = nombreModulo.split(' ')[1] || '';
    const moduleNumber = parseInt(moduleNumberStr, 10);
    const moduleNumberEnPalabras = numberToWordsSpanish(moduleNumber);
    const textToSpeak = `Turno ${prefijoTurno} ${numeroTurnoEnPalabras}, diríjase al módulo ${moduleNumberEnPalabras}.`;
    console.log("Texto a anunciar (nativo):", textToSpeak);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (spanishVoice) {
        utterance.voice = spanishVoice;
    }

    // (Opcional) Ajustar velocidad y tono
    utterance.rate = 0.9; // Un poco más lento que lo normal
    utterance.pitch = 1.0;

    // 3. Cuando la voz termine, quitamos la clase para que vuelva a su tamaño normal
    utterance.onend = shrinkPanel;

    // 4. ¡PLAN B! Si 'onend' falla, un temporizador lo quitará de todas formas
    // Esto soluciona el problema de que se quede "pegado" en pantalla completa.
    setTimeout(shrinkPanel, 8000); // 8 segundos como máximo

    //Inicio de la nueva lógica de orquestación
    callSound.currentTime = 0; // asegurar de que el sonido esté al inicio
    const playSpeechAfterChime = () => {
        window.speechSynthesis.speak(utterance); //habla la voz del turno
        callSound.removeEventListener('ended', playSpeechAfterChime); //remueve el listener para que no se acumule en futuros llamados
    }

    callSound.addEventListener('ended', playSpeechAfterChime);

    callSound.play().catch(e => {
        console.error("No se pudo reproducir el sonido de la campana: ", e);
        window.speechSynthesis.speak(utterance); // Si falla el sonido, habla de todas formas
    });


}

async function forceAnnounceTurnById(turnId) {
    if (!turnId) return;

    try {
        const { data: turn, error } = await supabase.from('turnos').select('*, modulos(nombre_modulo)').eq('id_turno', turnId).single();
        if (error) throw error;
        if (turn) {
            announceTurn(turn.prefijo_turno, turn.numero_turno, turn.modulos.nombre_modulo);
            lastCalledTurnId = turn.id_turno; // <-- **AÑADIDO**: Actualizamos el estado
        }
    } catch (error) {
        console.error("Error al forzar anuncio:", error);
    }
}

function clearMainTurnDisplay() {
    currentTurnNumberElement.textContent = '---';
    currentTurnModuleElement.textContent = 'Esperando nuevo turno...';
    lastCalledTurnId = null; // Reseteamos la variable para el próximo llamado
}

// **NUEVA FUNCIÓN**: Para mostrar un turno sin anunciarlo (sin sonido)
function displayTurnSilently(turn) {
    currentTurnNumberElement.textContent = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
    currentTurnModuleElement.textContent = `Diríjase al módulo ${turn.modulos.nombre_modulo.split(' ')[1]}`;
    lastCalledTurnId = turn.id_turno;
}

// Función para actualizar el historial de llamados
function updateCallHistory(history) {
    callHistoryElement.innerHTML = ''; // Limpiar el historial actual
    if (history.length === 0) {
        callHistoryElement.innerHTML = '<div class="history-item text-gray-500"><span>Sin turnos previos</span></div>';
        return;
    }
    history.forEach(turn => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <span>${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}</span>
            <span class="text-gray-400">Módulo ${turn.modulos.nombre_modulo.split(' ')[1]}</span>
        `;
        callHistoryElement.appendChild(div);
    });
}

// Función para actualizar el estado de los módulos
async function updateModulesStatus(modules) {
    modulesStatusBodyElement.innerHTML = ''; // Limpiar la tabla actual
    if (modules.length === 0) {
        modulesStatusBodyElement.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-gray-500">No hay módulos registrados.</td>
            </tr>
        `;
        return;
    }

    modules.forEach(mod => {
        const tr = document.createElement('tr');
        let statusClass = '';
        let statusText = '';
        let currentTurnInfo = '';

        // Obtener el nombre del funcionario asignado (si existe)
        const funcionarioNombre = mod.usuarios && mod.usuarios.length > 0
            ? mod.usuarios[0].nombre_completo
            : 'Sin Asignar';
        // Filtrar turnos para mostrar solo el que está 'en atencion' por ese módulo
        const currentTurn = mod.turnos ? mod.turnos.find(t => t.estado === 'en atencion') : null;
        switch (mod.estado) {
            case 'activo':
                statusClass = 'status-available';
                statusText = 'Disponible';
                if (currentTurn) {
                    statusClass = 'status-attending';
                    statusText = 'Atendiendo';
                    currentTurnInfo = `Turno: ${currentTurn.prefijo_turno}-${String(currentTurn.numero_turno).padStart(3, '0')}`;
                }
                break;
            case 'inactivo':
                statusClass = 'status-inactive';
                statusText = 'Inactivo';
                break;
            default:
                statusClass = 'text-gray-400';
                statusText = mod.estado; // Mostrar estado desconocido
        }

        tr.innerHTML = `
            <td>${mod.nombre_modulo}</td>
            <td>${funcionarioNombre}</td>
            <td class="${statusClass}">${statusText} ${currentTurnInfo}</td>
        `;
        modulesStatusBodyElement.appendChild(tr);
    });
}

// Esta función actualiza las partes "silenciosas" de la pantalla.
// async function updateSecondaryData() {
//     try {

//         // **CORRECCIÓN**: Verificamos si los elementos existen antes de usarlos
//         if (!callHistoryElement || !modulesStatusBodyElement) {
//             console.warn("Elementos del DOM para datos secundarios no encontrados. Omitiendo actualización.");
//             return;
//         }

//         // Actualizar historial de llamados (sin tocar el turno principal)
//         const { data: historyData, error: historyError } = await supabase
//             .from('turnos')
//             .select('*, modulos(nombre_modulo)')
//             .or('estado.eq.atendido,estado.eq.en atencion')
//             .order('hora_llamado', { ascending: false })
//             .limit(5);
//         if (historyError) throw historyError;
//         updateCallHistory(historyData || []);

//         // Actualizar estado de módulos
//         const { data: modulesData, error: modulesError } = await supabase
//             .from('modulos')
//             .select('*, usuarios!usuarios_id_modulo_asignado_fkey(nombre_completo), turnos(prefijo_turno, numero_turno, estado)')
//             .order('nombre_modulo', { ascending: true });
//         if (modulesError) throw modulesError;
//         await updateModulesStatus(modulesData || []);

//     } catch (error) {
//         console.error('Error actualizando datos secundarios:', error.message);
//     }
// }

// Esta función actualiza el display principal y el historial al recibir un nuevo llamado
function updateCallHistoryWithNewTurn(turn) {
    const turnText = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
    const moduleText = `Módulo ${turn.nombre_modulo.split(' ')[1]}`;

    // Actualiza el display principal
    currentTurnNumberElement.textContent = turnText;
    currentTurnModuleElement.textContent = `Diríjase al ${moduleText.toLowerCase()}`;

    // Añade el nuevo turno al principio del historial en el DOM
    const firstHistoryItem = callHistoryElement.querySelector('.history-item');
    const newHistoryDiv = document.createElement('div');
    newHistoryDiv.className = 'history-item';
    newHistoryDiv.innerHTML = `<span>${turnText}</span><span class="text-gray-400">${moduleText}</span>`;

    callHistoryElement.insertBefore(newHistoryDiv, firstHistoryItem);

    // Mantiene el historial con un máximo de 5 elementos
    if (callHistoryElement.children.length > 5) {
        callHistoryElement.removeChild(callHistoryElement.lastChild);
    }
}



function setupRealtimeSubscriptions() {
    const channel = supabase.channel('turnos_channel');
    const silenceBanner = document.getElementById('silence-banner');

    // ¡ELIMINAMOS EL LISTENER 'postgres_changes' GENERAL!
    // Era ineficiente y ya no es necesario.
    /*
    channel.on('postgres_changes', { event: '*', schema: 'public' },
        (payload) => {
            console.log('Cambio general detectado...');
            updateSecondaryData(); // <-- Esta función ya no existe
        }
    );
    */

    // TODOS TUS LISTENERS 'broadcast' SE QUEDAN IGUAL. ¡Están perfectos!
    channel.on('broadcast', { event: 'nuevo_llamado' },
        (message) => {
            console.log('¡Evento de NUEVO LLAMADO recibido!', message.payload);
            const turn = message.payload;
            lastCalledTurnId = turn.id_turno; 
            updateCallHistoryWithNewTurn(turn); // <-- Esta función actualiza el historial
            announceTurn(turn.prefijo_turno, turn.numero_turno, turn.nombre_modulo);
        }
    );

    channel.on('broadcast', { event: 'rellamar' },
        (message) => {
            console.log('¡Evento de RELLAMADO recibido!', message.payload);
            forceAnnounceTurnById(message.payload.id_turno);
        }
    );

    // ... (tu listener de 'turno_finalizado' se queda igual) ...
    channel.on('broadcast', { event: 'turno_finalizado' },
        async (message) => {
            console.log('Evento de TURNO FINALIZADO recibido.', message.payload);
            // Simplemente volvemos a cargar los datos iniciales
            loadInitialData(); 
        }
    );
    
    // ... (tu listener de 'silence_alert' se queda igual) ...
    channel.on('broadcast', { event: 'silence_alert' }, (payload) => {
        console.log('Alerta de silencio recibida!', payload);
        silenceBanner.classList.remove('hidden');
        const alertSound = new Audio('/static/audio/silencio.mp3');
        alertSound.play().catch(e => console.error("Error al reproducir sonido de alerta:", e));
        setTimeout(() => {
            silenceBanner.classList.add('hidden');
        }, 4000);
    });

    // TU LISTENER DE MENSAJES SE QUEDA IGUAL. ¡Está perfecto!
    const messagesChannel = supabase.channel('visualizador_messages_channel');
    messagesChannel.on('postgres_changes',
        { event: '*', schema: 'public', table: 'mensajes_visualizador' },
        (payload) => {
            console.log('Cambio detectado en mensajes_visualizador:', payload.eventType);
            loadAndDisplayMessages(); // Recarga los mensajes
        }
    ).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Visualizador conectado al canal de mensajes.');
        }
    });

    // Tu suscripción final se queda igual
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Visualizador conectado y escuchando en el canal notaria-turnos-canal.');
        }
    });

    console.log("Suscripciones Realtime del Visualizador configuradas.");
}

// ==========================================================
// INICIO DE LA APLICACIÓN
// ==========================================================
async function init() {
    // **CORRECCIÓN**: Asignamos las variables del DOM aquí, cuando estamos seguros de que existen.
    currentTurnNumberElement = document.getElementById('current-turn-number');
    currentTurnModuleElement = document.getElementById('current-turn-module');
    currentTurnDisplayElement = document.getElementById('current-turn-display');
    callHistoryElement = document.getElementById('call-history');
    // modulesStatusBodyElement = document.getElementById('modules-status-body');
    silenceBanner = document.getElementById('silence-banner');
    console.log("Inicializando Visualizador...");
    await loadInitialData(); // <-- Carga el turno actual y el historial
    await loadAndDisplayMessages(); // <-- Carga los mensajes del ticker
    setupRealtimeSubscriptions(); // <-- Se suscribe a los cambios
    console.log("Visualizador inicializado.");
}

async function loadInitialData() {
    try {
        // Llamamos a nuestra nueva API unificada
        const response = await fetch('/api/visualizador/get-initial-data');
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }
        
        const turn = result.current_turn; // Puede ser 'null'
        const history = result.history;   // Puede ser []

        // 1. Poblamos el turno actual
        if (turn && turn.modulos) {
            currentTurnNumberElement.textContent = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
            currentTurnModuleElement.textContent = `Diríjase al módulo ${turn.modulos.nombre_modulo.split(' ')[1]}`;
            lastCalledTurnId = turn.id_turno; // Sincronizamos el ID
        } else {
            // Si no hay turno "en atencion", lo limpiamos
            currentTurnNumberElement.textContent = '---';
            currentTurnModuleElement.textContent = 'Esperando turno...';
        }

        // 2. Poblamos el historial
        updateCallHistory(history || []);

    } catch (e) {
        console.error("Error cargando datos iniciales:", e.message);
        currentTurnNumberElement.textContent = 'Error';
        currentTurnModuleElement.textContent = 'Error al cargar';
    }
}

async function loadAndDisplayMessages() {
    console.log("Cargando mensajes para el ticker...");
    try {
        // Llamamos a nuestra nueva API
        const response = await fetch('/api/visualizador/get-ticker-messages');
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.error);
        }

        activeMessages = result.messages.map(msg => msg.texto_mensaje); // Guardamos solo el texto

        // El resto de tu lógica para mostrar/ocultar el ticker es IDÉNTICA
        if (tickerIntervalId) {
            clearInterval(tickerIntervalId);
        }

        if (activeMessages.length > 0) {
            // ... (toda tu lógica para 'updateTicker' y 'fullTickerText' se queda EXACTAMENTE IGUAL) ...
            messageTickerContainer.classList.remove('hidden');
            const updateTicker = () => {
                const fullTickerText = activeMessages.join("   •   ");
                if (messageTickerText.textContent !== fullTickerText) {
                    messageTickerText.textContent = fullTickerText + "   •   ";
                }
            };
            updateTicker();
        } else {
            messageTickerContainer.classList.add('hidden');
            messageTickerText.textContent = '';
        }

    } catch (error) {
        console.error("Error al cargar mensajes del ticker:", error.message);
        messageTickerText.textContent = "Error al cargar mensajes.";
        messageTickerContainer.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', init);
