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

function speakText(textToSpeak) {
    // 1. Asegura que la voz en español esté cargada
    if (!spanishVoice) {
        loadSpanishVoice();
    }
    console.log("Anunciando (nativo):", textToSpeak);

    // 2. Cancela cualquier anuncio anterior
    window.speechSynthesis.cancel(); 
    
    // 3. Crea el objeto de voz nativo
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    
    if (spanishVoice) {
        utterance.voice = spanishVoice;
    }
    
    // Usamos la misma configuración que 'announceTurn'
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    
    // 4. ¡Habla!
    window.speechSynthesis.speak(utterance);
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
async function updateSecondaryData() {
    try {

        // **CORRECCIÓN**: Verificamos si los elementos existen antes de usarlos
        if (!callHistoryElement || !modulesStatusBodyElement) {
            console.warn("Elementos del DOM para datos secundarios no encontrados. Omitiendo actualización.");
            return;
        }

        // Actualizar historial de llamados (sin tocar el turno principal)
        const { data: historyData, error: historyError } = await supabase
            .from('turnos')
            .select('*, modulos(nombre_modulo)')
            .or('estado.eq.atendido,estado.eq.en atencion')
            .order('hora_llamado', { ascending: false })
            .limit(5);
        if (historyError) throw historyError;
        updateCallHistory(historyData || []);

        // Actualizar estado de módulos
        const { data: modulesData, error: modulesError } = await supabase
            .from('modulos')
            .select('*, usuarios!usuarios_id_modulo_asignado_fkey(nombre_completo), turnos(prefijo_turno, numero_turno, estado)')
            .order('nombre_modulo', { ascending: true });
        if (modulesError) throw modulesError;
        await updateModulesStatus(modulesData || []);

    } catch (error) {
        console.error('Error actualizando datos secundarios:', error.message);
    }
}

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
    // 1. Definimos UN SOLO CANAL con el nombre que acordamos
    const channel = supabase.channel('turnos_channel');
    const silenceBanner = document.getElementById('silence-banner');

    // Listener para cuando se actualiza CUALQUIER COSA (módulos, historial, etc.)
    // Esto mantiene los datos secundarios actualizados sin provocar sonidos.
    channel.on('postgres_changes', { event: '*', schema: 'public' },
        (payload) => {
            console.log('Cambio general detectado, recargando datos silenciosamente:', payload.table);
            // Llama a una función que actualiza todo MENOS el turno principal y el sonido.
            updateSecondaryData();
        }
    );

    // Escucha el mensaje específico de 'nuevo_llamado'
    channel.on('broadcast', { event: 'nuevo_llamado' },
        (message) => {
            console.log('¡Evento de NUEVO LLAMADO recibido!', message.payload);
            const turn = message.payload;
            lastCalledTurnId = turn.id_turno; // <-- **AÑADIDO**: Actualizamos el estado
            // Actualizamos el historial y el display principal
            updateCallHistoryWithNewTurn(turn);

            // Llamamos directamente a la función de anuncio con los datos recibidos.
            announceTurn(turn.prefijo_turno, turn.numero_turno, turn.nombre_modulo);
        }
    );

    // Escucha el mensaje específico de 'rellamar'
    channel.on('broadcast', { event: 'rellamar' },
        (message) => {
            console.log('¡Evento de RELLAMADO recibido!', message.payload);
            forceAnnounceTurnById(message.payload.id_turno);
        }
    );

    // Escucha el mensaje de que un turno ha terminado.
    channel.on('broadcast', { event: 'turno_finalizado' },
        async (message) => {
            console.log('Evento de TURNO FINALIZADO recibido.', message.payload);

            try {
                const { data: nextTurnToShow, error } = await supabase
                    .from('turnos')
                    // --- ¡ESTA ES LA CORRECCIÓN! ---
                    .select('*, modulos!turnos_id_modulo_atencion_fkey(nombre_modulo)')
                    // --- FIN DE LA CORRECCIÓN ---
                    .eq('estado', 'en atencion')
                    .order('hora_llamado', { ascending: false })
                    .limit(1)
                    .maybeSingle(); // .maybeSingle() es genial porque no da error si no encuentra nada

                if (error) throw error;

                if (nextTurnToShow) {
                    // Si encontramos otro turno activo, lo mostramos (sin sonido).
                    console.log(`Mostrando el siguiente turno activo: ${nextTurnToShow.prefijo_turno}-${nextTurnToShow.numero_turno}`);
                    displayTurnSilently(nextTurnToShow);
                } else {
                    // Si no hay NINGÚN turno en atención, ahora sí limpiamos la pantalla.
                    console.log("No hay más turnos en atención. Limpiando pantalla.");
                    clearMainTurnDisplay();
                }
            } catch (e) {
                console.error("Error al procesar turno finalizado:", e);
            }
        }
    );

    channel.on('broadcast', { event: 'silence_alert' }, (payload) => {
        console.log('Alerta de silencio recibida!', payload);
        silenceBanner.classList.remove('hidden');

        // Opcional: añade un sonido de alerta suave aquí si quieres
        const alertSound = new Audio('/static/audio/silencio.mp3');
        alertSound.play().catch(e => console.error("Error al reproducir sonido de alerta:", e));

        // Oculta el banner después de 10 segundos
        setTimeout(() => {
            silenceBanner.classList.add('hidden');
        }, 4000);
    });

    channel.on('broadcast', { event: 'custom_message' }, (message) => {
        const data = message.payload;
        const fullText = `${data.text}.`;

        console.log("Mensaje personalizado recibido:", fullText);
        speakText(fullText); // ¡Llama a la nueva función de voz!

        // (Opcional, pero recomendado) Mostrarlo como un banner
        // Reutilizamos el banner de silencio
        const banner = document.getElementById('silence-banner');
        if (banner) {
            banner.textContent = fullText;
            banner.classList.remove('hidden');
            setTimeout(() => banner.classList.add('hidden'), 10000); // Ocultar después de 10 seg
        }
    });

    const messagesChannel = supabase.channel('visualizador_messages_channel');

    messagesChannel.on('postgres_changes',
        { event: '*', schema: 'public', table: 'mensajes_visualizador' },
        (payload) => {
            console.log('Cambio detectado en mensajes_visualizador:', payload.eventType);
            // Simplemente volvemos a cargar y mostrar los mensajes
            loadAndDisplayMessages();
        }
    ).subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Visualizador conectado al canal de mensajes.');
        } else {
            console.error('Error al conectar al canal de mensajes:', status);
        }
    });

    // 3. Finalmente, nos suscribimos al canal UNA SOLA VEZ para activar todos los listeners
    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('Visualizador conectado y escuchando en el canal notaria-turnos-canal.');
        }
    });

    console.log("Todas las suscripciones Realtime han sido configuradas en un solo canal.");
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
    modulesStatusBodyElement = document.getElementById('modules-status-body');
    silenceBanner = document.getElementById('silence-banner');
    console.log("Inicializando Visualizador...");
    // El resto de la inicialización
    await loadInitialData();
    setupRealtimeSubscriptions();
    await loadAndDisplayMessages(); // <-- AÑADE ESTA LÍNEA
    console.log("Visualizador inicializado.");
}

async function loadInitialData() {
    // Cargar turno principal solo una vez al inicio
    try {
        const { data: currentTurn, error } = await supabase.from('turnos')
            .select('*, modulos!turnos_id_modulo_atencion_fkey(*)') // ¡Esta es la consulta explícita que arregla la ambigüedad!
            .eq('estado', 'en atencion')
            .order('hora_llamado', { ascending: false })
            .limit(1)
            .single(); // .single() devuelve un objeto o null

        // --- ¡¡AQUÍ ESTÁ LA CORRECCIÓN!! ---
        // 1. Se usa 'error' (el nombre correcto) en lugar de 'currentTurnError'
        if (error && error.code !== 'PGRST116') {
            // Ignoramos el error 'PGRST116' (no rows found), porque es normal
            // que no haya turnos activos. Lanzamos cualquier OTRO error.
            throw error;
        }

        // 2. Se usa 'currentTurn' (el nombre correcto) en lugar de 'currentTurnData'
        if (currentTurn) {
            // Esto previene el crash de 'Cannot read properties of null'
            const moduleName = currentTurn.modulos ? currentTurn.modulos.nombre_modulo : '---';
            currentTurnNumberElement.textContent = `${currentTurn.prefijo_turno}-${String(currentTurn.numero_turno).padStart(3, '0')}`;
            currentTurnModuleElement.textContent = `Diríjase al módulo ${moduleName.split(' ')[1]}`;
        } else {
            // Si no hay turnos, limpiamos la pantalla
            clearMainTurnDisplay();
        }
        // --- FIN DE LA CORRECCIÓN ---

    } catch (e) {
        console.error("Error cargando turno inicial", e);
    }

    // Carga el resto de datos
    await updateSecondaryData();
}

async function loadAndDisplayMessages() {
    console.log("Cargando mensajes para el ticker...");
    try {
        const { data: messages, error } = await supabase
            .from('mensajes_visualizador')
            .select('texto_mensaje')
            .eq('is_active', true) // Solo traemos los mensajes activos
            .order('created_at', { ascending: false }); // Opcional: ordenar por más recientes

        if (error) throw error;

        activeMessages = messages.map(msg => msg.texto_mensaje); // Guardamos solo el texto
        console.log(`Mensajes activos cargados: ${activeMessages.length}`);

        // Detener cualquier intervalo anterior para evitar duplicados
        if (tickerIntervalId) {
            clearInterval(tickerIntervalId);
        }

        if (activeMessages.length > 0) {
            messageTickerContainer.classList.remove('hidden'); // Mostrar el contenedor
            currentMessageIndex = 0; // Empezar desde el primer mensaje

            // Función interna para actualizar el texto del ticker
            const updateTicker = () => {
                if (activeMessages.length === 0) {
                    messageTickerContainer.classList.add('hidden'); // Ocultar si ya no hay mensajes
                    if (tickerIntervalId) clearInterval(tickerIntervalId); // Detener intervalo
                    return;
                }

                // Concatenamos todos los mensajes activos con separadores
                // para que fluyan continuamente en la animación CSS
                const fullTickerText = activeMessages.join("   •   "); // Usa puntos o separadores

                // Solo actualizamos si el texto es diferente (evita reinicios innecesarios de la animación)
                if (messageTickerText.textContent !== fullTickerText) {
                    messageTickerText.textContent = fullTickerText + "   •   "; // Añade separador al final para loop visual
                }

                // Ya NO necesitamos la animación de opacidad ni el índice
                // messageTickerText.style.opacity = 0; 
                // setTimeout(() => { messageTickerText.style.opacity = 1; }, 500);
                // currentMessageIndex = (currentMessageIndex + 1) % activeMessages.length;
            };

            updateTicker(); // Mostrar el primer mensaje inmediatamente
            //tickerIntervalId = setInterval(updateTicker, TICKER_INTERVAL); // Iniciar la rotación

            messageTickerContainer.classList.remove('hidden');

        } else {
            // Si no hay mensajes activos, ocultar el ticker
            messageTickerContainer.classList.add('hidden');
            messageTickerText.textContent = '';
            if (tickerIntervalId) clearInterval(tickerIntervalId);
        }

    } catch (error) {
        console.error("Error al cargar mensajes del ticker:", error.message);
        messageTickerText.textContent = "Error al cargar mensajes.";
        messageTickerContainer.classList.remove('hidden'); // Mostrar el error
    }
}

document.addEventListener('DOMContentLoaded', init);
