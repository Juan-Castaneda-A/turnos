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

    const actionButtonsContainer = document.getElementById('action-buttons-container');
    const editNameBtn = document.getElementById('edit-name-btn');
    const cancelBtn = document.getElementById('cancel-btn');

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
    qwertyKeyboard.addEventListener('click', async function(event) { //<-- Convertido a async
        if (!event.target.matches('button')) return;
        
        const button = event.target;
        const allKeys = qwertyKeyboard.querySelectorAll('button');
        const currentValue = fullNameInput.value;

        if (button.classList.contains('keypad-btn')) {
            fullNameInput.value += button.textContent;
        } else if (button.classList.contains('keypad-space')) {
            fullNameInput.value += ' ';
        } else if (button.classList.contains('keypad-bksp')) {
            fullNameInput.value = currentValue.slice(0, -1);
        } else if (button.classList.contains('keypad-enter')) {
            // **NUEVA LÓGICA DE GUARDADO AL PRESIONAR "LISTO"**
            const newName = fullNameInput.value.trim();
            if (!newName) {
                alert("Por favor, ingrese un nombre.");
                return;
            }

            loadingMessage.textContent = "Guardando nombre...";
            loadingMessage.classList.remove('hidden');
            allKeys.forEach(key => key.disabled = true);

            try {
                const response = await fetch('/api/register-cliente', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        numero_identificacion: identificationInput.value,
                        nombre_completo: newName
                    })
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.error || 'No se pudo guardar el nombre.');
                }
                
                // Si todo salió bien, procedemos a mostrar los servicios
                showServices();

            } catch (error) {
                console.error("Error al registrar el nombre:", error);
                alert(`Error al guardar el nombre: ${error.message}`);
            } finally {
                loadingMessage.classList.add('hidden');
                loadingMessage.textContent = "Verificando..."; // Revertir texto
                allKeys.forEach(key => key.disabled = false);
            }
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

            actionButtonsContainer.classList.remove('hidden');

            if (data && data.nombre_completo) {
                welcomeUserMessage.textContent = `Hola de nuevo, ${data.nombre_completo}!`;
                fullNameInput.value = data.nombre_completo;
                editNameBtn.classList.remove('hidden');
                showServices();
            } else {
                welcomeUserMessage.textContent = '¡Bienvenido!';
                fullNameInput.value = '';
                editNameBtn.classList.add('hidden');
                showFullNameInput();
                // Aquí iría la lógica del teclado QWERTY
            }
        } catch (error) {
            console.error('Error al verificar el cliente:', error);
            alert('Hubo un error al verificar la identificación.');
            resetToStep1(); // Si hay un error, reseteamos
        } finally {
            loadingMessage.classList.add('hidden');
            continueBtn.disabled = false;
        }
    });

    editNameBtn.addEventListener('click', function() {
        // Ocultamos los servicios y el botón de editar para mostrar el campo de nombre
        serviceSelectionContainer.classList.add('hidden');
        editNameBtn.classList.add('hidden');
        showFullNameInput();
    });

    cancelBtn.addEventListener('click', function() {
        resetToStep1();
    });

    function showFullNameInput() {
        fullNameContainer.classList.remove('hidden');
        qwertyKeyboard.classList.remove('hidden');
        fullNameInput.focus();
    }

    function showServices() {
    const currentName = fullNameInput.value; // 1. Lee el nombre que está en el campo de texto
    if (!currentName.trim()) {
        alert("Por favor, ingrese un nombre válido.");
        return;
    }
    
    // 2. Actualiza el mensaje de bienvenida SIEMPRE con ese nombre
    //    Esta es la línea clave que arregla el bug.
    welcomeUserMessage.textContent = `Hola, ${currentName}!`;

    // 3. Oculta el teclado y el input de nombre
    qwertyKeyboard.classList.add('hidden');
    fullNameContainer.classList.add('hidden');

    // 4. Muestra los servicios Y el botón de editar
    serviceSelectionContainer.classList.remove('hidden');
    editNameBtn.classList.remove('hidden');
    serviceButtons.forEach(button => button.disabled = false);
    }

    function resetToStep1() {
        // Ocultar paso 2 y sus componentes
        step2.classList.add('hidden');
        welcomeUserMessage.textContent = '';
        fullNameContainer.classList.add('hidden');
        serviceSelectionContainer.classList.add('hidden');
        actionButtonsContainer.classList.add('hidden');
        editNameBtn.classList.add('hidden');

        // Limpiar inputs
        identificationInput.value = '';
        fullNameInput.value = '';

        // Mostrar paso 1 y sus componentes
        step1.querySelector('label').classList.remove('hidden');
        step1.querySelector('.flex').classList.remove('hidden');
        numericKeyboard.classList.remove('hidden');
    }
});