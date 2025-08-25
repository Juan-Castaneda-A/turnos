// Importar el cliente de Supabase
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';

// Variables de configuración (pasadas desde Flask)
//const SUPABASE_URL = "{{ supabase_url }}";
//const SUPABASE_KEY = "{{ supabase_key }}";

// Inicializar Supabase
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
console.log("Supabase Client inicializado para Visualizador.");
console.log("Objeto Supabase:", supabase); // DEBUG: Inspeccionar el objeto supabase
console.log("¿Existe supabase.from?", typeof supabase.from); // DEBUG: Verificar si .from existe

// Referencias a los elementos del DOM
const currentTurnNumberElement = document.getElementById('current-turn-number');
const currentTurnModuleElement = document.getElementById('current-turn-module');
const currentTurnDisplayElement = document.getElementById('current-turn-display');
const callHistoryElement = document.getElementById('call-history');
const modulesStatusBodyElement = document.getElementById('modules-status-body');
//const callSound = document.getElementById('call-sound');

let lastCalledTurnId = null; // Para evitar reproducir el sonido múltiples veces para el mismo turno

//let audioEnabled = false;

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

// Function to announce the turn using TTS
// REEMPLAZA tu antigua función announceTurn con esta nueva versión

// Variable global para guardar la voz en español una vez que la encontremos
let spanishVoice = null;

// Función para cargar y seleccionar la voz en español
function loadSpanishVoice() {
    // getVoices() puede cargar las voces de forma asíncrona
    const voices = window.speechSynthesis.getVoices();
    spanishVoice = voices.find(voice => voice.lang.startsWith('es-')) || voices[0];
    console.log("Voz seleccionada:", spanishVoice);
}

// El evento 'voiceschanged' se dispara cuando la lista de voces está lista
window.speechSynthesis.onvoiceschanged = loadSpanishVoice;

async function announceTurn(prefijoTurno, numeroTurno, nombreModulo) {
    // Primero, nos aseguramos de que las voces se hayan cargado
    if (!spanishVoice) {
        loadSpanishVoice();
    }

    try {
        // La función que convierte números a palabras sigue siendo útil
        const numeroTurnoEnPalabras = numberToWordsSpanish(parseInt(numeroTurno, 10));
        const moduleNumberStr = nombreModulo.split(' ')[1] || '';
        const moduleNumber = parseInt(moduleNumberStr, 10);
        const moduleNumberEnPalabras = numberToWordsSpanish(moduleNumber);

        const textToSpeak = `Turno ${prefijoTurno} ${numeroTurnoEnPalabras}, diríjase a la ventanilla ${moduleNumberEnPalabras}.`;
        console.log("Texto a anunciar (nativo):", textToSpeak);

        // Cancelar cualquier anuncio anterior para evitar que se solapen
        window.speechSynthesis.cancel();

        // Crear el objeto de síntesis de voz
        const utterance = new SpeechSynthesisUtterance(textToSpeak);

        // Asignar la voz en español que encontramos
        if (spanishVoice) {
            utterance.voice = spanishVoice;
        }

        // (Opcional) Ajustar velocidad y tono
        utterance.rate = 0.9; // Un poco más lento que lo normal
        utterance.pitch = 1.0; 

        // ¡Hablar!
        window.speechSynthesis.speak(utterance);

    } catch (error) {
        console.error("Error al anunciar el turno con la Web Speech API:", error);
    }
}


// Función para actualizar el display del turno actual
async function updateCurrentTurnDisplay(turn) {
    if (turn) {
        currentTurnNumberElement.textContent = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
        currentTurnModuleElement.textContent = `Diríjase a la Ventanilla ${turn.modulos.nombre_modulo.split(' ')[1]}`;

        // Reproducir sonido si es un nuevo turno llamado
        if (turn.id_turno !== lastCalledTurnId) {
            await announceTurn(turn.prefijo_turno, turn.numero_turno, turn.modulos.nombre_modulo);
            lastCalledTurnId = turn.id_turno;

            // Añadir animación de pulso al display principal
            currentTurnDisplayElement.classList.add('pulse-animation');
            setTimeout(() => {
                currentTurnDisplayElement.classList.remove('pulse-animation');
            }, 1500); // Duración de la animación
        }
    } else {
        currentTurnNumberElement.textContent = '---';
        currentTurnModuleElement.textContent = 'Esperando nuevo turno...';
        lastCalledTurnId = null;
    }
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

// --- Suscripciones en tiempo real a Supabase ---

function setupRealtimeSubscriptions() {
    // Suscribirse a cambios en la tabla 'turnos'
    const turnosChannel = supabase.channel('turnos_channel');
    turnosChannel
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'turnos' },
            async payload => {
                console.log('Cambio en turnos recibido en visualizador!', payload);
                await loadInitialData();
            }
        )
        .subscribe();

    // Suscribirse a cambios en la tabla 'modulos'
    const modulosChannel = supabase.channel('modulos_channel');
    modulosChannel
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'modulos' },
            async payload => {
                console.log('Cambio en modulos recibido en visualizador!', payload);
                await loadInitialData();
            }
        )
        .subscribe();

    // Suscribirse a cambios en la tabla 'usuarios' (para nombres de funcionarios)
    const usuariosChannel = supabase.channel('usuarios_channel');
    usuariosChannel
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'usuarios' },
            async payload => {
                console.log('Cambio en usuarios recibido en visualizador!', payload);
                await loadInitialData();
            }
        )
        .subscribe();

    console.log("Suscripciones Realtime configuradas.");
}


// Función para cargar los datos iniciales y mantener actualizados los displays
async function loadInitialData() {
    try {
        // 1. Cargar el último turno llamado (estado 'en atencion')
        const { data: currentTurnData, error: currentTurnError } = await supabase
            .from('turnos')
            .select('*, modulos(nombre_modulo)')
            .eq('estado', 'en atencion')
            .order('hora_llamado', { ascending: false })
            .limit(1);

        if (currentTurnError) throw currentTurnError;
        updateCurrentTurnDisplay(currentTurnData && currentTurnData.length > 0 ? currentTurnData[0] : null);

        // 2. Cargar el historial de los últimos 5 turnos llamados (estado 'atendido' o 'en atencion')
        const { data: historyData, error: historyError } = await supabase
            .from('turnos')
            .select('*, modulos(nombre_modulo)')
            .or('estado.eq.atendido,estado.eq.en atencion')
            .order('hora_llamado', { ascending: false })
            .limit(5);

        if (historyError) throw historyError;
        updateCallHistory(historyData || []);

        // 3. Cargar el estado de todos los módulos, incluyendo el ID del funcionario asignado
        const { data: modulesData, error: modulesError } = await supabase
.from('modulos')
.select(`
*,
usuarios!usuarios_id_modulo_asignado_fkey(nombre_completo, id_usuario),
turnos(id_turno, numero_turno, prefijo_turno, estado)
`)
.order('nombre_modulo', { ascending: true }); // Ordenar por nombre para consistencia

        if (modulesError) throw modulesError;

        // Filtrar turnos para mostrar solo el que está 'en atencion' por ese módulo
        const processedModulesData = modulesData.map(mod => ({
            ...mod,
            turnos: mod.turnos ? mod.turnos.filter(t => t.estado === 'en atencion') : []
        }));

        await updateModulesStatus(processedModulesData || []); // Usar await aquí
    } catch (error) {
        console.error('Error al cargar datos iniciales para el visualizador:', error.message);
    }
}

// Cargar datos iniciales al cargar la página
window.onload = () => {
    loadInitialData();
    // Retrasar la configuración de las suscripciones en tiempo real
    setTimeout(setupRealtimeSubscriptions, 500); // Retraso de 500ms
};
