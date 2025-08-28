// Contenido completo para static/js/solicitar_turno.js

// La librería simple-keyboard crea un objeto global window.SimpleKeyboard
const Keyboard = window.SimpleKeyboard.default;

document.addEventListener('DOMContentLoaded', function () {
    // --- Referencias a los elementos del DOM ---
    const step1 = document.getElementById('step-1-identification');
    const step2 = document.getElementById('step-2-services');
    const continueBtn = document.getElementById('continue-btn');
    const identificationInput = document.getElementById('numero_identificacion');
    const loadingMessage = document.getElementById('loading-message');
    const welcomeUserMessage = document.getElementById('welcome-user-message');
    const fullNameContainer = document.getElementById('full-name-container');
    const fullNameInput = document.getElementById('nombre_completo');
    const serviceSelectionContainer = document.getElementById('service-selection-container');
    const serviceButtons = document.querySelectorAll('.service-button');

    let activeKeyboard = null; // Para saber qué teclado está activo

    // --- Configuración del Teclado Numérico ---
    const numericKeyboard = new Keyboard("#numeric-keyboard", {
        layout: {
            default: ["1 2 3", "4 5 6", "7 8 9", "{bksp} 0 {enter}"]
        },
        display: {
            '{bksp}': 'BORRAR',
            '{enter}': 'CONTINUAR'
        },
        theme: "hg-theme-default hg-layout-numeric numeric-theme",
        onKeyPress: button => handleKeyPress(button, identificationInput)
    });

    // --- Configuración del Teclado QWERTY (Mayúsculas) ---
    const qwertyKeyboard = new Keyboard("#qwerty-keyboard", {
        layout: {
            default: [
                "Q W E R T Y U I O P",
                "A S D F G H J K L Ñ",
                "Z X C V B N M",
                "{bksp} {space} {enter}"
            ]
        },
        display: {
            '{bksp}': 'BORRAR',
            '{space}': 'ESPACIO',
            '{enter}': 'LISTO'
        },
        theme: "hg-theme-default",
        onKeyPress: button => handleKeyPress(button, fullNameInput)
    });

    // Función genérica para manejar las pulsaciones de ambos teclados
    function handleKeyPress(button, inputElement) {
        if (button === "{enter}") {
            if (inputElement.id === 'numero_identificacion') {
                continueBtn.click(); // Simula un clic en el botón Continuar
            } else if (inputElement.id === 'nombre_completo') {
                showServices(); // El usuario ha terminado de escribir su nombre
            }
            return;
        }

        if (button === "{bksp}") {
            inputElement.value = inputElement.value.slice(0, -1);
            return;
        }

        // Para cualquier otra tecla, añade el carácter al input
        inputElement.value += button;
    }

    // Lógica para el botón Continuar
    continueBtn.addEventListener('click', async function () {
        const identificacion = identificationInput.value;
        if (!identificacion) {
            alert('Por favor, ingrese un número de identificación.');
            return;
        }

        loadingMessage.classList.remove('hidden');
        continueBtn.disabled = true;

        try {
            const response = await fetch(`/api/check-cliente/${identificacion}`);
            const data = await response.json();

            // Ocultamos el teclado numérico
            document.querySelector("#numeric-keyboard").parentElement.classList.add('hidden');
            step1.querySelector('label').classList.add('hidden'); // Oculta la primera instrucción
            step1.querySelector('.flex').classList.add('hidden'); // Oculta el input y el botón

            // Mostramos el paso 2
            step2.classList.remove('hidden');

            if (data && data.nombre_completo) {
                welcomeUserMessage.textContent = `Hola de nuevo, ${data.nombre_completo}!`;
                fullNameInput.value = data.nombre_completo;
                showServices(); // El cliente ya existe, mostramos los servicios directamente
            } else {
                welcomeUserMessage.textContent = '¡Bienvenido!';
                fullNameInput.value = '';
                fullNameContainer.classList.remove('hidden'); // Mostramos el campo de nombre y su teclado
            }
        } catch (error) {
            console.error('Error al verificar el cliente:', error);
            alert('Hubo un error al verificar la identificación.');
        } finally {
            loadingMessage.classList.add('hidden');
            continueBtn.disabled = false;
        }
    });

    // Función para mostrar los servicios y habilitar los botones
    function showServices() {
        document.querySelector("#qwerty-keyboard").parentElement.classList.add('hidden'); // Oculta el teclado QWERTY
        fullNameContainer.querySelector('label').classList.add('hidden'); // Oculta la instrucción del nombre
        serviceSelectionContainer.classList.remove('hidden');
        serviceButtons.forEach(button => button.disabled = false);
    }
});