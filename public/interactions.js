/**
 * UI INTERACTIONS
 * Comportamientos globales de interacción: scroll suave para anchors,
 * feedback táctil en botones, bloqueo de drag en imágenes y vibración háptica.
 * Se engancha en DOMContentLoaded.
 */

document.addEventListener('DOMContentLoaded', () => {

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('touchstart', function () { this.style.opacity = '0.8'; });
        button.addEventListener('touchend', function () { this.style.opacity = '1'; });
        button.addEventListener('touchcancel', function () { this.style.opacity = '1'; });
    });

    document.querySelectorAll('img').forEach(img => {
        img.addEventListener('dragstart', (e) => e.preventDefault());
    });

    if ('vibrate' in navigator) {
        document.querySelectorAll('button, a, .cursor-pointer').forEach(element => {
            element.addEventListener('click', () => navigator.vibrate(10));
        });
    }
});
