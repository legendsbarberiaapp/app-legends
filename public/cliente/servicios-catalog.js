/**
 * LEGENDS BARBERIA - CATÁLOGO DE SERVICIOS (FUENTE ÚNICA)
 * Los servicios principales que puede reservar el cliente.
 * Usado por booking-ui y services-ui — si lo cambias aquí, cambia en ambos.
 *
 * TODO: cuando el admin tenga UI de catálogo, migrar este array a Firestore
 * y cargar desde ahí. Mientras tanto, edita este archivo para agregar/quitar
 * servicios o ajustar precios.
 */

window.SERVICIOS_CATALOG = [
    {
        id: 'corte-clasico',
        nombre: 'Corte Clásico',
        precio: 40,
        duracionMin: 45,
        icon: 'content_cut',
        descripcion: 'Corte tradicional con acabado profesional'
    },
    {
        id: 'corte-barba',
        nombre: 'Corte + Barba',
        precio: 60,
        duracionMin: 75,
        icon: 'face',
        descripcion: 'Combo completo: corte y arreglo de barba',
        popular: true
    },
    {
        id: 'afeitado',
        nombre: 'Afeitado Premium',
        precio: 35,
        duracionMin: 30,
        icon: 'waves',
        descripcion: 'Afeitado con navaja y toalla caliente'
    },
    {
        id: 'degradado',
        nombre: 'Degradado',
        precio: 45,
        duracionMin: 45,
        icon: 'straighten',
        descripcion: 'Fade limpio y preciso'
    }
];

console.log('✓ ServiciosCatalog loaded');
