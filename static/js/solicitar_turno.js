document.addEventListener('DOMContentLoaded', function () {
    const step1 = document.getElementById('step-1-identification');
    const step2 = document.getElementById('step-2-services');
    const continueBtn = document.getElementById('continue-btn');
    const identificationInput = document.getElementById('numero_identificacion');
    const loadingMessage = document.getElementById('loading-message');
    
    const welcomeUserMessage = document.getElementById('welcome-user-message');
    const fullNameContainer = document.getElementById('full-name-container');
    const fullNameInput = document.getElementById('nombre_completo');
    const serviceButtons = document.querySelectorAll('.service-button');

    continueBtn.addEventListener('click', async function () {
        const identificacion = identificationInput.value;
        if (!identificacion) {
            alert('Por favor, ingrese un número de identificación.');
            return;
        }

        loadingMessage.classList.remove('hidden');
        continueBtn.disabled = true;

        try {
            // Llamamos a la API que creamos en Flask para verificar el cliente
            const response = await fetch(`/api/check-cliente/${identificacion}`);
            const data = await response.json();

            // Ocultamos el paso 1 y mostramos el paso 2
            step1.classList.add('hidden');
            step2.classList.remove('hidden');

            if (data && data.nombre_completo) {
                // Si el cliente existe, le damos la bienvenida y rellenamos el campo de nombre (que estará oculto)
                welcomeUserMessage.textContent = `Hola de nuevo, ${data.nombre_completo}!`;
                fullNameInput.value = data.nombre_completo;
                fullNameContainer.classList.add('hidden'); // Mantenemos el campo de nombre oculto
            } else {
                // Si el cliente es nuevo, le pedimos el nombre
                welcomeUserMessage.textContent = '¡Bienvenido!';
                fullNameInput.value = '';
                fullNameContainer.classList.remove('hidden'); // Mostramos el campo para que lo rellene
                fullNameInput.focus(); // Ponemos el cursor en el campo de nombre
            }
            
            // Habilitamos los botones de servicio
            serviceButtons.forEach(button => button.disabled = false);

        } catch (error) {
            console.error('Error al verificar el cliente:', error);
            alert('Hubo un error al verificar la identificación. Por favor, intente de nuevo.');
            step1.classList.remove('hidden');
            step2.classList.add('hidden');
        } finally {
            loadingMessage.classList.add('hidden');
            continueBtn.disabled = false;
        }
    });
});