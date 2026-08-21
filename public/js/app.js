// ========================================
// ELITE SOCCER - APP.JS
// ========================================

// ========================================
// SERVICE WORKER / PWA
// ========================================

if ('serviceWorker' in navigator) {

    window.addEventListener('load', async () => {

        try {

            const registration =
                await navigator.serviceWorker.register('/sw.js');

            console.log(
                'Elite Soccer: Service Worker registrado.',
                registration
            );

            // Verificar si existe una actualización
            registration.update();

        } catch (error) {

            console.error(
                'Elite Soccer: error registrando Service Worker:',
                error
            );

        }

    });

}


// ========================================
// CONFIRMACIONES
// ========================================

document.addEventListener('DOMContentLoaded', () => {

    document
        .querySelectorAll('[data-confirm]')
        .forEach((element) => {

            element.addEventListener('click', (event) => {

                const message =
                    element.getAttribute('data-confirm') ||
                    '¿Estás seguro de realizar esta acción?';

                if (!window.confirm(message)) {
                    event.preventDefault();
                }

            });

        });

});


// ========================================
// RECARGAR CUANDO HAY NUEVA VERSIÓN
// DEL SERVICE WORKER
// ========================================

if ('serviceWorker' in navigator) {

    navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => {

            console.log(
                'Elite Soccer: nueva versión detectada.'
            );

            window.location.reload();

        }
    );

}