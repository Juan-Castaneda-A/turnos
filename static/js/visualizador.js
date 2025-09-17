import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';

// Inicializar Supabase
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
console.log("Supabase Client inicializado para Visualizador.");
console.log("Objeto Supabase:", supabase); // DEBUG: Inspeccionar el objeto supabase
console.log("¿Existe supabase.from?", typeof supabase.from); // DEBUG: Verificar si .from existe

// // Referencias a los elementos del DOM
// const currentTurnNumberElement = document.getElementById('current-turn-number');
// const currentTurnModuleElement = document.getElementById('current-turn-module');
// const currentTurnDisplayElement = document.getElementById('current-turn-display');
// const callHistoryElement = document.getElementById('call-history');
// const modulesStatusBodyElement = document.getElementById('modules-status-body');
// //const callSound = document.getElementById('call-sound');
// const fullscreenAlert = document.getElementById('fullscreen-alert');
// const fullscreenTurnNumber = document.getElementById('fullscreen-turn-number');
// const fullscreenTurnModule = document.getElementById('fullscreen-turn-module');

// Declaramos las variables aquí, pero las asignaremos cuando el DOM esté listo.
let currentTurnNumberElement, currentTurnModuleElement, currentTurnDisplayElement,
    callHistoryElement, modulesStatusBodyElement, silenceBanner;

let lastCalledTurnId = null; // Para evitar reproducir el sonido múltiples veces para el mismo turno
let spanishVoice = null;// Variable global para guardar la voz en español una vez que la encontremos
//let audioEnabled = false;

// ==========================================================
// FUNCIONES DE LÓGICA (Tus funciones de TTS y otras se quedan igual)
// ==========================================================

/*document.addEventListener('click', () => {
    audioEnabled = true;
    // Intentar reproducir el sonido para "desbloquear" el audio
    callSound.play().then(() => callSound.pause()).catch(e => console.log(e));
}, { once: true });*/

// --- Funciones de Utilidad para Audio y TTS ---

// Utility function to convert base64 to ArrayBuffer
// function base64ToArrayBuffer(base64) {
//     const binaryString = atob(base64);
//     const len = binaryString.length;
//     const bytes = new Uint8Array(len);
//     for (let i = 0; i < len; i++) {
//         bytes[i] = binaryString.charCodeAt(i);
//     }
//     return bytes.buffer;
// }

// Utility function to convert PCM (Int16Array) to WAV Blob
// function pcmToWav(pcm, sampleRate) {
//     const pcmLength = pcm.length;
//     const buffer = new ArrayBuffer(44 + pcmLength * 2); // 44 bytes for WAV header, 2 bytes per sample (PCM16)
//     const view = new DataView(buffer);

//     // WAV header
//     // RIFF chunk descriptor
//     writeString(view, 0, 'RIFF');
//     view.setUint32(4, 36 + pcmLength * 2, true); // ChunkSize
//     writeString(view, 8, 'WAVE');
//     // FMT sub-chunk
//     writeString(view, 12, 'fmt ');
//     view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
//     view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
//     view.setUint16(22, 1, true); // NumChannels (1 for mono)
//     view.setUint32(24, sampleRate, true); // SampleRate
//     view.setUint32(28, sampleRate * 2, true); // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
//     view.setUint16(32, 2, true); // BlockAlign (NumChannels * BitsPerSample/8)
//     view.setUint16(34, 16, true); // BitsPerSample
//     // DATA sub-chunk
//     writeString(view, 36, 'data');
//     view.setUint32(40, pcmLength * 2, true); // Subchunk2Size (NumSamples * NumChannels * BitsPerSample/8)

//     // Write PCM data
//     let offset = 44;
//     for (let i = 0; i < pcmLength; i++, offset += 2) {
//         view.setInt16(offset, pcm[i], true);
//     }

//     return new Blob([buffer], { type: 'audio/wav' });
// }

// function writeString(view, offset, string) {
//     for (let i = 0; i < string.length; i++) {
//         view.setUint8(offset + i, string.charCodeAt(i));
//     }
// }

// Utility function for exponential backoff with fetch
// async function fetchWithExponentialBackoff(url, options, retries = 3, delay = 1000) {
//     try {
//         const response = await fetch(url, options);
//         if (!response.ok) {
//             if (response.status === 429 && retries > 0) { // Too Many Requests
//                 console.warn(`Rate limit hit, retrying in ${delay / 1000}s...`);
//                 await new Promise(res => setTimeout(res, delay));
//                 return fetchWithExponentialBackoff(url, options, retries - 1, delay * 2);
//             }
//             throw new Error(`HTTP error! status: ${response.status}`);
//         }
//         return response;
//     } catch (error) {
//         if (retries > 0) {
//             console.warn(`Fetch failed, retrying in ${delay / 1000}s...`, error);
//             await new Promise(res => setTimeout(res, delay));
//             return fetchWithExponentialBackoff(url, options, retries - 1, delay * 2);
//         }
//         throw error;
//     }
// }

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

// async function announceTurn(prefijoTurno, numeroTurno, nombreModulo) {
//     // Primero, nos aseguramos de que las voces se hayan cargado
//     if (!spanishVoice) {
//         loadSpanishVoice();
//     }

//     try {
//         // La función que convierte números a palabras sigue siendo útil
//         const numeroTurnoEnPalabras = numberToWordsSpanish(parseInt(numeroTurno, 10));
//         const moduleNumberStr = nombreModulo.split(' ')[1] || '';
//         const moduleNumber = parseInt(moduleNumberStr, 10);
//         const moduleNumberEnPalabras = numberToWordsSpanish(moduleNumber);

//         const textToSpeak = `Turno ${prefijoTurno} ${numeroTurnoEnPalabras}, diríjase al módulo ${moduleNumberEnPalabras}.`;
//         console.log("Texto a anunciar (nativo):", textToSpeak);

//         // Cancelar cualquier anuncio anterior para evitar que se solapen
//         window.speechSynthesis.cancel();

//         // Crear el objeto de síntesis de voz
//         const utterance = new SpeechSynthesisUtterance(textToSpeak);

//         // Asignar la voz en español que encontramos
//         if (spanishVoice) {
//             utterance.voice = spanishVoice;
//         }

//         // (Opcional) Ajustar velocidad y tono
//         utterance.rate = 0.9; // Un poco más lento que lo normal
//         utterance.pitch = 1.0; 

//         // ¡Hablar!
//         window.speechSynthesis.speak(utterance);

//     } catch (error) {
//         console.error("Error al anunciar el turno con la Web Speech API:", error);
//     }
// }

function announceTurn(prefijoTurno, numeroTurno, nombreModulo) {
    if (!spanishVoice) {
        loadSpanishVoice();
    }

    // Obtenemos la referencia al panel que vamos a animar
    const turnDisplaySection = document.getElementById('current-turn-display');

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
    // ... (tu configuración de voz: spanishVoice, rate, etc.) ...
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

    window.speechSynthesis.speak(utterance);
}


// Función para actualizar el display del turno actual
// async function updateCurrentTurnDisplay(turn) {
//     if (turn) {
//         currentTurnNumberElement.textContent = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
//         currentTurnModuleElement.textContent = `Diríjase al módulo ${turn.modulos.nombre_modulo.split(' ')[1]}`;

//         // Reproducir sonido si es un nuevo turno llamado
//         if (turn.id_turno !== lastCalledTurnId) {
//             await announceTurn(turn.prefijo_turno, turn.numero_turno, turn.modulos.nombre_modulo);
//             lastCalledTurnId = turn.id_turno;

//             // Añadir animación de pulso al display principal
//             currentTurnDisplayElement.classList.add('pulse-animation');
//             setTimeout(() => {
//                 currentTurnDisplayElement.classList.remove('pulse-animation');
//             }, 1500); // Duración de la animación
//         }
//     } else {
//         currentTurnNumberElement.textContent = '---';
//         currentTurnModuleElement.textContent = 'Esperando nuevo turno...';
//         lastCalledTurnId = null;
//     }
// }

// --- Suscripciones en tiempo real a Supabase ---

// Pega esta nueva función en visualizador.js

// async function forceAnnounceTurnById(turnId) {
//     if (!turnId) return;
//     try {
//         const { data: turn, error } = await supabase
//             .from('turnos')
//             .select('*, modulos(nombre_modulo)')
//             .eq('id_turno', turnId)
//             .single(); // .single() para obtener un solo objeto

//         if (error) throw error;

//         if (turn) {
//             // Llama a la lógica de anuncio directamente, saltándose la comprobación de ID
//             updateCurrentTurnDisplay(turn); // Reutilizamos la función que actualiza la pantalla
//             await announceTurn(turn.prefijo_turno, turn.numero_turno, turn.modulos.nombre_modulo);
//         }
//     } catch (error) {
//         console.error("Error al forzar el anuncio del turno:", error);
//     }
// }

async function forceAnnounceTurnById(turnId) {
    if (!turnId) return;
    // La sintaxis de Supabase V2 es un poco diferente, la ajustamos
    // supabase.from('turnos').select('*, modulos(nombre_modulo)').eq('id_turno', turnId).single()
    //     .then(({ data: turn, error }) => {
    //         if (error) {
    //             console.error("Error al forzar anuncio:", error);
    //             return;
    //         }
    //         if (turn) {
    //             // Llamamos a la nueva función que maneja la animación y la voz
    //             announceTurn(turn.prefijo_turno, turn.numero_turno, turn.modulos.nombre_modulo);
    //         }
    //     });
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
    /*
    // Obtener todos los usuarios para mapear ID a nombre
    let allUsers = {};
    try {
        const { data: users, error: usersError } = await supabase
            .from('usuarios')
            .select('id_usuario, nombre_completo');
        if (usersError) throw usersError;
        users.forEach(user => {
            allUsers[user.id_usuario] = user.nombre_completo;
        });
    } catch (error) {
        console.error("Error al cargar todos los usuarios para el estado de módulos:", error.message);
        // Continuar sin nombres de usuario si hay un error
    }*/

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

    // Escucha cambios en la tabla 'modulos'
    // channel.on(
    //     'postgres_changes',
    //     { event: '*', schema: 'public', table: 'modulos' },
    //     (payload) => {
    //         console.log('Cambio en modulos recibido:', payload.eventType);
    //         loadInitialData();
    //     }
    // );

    // // Escucha cambios en la tabla 'usuarios'
    // channel.on(
    //     'postgres_changes',
    //     { event: '*', schema: 'public', table: 'usuarios' },
    //     (payload) => {
    //         console.log('Cambio en usuarios recibido:', payload.eventType);
    //         loadInitialData();
    //     }
    // );

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
            
            // Comprobamos si el turno que se finalizó es el que está en pantalla
            // para evitar limpiar la pantalla si un turno antiguo se finaliza.
            // if (message.payload.id_turno === lastCalledTurnId) {
            //     clearMainTurnDisplay();
            // }
            
            // // Refrescamos los datos secundarios (historial, estado de módulos)
            // updateSecondaryData();
            try {
                const { data: nextTurnToShow, error } = await supabase
                    .from('turnos')
                    .select('*, modulos(nombre_modulo)')
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
function init() {
    // **CORRECCIÓN**: Asignamos las variables del DOM aquí, cuando estamos seguros de que existen.
    currentTurnNumberElement = document.getElementById('current-turn-number');
    currentTurnModuleElement = document.getElementById('current-turn-module');
    currentTurnDisplayElement = document.getElementById('current-turn-display');
    callHistoryElement = document.getElementById('call-history');
    modulesStatusBodyElement = document.getElementById('modules-status-body');
    silenceBanner = document.getElementById('silence-banner');
    
    // El resto de la inicialización
    loadInitialData();
    setupRealtimeSubscriptions();
}

// Función para cargar los datos iniciales y mantener actualizados los displays
async function loadInitialData() {
    // Cargar turno principal solo una vez al inicio
    try {
        const { data: currentTurnData, error: currentTurnError } = await supabase
            .from('turnos')
            .select('*, modulos(nombre_modulo)')
            .eq('estado', 'en atencion')
            .order('hora_llamado', { ascending: false })
            .limit(1);

        if (currentTurnError) throw currentTurnError;
        if (currentTurnData && currentTurnData.length > 0) {
            const turn = currentTurnData[0];
            currentTurnNumberElement.textContent = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
            currentTurnModuleElement.textContent = `Diríjase al módulo ${turn.modulos.nombre_modulo.split(' ')[1]}`;
        }
    } catch (e) {
        console.error("Error cargando turno inicial", e);
    }
    
    // Carga el resto de datos
    await updateSecondaryData();
}

// Cargar datos iniciales al cargar la página
// window.onload = () => {
//     loadInitialData();
//     // Retrasar la configuración de las suscripciones en tiempo real
//     setTimeout(setupRealtimeSubscriptions, 500); // Retraso de 500ms
// };

document.addEventListener('DOMContentLoaded', init);
