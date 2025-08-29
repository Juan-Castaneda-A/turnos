document.addEventListener('DOMContentLoaded', function () {
    // --- Referencias a los elementos del DOM ---
    const step1 = document.getElementById('step-1-identification');
    const step2 = document.getElementById('step-2-services');
    const identificationInput = document.getElementById('numero_identificacion');
    const continueBtn = document.getElementById('continue-btn');
    const loadingMessage = document.getElementById('loading-message');
    const welcomeUserMessage = document.getElementById('welcome-user-message');
    const fullNameContainer = document.getElementById('full-name-container');
    const fullNameInput = document.getElementById('nombre_completo');
    const serviceSelectionContainer = document.getElementById('service-selection-container');
    const serviceButtons = document.querySelectorAll('.service-button');

    // --- Lógica de Nuestro Teclado Numérico ---
    const numericKeyboard = document.getElementById('custom-numeric-keyboard');
    const qwertyKeyboard = document.getElementById('custom-qwerty-keyboard');

    // Añadimos un solo event listener al contenedor del teclado
    numericKeyboard.addEventListener('click', function(event) {
        // Ignoramos clics que no sean en los botones
        if (!event.target.matches('button')) {
            return;
        }

        const button = event.target;
        const currentValue = identificationInput.value;

        // Verificamos qué tipo de botón se presionó
        if (button.classList.contains('keypad-btn')) {
            identificationInput.value += button.textContent;
        } else if (button.classList.contains('keypad-bksp')) {
            identificationInput.value = currentValue.slice(0, -1);
        } else if (button.classList.contains('keypad-enter')) {
            // Simulamos un clic en el botón principal de "Continuar"
            continueBtn.click();
        }
    });

    // Listener para el teclado QWERTY
    qwertyKeyboard.addEventListener('click', function(event) {
        if (!event.target.matches('button')) return;
        
        const button = event.target;
        const currentValue = fullNameInput.value;

        if (button.classList.contains('keypad-btn')) {
            fullNameInput.value += button.textContent;
        } else if (button.classList.contains('keypad-space')) {
            fullNameInput.value += ' ';
        } else if (button.classList.contains('keypad-bksp')) {
            fullNameInput.value = currentValue.slice(0, -1);
        } else if (button.classList.contains('keypad-enter')) {
            showServices();
        }
    });

    continueBtn.addEventListener('click', async function () {
        const identificacion = identificationInput.value;
        if (!identificacion) {
            alert('Por favor, ingrese un número de identificación.');
            return;
        }

        loadingMessage.classList.remove('hidden');
        continueBtn.disabled = true;
        numericKeyboard.classList.add('hidden'); // Ocultamos el teclado

        try {
            const response = await fetch(`/api/check-cliente/${identificacion}`);
            const data = await response.json();

            step1.querySelector('label').classList.add('hidden');
            step1.querySelector('.flex').classList.add('hidden');
            step2.classList.remove('hidden');

            if (data && data.nombre_completo) {
                welcomeUserMessage.textContent = `Hola de nuevo, ${data.nombre_completo}!`;
                fullNameInput.value = data.nombre_completo;
                showServices();
            } else {
                welcomeUserMessage.textContent = '¡Bienvenido!';
                fullNameInput.value = '';
                fullNameContainer.classList.remove('hidden');
                // Aquí iría la lógica del teclado QWERTY
            }
        } catch (error) {
            console.error('Error al verificar el cliente:', error);
            alert('Hubo un error al verificar la identificación.');
            numericKeyboard.classList.remove('hidden'); // Mostramos el teclado si hay error
        } finally {
            loadingMessage.classList.add('hidden');
            continueBtn.disabled = false;
        }
    });

    function showServices() {
        // Aquí iría la lógica para ocultar el teclado QWERTY
        qwertyKeyboard.classList.add('hidden');
        fullNameContainer.classList.add('hidden');
        serviceSelectionContainer.classList.remove('hidden');
        serviceButtons.forEach(button => button.disabled = false);
    }
});