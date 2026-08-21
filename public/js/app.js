// ========================================
// ELITE SOCCER - APP.JS
// ========================================

// Service Worker / PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/sw.js')
            .then(() => {
                console.log('Elite Soccer: Service Worker registrado.');
            })
            .catch((error) => {
                console.error(
                    'Elite Soccer: error registrando Service Worker:',
                    error
                );
            });
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