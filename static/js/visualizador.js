import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.0/+esm';

// 1. INICIALIZACIÓN
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
console.log("✅ Visualizador iniciado.");

// 2. REFERENCIAS AL DOM
let currentTurnNumberElement, currentTurnModuleElement, callHistoryElement, 
    modulesGrid, messageTickerContainer, messageTickerText, silenceBanner,
    viewMain, viewStatus;

// 3. ESTADO
let lastCalledTurnId = null;
let spanishVoice = null;
let activeMessages = [];
let carouselInterval = null;
let isMainViewActive = true;

// 4. CONFIGURACIÓN DE TIEMPOS
const VIEW_MAIN_DURATION = 15000; // 15 seg en turno principal
const VIEW_STATUS_DURATION = 10000; // 10 seg en tabla de estados

// ==========================================================
// A. LÓGICA DE VOZ (TTS)
// ==========================================================

function loadSpanishVoice() {
    const voices = window.speechSynthesis.getVoices();
    spanishVoice = voices.find(voice => 
        (voice.lang.startsWith('es') && (voice.name.includes('Google') || voice.name.includes('Microsoft'))) 
        || voice.lang.startsWith('es')
    ) || voices[0];
}
window.speechSynthesis.onvoiceschanged = loadSpanishVoice;

function numberToWordsSpanish(num) {
    if (num === 0) return "cero";
    const units = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
    const teens = ["diez", "once", "doce", "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve"];
    const tens = ["", "diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
    
    let words = [];
    let cNum = num;

    if (cNum >= 100) {
        const h = Math.floor(cNum / 100);
        if (h === 1 && cNum % 100 === 0) words.push("cien");
        else words.push(units[h] === "uno" ? "ciento" : units[h] + "cientos");
        cNum %= 100;
    }
    if (cNum >= 20) {
        words.push(tens[Math.floor(cNum / 10)]);
        if (cNum % 10 !== 0) words.push("y", units[cNum % 10]);
    } else if (cNum >= 10) {
        words.push(teens[cNum - 10]);
    } else if (cNum > 0) {
        words.push(units[cNum]);
    }
    return words.join(" ").trim();
}

function speakText(textToSpeak) {
    if (!spanishVoice) loadSpanishVoice();
    console.log("🗣️ Hablando:", textToSpeak);
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    if (spanishVoice) utterance.voice = spanishVoice;
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
}

// ==========================================================
// B. LÓGICA VISUAL (UI)
// ==========================================================

function announceTurn(prefijoTurno, numeroTurno, nombreModulo) {
    // 1. Actualizar textos
    const turnText = `${prefijoTurno}-${String(numeroTurno).padStart(3, '0')}`;
    const modName = nombreModulo.replace(/Módulo|Modulo/i, '').trim();
    
    currentTurnNumberElement.textContent = turnText;
    document.getElementById('current-turn-module').textContent = `Módulo ${modName}`;

    // 2. Animación
    currentTurnNumberElement.classList.remove('animate-pulse-slow');
    void currentTurnNumberElement.offsetWidth; // Reset
    currentTurnNumberElement.classList.add('animate-pulse-slow');

    // 3. Audio y Voz
    const callSound = document.getElementById('call-sound');
    
    // Preparar texto hablado
    const numPalabras = numberToWordsSpanish(parseInt(numeroTurno, 10));
    const modNum = parseInt(modName, 10);
    const modPalabras = !isNaN(modNum) ? numberToWordsSpanish(modNum) : modName;
    const speechText = `Turno ${prefijoTurno} ${numPalabras}. Diríjase al módulo ${modPalabras}.`;

    // Secuencia: Sonido -> Voz
    if (callSound) {
        callSound.currentTime = 0;
        const onSoundEnd = () => {
            speakText(speechText);
            callSound.removeEventListener('ended', onSoundEnd);
        };
        callSound.addEventListener('ended', onSoundEnd);
        callSound.play().catch(e => {
            console.warn("Autoplay bloqueado (necesita clic):", e);
            speakText(speechText); // Fallback si no suena
        });
    } else {
        speakText(speechText);
    }
}

function updateCallHistory(turn) {
    const turnText = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
    const modName = turn.nombre_modulo.replace(/Módulo|Modulo/i, '').trim();

    const item = document.createElement('div');
    item.className = 'p-3 bg-gray-700 rounded-lg border-l-4 border-blue-500 flex justify-between items-center animate-fade-in-up';
    item.innerHTML = `
        <span class="text-2xl font-mono font-bold text-white">${turnText}</span>
        <span class="text-gray-400 uppercase text-sm">Mód ${modName}</span>
    `;

    callHistoryElement.prepend(item);
    if (callHistoryElement.children.length > 5) {
        callHistoryElement.lastChild.remove();
    }
}

function displayTurnSilently(turn) {
    const turnText = `${turn.prefijo_turno}-${String(turn.numero_turno).padStart(3, '0')}`;
    const modName = turn.modulos?.nombre_modulo.replace(/Módulo|Modulo/i, '').trim() || '---';
    currentTurnNumberElement.textContent = turnText;
    document.getElementById('current-turn-module').textContent = `Módulo ${modName}`;
}

function clearMainTurnDisplay() {
    currentTurnNumberElement.textContent = '---';
    document.getElementById('current-turn-module').textContent = 'Esperando...';
}

// ==========================================================
// C. LÓGICA DEL CARRUSEL (VISTAS)
// ==========================================================

function switchView(viewName) {
    if (viewName === 'main') {
        // Activar VISTA PRINCIPAL
        viewMain.classList.remove('opacity-0', 'pointer-events-none', 'scale-95', 'z-0');
        viewMain.classList.add('opacity-100', 'scale-100', 'z-50'); // Traer al frente
        
        // Desactivar VISTA DE ESTADO
        viewStatus.classList.remove('opacity-100', 'scale-100', 'z-50');
        viewStatus.classList.add('opacity-0', 'pointer-events-none', 'scale-95', 'z-0'); // Enviar al fondo
        
        isMainViewActive = true;
        
    } else if (viewName === 'status') {
        // Actualizar datos antes de mostrar
        updateModulesStatusBoard();
        
        // Activar VISTA DE ESTADO
        viewStatus.classList.remove('opacity-0', 'pointer-events-none', 'scale-95', 'z-0');
        viewStatus.classList.add('opacity-100', 'scale-100', 'z-50'); // Traer al frente
        
        // Desactivar VISTA PRINCIPAL
        viewMain.classList.remove('opacity-100', 'scale-100', 'z-50');
        viewMain.classList.add('opacity-0', 'pointer-events-none', 'scale-95', 'z-0'); // Enviar al fondo
        
        isMainViewActive = false;
    }
}

function startCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    
    const cycle = () => {
        if (isMainViewActive) {
            switchView('status'); // Ir a tabla
            carouselInterval = setTimeout(cycle, VIEW_STATUS_DURATION);
        } else {
            switchView('main'); // Ir a turno principal
            carouselInterval = setTimeout(cycle, VIEW_MAIN_DURATION);
        }
    };
    carouselInterval = setTimeout(cycle, VIEW_MAIN_DURATION);
}

function forceShowMainView() {
    // Interrumpe el carrusel para mostrar el llamado
    switchView('main');
    if (carouselInterval) clearTimeout(carouselInterval);
    // Reinicia el ciclo después de mostrar el turno
    carouselInterval = setTimeout(() => {
        startCarousel(); 
    }, VIEW_MAIN_DURATION);
}

// ==========================================================
// D. DATOS (TABLAS Y TICKER)
// ==========================================================

async function updateModulesStatusBoard() {
    try {
        const { data: modules } = await supabase
            .from('modulos')
            .select('nombre_modulo, estado, turnos(prefijo_turno, numero_turno, estado)')
            .eq('estado', 'activo')
            .order('nombre_modulo'); // Orden alfabético (Módulo 1, Módulo 2...)

        if (!modules || !modulesGrid) return;

        modulesGrid.innerHTML = ''; // Limpiar grid

        modules.forEach(mod => {
            // Buscamos si tiene turno activo
            const activeTurn = mod.turnos?.find(t => t.estado === 'en atencion');
            
            // Estilos Base de la Tarjeta
            const cardBaseClass = "relative flex flex-col items-center justify-center p-4 rounded-2xl border-4 shadow-2xl transition-all duration-300";
            
            let borderClass = "";
            let statusContent = "";
            let glowEffect = "";

            if (activeTurn) {
                // CASO: OCUPADO (ATENDIENDO)
                borderClass = "border-yellow-500 bg-slate-800";
                glowEffect = "shadow-[0_0_20px_rgba(234,179,8,0.3)]"; // Resplandor amarillo
                
                const turnText = `${activeTurn.prefijo_turno}-${String(activeTurn.numero_turno).padStart(3,'0')}`;
                statusContent = `
                    <p class="text-slate-400 text-sm uppercase tracking-widest mb-1">Atendiendo</p>
                    <div class="text-6xl font-black text-white font-JetBrains tracking-tighter drop-shadow-md">
                        ${turnText}
                    </div>
                `;
            } else {
                // CASO: DISPONIBLE (LIBRE)
                borderClass = "border-green-500/50 bg-slate-800/50";
                statusContent = `
                    <div class="text-4xl font-bold text-green-400 uppercase tracking-widest opacity-80">
                        LIBRE
                    </div>
                `;
            }

            // Limpiamos el nombre (ej: "Módulo 01" -> "01") para que se vea más grande
            const modNumber = mod.nombre_modulo.replace(/Módulo|Modulo/i, '').trim();

            // Creamos la Tarjeta HTML
            const card = document.createElement('div');
            card.className = `${cardBaseClass} ${borderClass} ${glowEffect}`;
            card.innerHTML = `
                <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900 px-4 py-1 rounded-full border border-slate-600">
                    <span class="text-slate-300 font-bold uppercase text-sm tracking-wider">Módulo ${modNumber}</span>
                </div>

                <div class="mt-2 text-center">
                    ${statusContent}
                </div>
            `;

            modulesGrid.appendChild(card);
        });

    } catch (e) {
        console.error("Error actualizando tablero:", e);
    }
}

async function loadAndDisplayMessages() {
    try {
        const { data: messages } = await supabase
            .from('mensajes_visualizador')
            .select('texto_mensaje')
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        if (messages && messages.length > 0) {
            activeMessages = messages.map(m => m.texto_mensaje);
            const text = activeMessages.join("  •  ");
            messageTickerText.textContent = text + "  •  " + text;
            messageTickerContainer.classList.remove('hidden');
        } else {
            messageTickerContainer.classList.add('hidden');
        }
    } catch (e) { console.error(e); }
}

// ==========================================================
// E. REALTIME (AQUÍ ESTÁN TODOS TUS LISTENERS)
// ==========================================================

function setupRealtimeSubscriptions() {
    // IMPORTANTE: Usar el MISMO nombre de canal que usa el Panel de Funcionario
    const channel = supabase.channel('turnos_channel'); 

    // 1. NUEVO LLAMADO
    channel.on('broadcast', { event: 'nuevo_llamado' }, (message) => {
        console.log('🔔 Nuevo llamado:', message.payload);
        const turn = message.payload;
        
        forceShowMainView(); // <--- Muestra la pantalla principal
        announceTurn(turn.prefijo_turno, turn.numero_turno, turn.nombre_modulo);
        updateCallHistory(turn);
    });

    // 2. RELLAMAR
    channel.on('broadcast', { event: 'rellamar' }, async (message) => {
        console.log('🔁 Rellamado:', message.payload);
        // Buscamos los datos frescos del turno
        const { data } = await supabase.from('turnos')
            .select('*, modulos!turnos_id_modulo_atencion_fkey(nombre_modulo)') // Consulta segura
            .eq('id_turno', message.payload.id_turno)
            .single();
            
        if (data) {
            forceShowMainView(); // <--- Muestra la pantalla principal
            const modName = data.modulos ? data.modulos.nombre_modulo : '---';
            announceTurn(data.prefijo_turno, data.numero_turno, modName);
        }
    });

    // 3. TURNO FINALIZADO
    channel.on('broadcast', { event: 'turno_finalizado' }, async () => {
        console.log('🏁 Turno finalizado.');
        // Buscamos si hay otro turno activo para mostrar
        const { data: nextTurn } = await supabase
            .from('turnos')
            .select('*, modulos!turnos_id_modulo_atencion_fkey(nombre_modulo)')
            .eq('estado', 'en atencion')
            .order('hora_llamado', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (nextTurn) {
            displayTurnSilently(nextTurn);
        } else {
            clearMainTurnDisplay();
        }
        // Actualizamos el tablero de estado (Vista B) por si acaso
        updateModulesStatusBoard();
    });

    // 4. ALERTA DE SILENCIO
    channel.on('broadcast', { event: 'silence_alert' }, () => {
        console.log('🤫 Alerta de silencio');
        silenceBanner.classList.remove('hidden');
        silenceBanner.classList.add('flex');
        
        const audio = new Audio('/static/audio/silencio.mp3');
        audio.play().catch(() => {}); // Ignora error si no hay interacción

        setTimeout(() => {
            silenceBanner.classList.add('hidden');
            silenceBanner.classList.remove('flex');
        }, 5000);
    });

    // 5. MENSAJE PERSONALIZADO (VOZ)
    channel.on('broadcast', { event: 'custom_message' }, (message) => {
        console.log('📢 Mensaje personalizado:', message.payload);
        const text = message.payload.text;
        
        // Mostrar banner temporal
        silenceBanner.querySelector('h1').textContent = "ATENCIÓN";
        silenceBanner.querySelector('p').textContent = text;
        silenceBanner.classList.remove('hidden');
        silenceBanner.classList.add('flex');

        speakText(text); // Leer en voz alta

        setTimeout(() => {
            silenceBanner.classList.add('hidden');
            silenceBanner.classList.remove('flex');
            // Restaurar texto original del banner
            silenceBanner.querySelector('h1').textContent = "POR FAVOR GUARDAR SILENCIO";
            silenceBanner.querySelector('p').textContent = "Por favor espere su turno";
        }, 5000);
    });

    // 6. TICKER (Postgres Changes)
    const msgChannel = supabase.channel('visualizador_msgs');
    msgChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes_visualizador' }, 
        () => loadAndDisplayMessages()
    ).subscribe();

    channel.subscribe((status) => {
        console.log(`🔌 Estado conexión Realtime: ${status}`);
    });
}

// ==========================================================
// F. INICIALIZACIÓN
// ==========================================================

async function init() {
    // Asignar referencias DOM
    currentTurnNumberElement = document.getElementById('current-turn-number');
    currentTurnModuleElement = document.getElementById('current-turn-module');
    callHistoryElement = document.getElementById('call-history');
    //modulesStatusBody = document.getElementById('modules-status-body'); // <-- YA NO DARÁ ERROR
    modulesGrid = document.getElementById('modules-grid');
    messageTickerContainer = document.getElementById('message-ticker-container');
    messageTickerText = document.getElementById('message-ticker-text');
    silenceBanner = document.getElementById('silence-banner');
    viewMain = document.getElementById('view-main');
    viewStatus = document.getElementById('view-status');

    loadSpanishVoice();
    
    // Cargar estado inicial
    await updateModulesStatusBoard();
    await loadAndDisplayMessages();
    
    // Cargar turno actual
    const { data: activeTurn } = await supabase.from('turnos')
        .select('*, modulos!turnos_id_modulo_atencion_fkey(nombre_modulo)')
        .eq('estado', 'en atencion')
        .order('hora_llamado', { ascending: false })
        .limit(1).maybeSingle();
        
    if (activeTurn) displayTurnSilently(activeTurn);

    setupRealtimeSubscriptions();
    startCarousel();
    
    // Reloj
    setInterval(() => {
        document.getElementById('clock').textContent = new Date().toLocaleTimeString('es-CO', {hour:'2-digit', minute:'2-digit'});
    }, 1000);
}

document.addEventListener('DOMContentLoaded', init);