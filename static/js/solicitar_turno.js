document.addEventListener('DOMContentLoaded', function () {
    // --- Referencias a los elementos del DOM ---
    const step1 = document.getElementById('step-1-identification');
    const step2 = document.getElementById('step-2-services');
    
    const identificationInput = document.getElementById('numero_identificacion');
    const continueBtn = document.getElementById('continue-btn');
    const loadingMessage = document.getElementById('loading-message');
    
    // Elementos del Paso 2
    const welcomeUserMessage = document.getElementById('welcome-user-message');
    const fullNameContainer = document.getElementById('full-name-container');
    const fullNameInput = document.getElementById('nombre_completo');
    const serviceSelectionContainer = document.getElementById('service-selection-container');
    const actionButtonsContainer = document.getElementById('action-buttons-container');
    const editNameBtn = document.getElementById('edit-name-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const qwertyKeyboardContainer = document.getElementById('custom-qwerty-keyboard'); // Contenedor del teclado QWERTY

    // --- Referencias Habeas Data ---
    const habeasDataCheck = document.getElementById('habeas-data-check');
    const legalModal = document.getElementById('legalModal');
    const openModalBtn = document.getElementById('open-modal-btn');
    const closeModalElements = document.querySelectorAll('.close-modal, .close-modal-btn');

    // --- Lógica de Modal Legal ---
    openModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        legalModal.style.display = 'block';
    });

    closeModalElements.forEach(el => {
        el.addEventListener('click', () => {
            legalModal.style.display = 'none';
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target == legalModal) {
            legalModal.style.display = 'none';
        }
    });

    // --- TECLADO NUMÉRICO (Paso 1) ---
    const numericKeyboard = document.getElementById('custom-numeric-keyboard');
    
    numericKeyboard.addEventListener('click', function(event) {
        // Buscar el botón más cercano (por si clickean el ícono SVG dentro del botón)
        const button = event.target.closest('button');
        if (!button) return;

        const currentValue = identificationInput.value;

        if (button.classList.contains('keypad-btn')) {
            identificationInput.value += button.textContent.trim();
        } else if (button.classList.contains('keypad-bksp')) {
            identificationInput.value = currentValue.slice(0, -1);
        } else if (button.classList.contains('keypad-enter')) {
            continueBtn.click();
        }
    });

    // --- TECLADO QWERTY (Paso 2) ---
    const qwertyKeyboard = document.getElementById('custom-qwerty-keyboard');
    
    qwertyKeyboard.addEventListener('click', async function(event) {
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
            // Guardar Nombre Nuevo
            const newName = fullNameInput.value.trim();
            if (!newName) {
                alert("Por favor, ingrese un nombre.");
                return;
            }

            // Feedback visual simple en el botón
            const originalText = button.textContent;
            button.textContent = "...";
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
                
                // Si guardó, mostramos servicios
                showServices();

            } catch (error) {
                console.error("Error al registrar el nombre:", error);
                alert(`Error al guardar el nombre: ${error.message}`);
            } finally {
                button.textContent = originalText;
                allKeys.forEach(key => key.disabled = false);
            }
        }
    });

    // --- BOTÓN CONTINUAR (Transición Principal) ---
    continueBtn.addEventListener('click', async function () {
        // 1. Validación Habeas Data
        if (!habeasDataCheck.checked) {
            alert("⚠️ Por favor, acepte la Política de Tratamiento de Datos para continuar.");
            habeasDataCheck.parentElement.classList.add('ring-2', 'ring-red-500');
            setTimeout(() => habeasDataCheck.parentElement.classList.remove('ring-2', 'ring-red-500'), 1000);
            return;
        }

        const identificacion = identificationInput.value;
        if (!identificacion || identificacion.length < 4) {
            alert('Por favor, ingrese un número de identificación válido.');
            return;
        }

        loadingMessage.classList.remove('hidden');
        continueBtn.disabled = true;
        
        try {
            const response = await fetch(`/api/check-cliente/${identificacion}`);
            const data = await response.json();

            // --- CORRECCIÓN CLAVE AQUÍ ---
            // En lugar de ocultar inputs individuales, ocultamos TODO el contenedor del Paso 1
            step1.classList.add('hidden'); 
            
            // Mostramos TODO el contenedor del Paso 2
            step2.classList.remove('hidden'); 

            if (data && data.nombre_completo) {
                // USUARIO EXISTENTE: Vamos directo a Servicios
                welcomeUserMessage.textContent = `Hola de nuevo, ${data.nombre_completo}`;
                fullNameInput.value = data.nombre_completo;
                
                // Preparamos la vista
                showServices(); 
                
            } else {
                // USUARIO NUEVO: Vamos al Teclado QWERTY
                welcomeUserMessage.textContent = '¡Bienvenido!';
                fullNameInput.value = '';
                
                // Preparamos la vista
                showFullNameInput();
            }

        } catch (error) {
            console.error('Error al verificar el cliente:', error);
            alert('Hubo un error de conexión. Intente nuevamente.');
            resetToStep1(); 
        } finally {
            loadingMessage.classList.add('hidden');
            continueBtn.disabled = false;
        }
    });

    // --- Botones de Acción Paso 2 ---
    editNameBtn.addEventListener('click', function() {
        showFullNameInput();
    });

    cancelBtn.addEventListener('click', function() {
        resetToStep1();
    });

    // --- FUNCIONES DE VISTA ---

    function showFullNameInput() {
        // Configuración para escribir nombre
        fullNameContainer.classList.remove('hidden');
        qwertyKeyboardContainer.classList.remove('hidden'); // Mostrar teclado
        
        serviceSelectionContainer.classList.add('hidden'); // Ocultar servicios
        actionButtonsContainer.classList.add('hidden'); // Ocultar botones editar/cancelar (se muestra teclado)
        
        // Botón volver simple si quieren cancelar escritura
        cancelBtn.classList.remove('hidden'); 
        actionButtonsContainer.classList.remove('hidden'); 
        editNameBtn.classList.add('hidden'); // No tiene sentido editar si ya estás editando
    }

    function showServices() {
        const currentName = fullNameInput.value; 
        
        // Actualizar saludo
        welcomeUserMessage.textContent = `Hola, ${currentName}`;

        // Ocultar herramientas de entrada
        qwertyKeyboardContainer.classList.add('hidden');
        fullNameContainer.classList.add('hidden');

        // Mostrar herramientas de selección
        serviceSelectionContainer.classList.remove('hidden');
        
        // Mostrar barra de acciones
        actionButtonsContainer.classList.remove('hidden');
        editNameBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
    }

    function resetToStep1() {
        // Ocultar Paso 2 completo
        step2.classList.add('hidden');
        
        // Resetear estados internos del Paso 2
        welcomeUserMessage.textContent = '';
        fullNameContainer.classList.add('hidden');
        serviceSelectionContainer.classList.add('hidden');
        actionButtonsContainer.classList.add('hidden');

        // Limpiar inputs
        identificationInput.value = '';
        fullNameInput.value = '';
        
        // Reset Checkbox
        habeasDataCheck.checked = true; 

        // Mostrar Paso 1 completo
        step1.classList.remove('hidden');
    }
});