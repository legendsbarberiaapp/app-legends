/**
 * LEGENDS BARBERIA - NIVEL THEME
 *
 * Fuente única de verdad para el color asociado a cada nivel de barbero.
 * Se usa en cards de cita (admin + cliente), listas, badges, etc.
 *
 *   Leyenda     → dorado  (primary)
 *   Profesional → morado
 *   Experto     → azul
 *
 * Uso:
 *   const theme = window.nivelTheme(barbero.nivel);
 *   <div style="${theme.borderLeft}">...<span class="${theme.textCls}">${barberoNombre}</span></div>
 */

(function () {
    'use strict';

    const THEMES = {
        Leyenda: {
            textCls:     'text-primary',
            dotCls:      'bg-primary',
            borderLeft:  'border-left: 3px solid rgba(201,167,74,0.55);',
            glow:        'rgba(201,167,74,0.18)',
            hex:         '#c9a74a'
        },
        Profesional: {
            textCls:     'text-purple-400',
            dotCls:      'bg-purple-400',
            borderLeft:  'border-left: 3px solid rgba(168,85,247,0.55);',
            glow:        'rgba(168,85,247,0.18)',
            hex:         '#c084fc'
        },
        Experto: {
            textCls:     'text-blue-400',
            dotCls:      'bg-blue-400',
            borderLeft:  'border-left: 3px solid rgba(59,130,246,0.55);',
            glow:        'rgba(59,130,246,0.18)',
            hex:         '#60a5fa'
        }
    };

    // Tema neutro para citas legacy sin nivel guardado / nivel desconocido.
    const DEFAULT_THEME = {
        textCls:     'text-white/70',
        dotCls:      'bg-white/40',
        borderLeft:  '',
        glow:        'rgba(255,255,255,0)',
        hex:         '#ffffff'
    };

    function nivelTheme(nivel) {
        return THEMES[nivel] || DEFAULT_THEME;
    }

    window.nivelTheme = nivelTheme;
    console.log('✓ NivelTheme loaded');
})();
