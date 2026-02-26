# LEGENDS BARBERIA - GUÍA DE ESTÉTICA Y DISEÑO

## 🎨 PALETA DE COLORES EXACTA

### Colores Primarios
- **Dorado Principal (Primary)**: `#c9a74a`
- **Dorado Oscuro**: `#b88a44`, `#b08d35`
- **Dorado Claro**: `#eecf72`, `#e0c470`, `#dcb95b`, `#d4b455`

### Fondos y Superficies
- **Background Dark (Principal)**: `#121212` (Negro mate charcoal)
- **Background Dark (Alternativo)**: `#1f1c13` (Negro mate con tono café)
- **Matte Black**: `#171717`, `#0A0A0A`
- **Surface Dark**: `#1E1E1E`, `#1f1f1f`, `#2a261c`, `#2a261e`, `#2a271f`, `#25231e`
- **Surface Card**: `#36332b`
- **Surface Lighter**: `#2A2A2A`

### Textos y Bordes
- **Blanco roto**: `#F5F5F5`, `#f8f7f6`
- **Bordes sutiles**: `rgba(255, 255, 255, 0.05)` a `rgba(255, 255, 255, 0.10)`
- **Grises neutros**: `#neutral-400`, `#neutral-500`, `#neutral-600`, `#slate-300`, `#slate-400`, `#slate-500`

## 📝 TIPOGRAFÍA

### Fuente Principal
- **Familia**: Plus Jakarta Sans (Google Fonts)
- **Pesos utilizados**: 300, 400, 500, 600, 700, 800
- **Itálicas**: Usadas para taglines elegantes

### Jerarquía Tipográfica
- **Títulos principales (H1)**: `text-3xl` a `text-4xl`, `font-extrabold`, `tracking-tight`
- **Subtítulos (H2)**: `text-xl` a `text-2xl`, `font-bold`, `tracking-tight`, `uppercase`
- **Cuerpo**: `text-sm` a `text-base`, `font-medium`
- **Labels pequeños**: `text-xs` a `text-[10px]`, `font-bold`, `uppercase`, `tracking-wider` o `tracking-widest`
- **Taglines especiales**: `italic`, `text-gold-gradient`

## 🎭 EFECTOS VISUALES Y COMPONENTES

### Glassmorphism
```css
background: rgba(31, 31, 31, 0.6);
backdrop-filter: blur(12px);
-webkit-backdrop-filter: blur(12px);
border: 1px solid rgba(201, 167, 74, 0.15);
```

### Gradientes de Dorado
```css
/* Texto con gradiente dorado */
background: linear-gradient(to right, #b88a44, #eecf72, #b88a44);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
background-size: 200% auto;

/* Borde con gradiente dorado */
border: 1px solid transparent;
background: linear-gradient(#1f1c13, #1f1c13) padding-box,
            linear-gradient(to right, #b88a44, #eecf72) border-box;
```

### Sombras Neón Doradas
- **Suave**: `shadow-[0_0_10px_rgba(201,167,74,0.5)]`
- **Media**: `shadow-[0_0_15px_rgba(201,167,74,0.4)]`
- **Intensa**: `shadow-[0_0_20px_rgba(201,167,74,0.4)]` a `shadow-[0_0_25px_rgba(201,167,74,0.6)]`
- **Botón principal**: `shadow-[0_4px_20px_rgba(201,167,74,0.3)]`

### Texturas de Fondo
- **Smoke Overlay**: Textura de humo con `mix-blend-mode: overlay`, `opacity: 0.15`, `filter: grayscale(100%)`
- **Grain/Noise**: Textura sutil de ruido con SVG noise filter, `opacity: 0.05`
- **Gradientes oscuros**: `from-black/60 via-transparent to-background-dark`

## 🖼️ ESTILO FOTOGRÁFICO

### Temática Visual
- **Urbano premium**: Cadenas doradas, gorras, streetwear
- **Barbería**: Fades, líneas perfectas, clippers, scissors
- **Texturas**: Tatuajes, manos trabajando, herramientas profesionales
- **Iluminación**: Dramática, high contrast, sombras marcadas
- **Filtros**: Grayscale con overlays oscuros, gradientes from-black

### Tratamiento de Imágenes
- **Overlay básico**: `bg-gradient-to-t from-black via-black/50 to-transparent`
- **Hover effects**: `group-hover:scale-105`, `transition-transform duration-700`
- **Grayscale interactivo**: `filter grayscale`, `group-hover:grayscale-0`

## 🎯 COMPONENTES CLAVE

### Cards (Tarjetas)
- **Fondo**: `bg-card-dark`, `bg-surface-card`
- **Bordes**: `border border-white/5`, hover: `border-primary/30` o `border-primary/50`
- **Padding**: `p-4` a `p-5`
- **Bordes redondeados**: `rounded-xl` a `rounded-2xl`
- **Shadow**: `shadow-lg`, `shadow-2xl shadow-black/50`

### Botones

#### Botón Principal (CTA)
```css
bg-primary hover:bg-yellow-500
text-black font-bold
rounded-xl px-5 py-4
shadow-[0_0_20px_rgba(201,167,74,0.4)]
transition-all
active:scale-95 o active:scale-[0.98]
```

#### Botón Secundario
```css
bg-white/10 border border-white/10
text-white font-bold
rounded-lg px-5 py-2.5
hover:bg-white/20
```

#### Botón Terciario/Ghost
```css
bg-white/5 hover:bg-white/10
border border-primary/40
transition-all duration-300
```

### Barra de Navegación Inferior
- **Fondo**: `bg-matte-black/90` o `bg-[#25231e]/95`, `backdrop-blur-xl`
- **Borde superior**: `border-t border-white/10`
- **Padding**: `px-2 pb-5 pt-2`
- **Items activos**: `text-primary`, ícono filled
- **Items inactivos**: `text-gray-500` o `text-white/40`, hover: `text-primary`
- **Iconos**: Material Symbols Outlined, tamaño `text-[26px]`
- **Labels**: `text-[10px]`, `font-bold`, `uppercase`, `tracking-widest`

### Tabs/Filtros
- **Tab activo**: `bg-primary text-black font-bold`
- **Tab inactivo**: `bg-white/5 border border-white/10 text-slate-300`
- **Forma**: `rounded-full`, `px-5`, `h-9`
- **Hover**: `hover:bg-white/10`

### Inputs y Selectores
- **Estados seleccionados**: Borde `border-2 border-primary`, checkmark con `bg-primary`
- **Estados no seleccionados**: `border-2 border-transparent`, checkbox vacío con `border border-neutral-600`
- **Hover**: `hover:border-primary/50`

### Progress Bar (Lealtad)
```css
/* Contenedor */
h-3 bg-surface-lighter rounded-full

/* Barra de progreso */
bg-gradient-to-r from-primary-dark via-primary to-primary-light
rounded-full
shadow-[0_0_10px_rgba(201,167,74,0.6)]

/* Shimmer effect */
animate-[shimmer_2s_infinite]
```

## 🏷️ TONO DE MARCA

### Voz y Personalidad
- **Urbano de lujo**: Mezcla de cultura de calle con servicio premium
- **Confianza y exclusividad**: "Legends", "Your throne", "Elite Squad"
- **Lenguaje casual-cool**: "homie", "squad", "fresh cut", "The Blade", "Fade"
- **Empowerment**: "Your cut. Your style. Your throne."

### Copy Style
- Headlines en **UPPERCASE BOLD**
- Taglines en *itálico dorado*
- Labels pequeños en **UPPERCASE TRACKING-WIDE**
- Precios siempre en **dorado bold** (ej: `$45.00`)

## 📐 ESPACIADO Y LAYOUT

### Contenedores Principales
- **Max width móvil**: `max-w-md mx-auto`
- **Padding horizontal**: `px-4` a `px-6`
- **Gaps entre elementos**: `gap-3` a `gap-4`

### Bordes Redondeados
- **Pequeños**: `rounded-lg` (0.5rem)
- **Medianos**: `rounded-xl` (0.75rem)
- **Grandes**: `rounded-2xl` (1rem)
- **Circular**: `rounded-full`

### Animaciones y Transiciones
- **Duración estándar**: `duration-300` a `duration-500`
- **Duración lenta (imágenes)**: `duration-700`
- **Easing**: `ease-out`, `cubic-bezier(0.4, 0, 0.6, 1)`
- **Hover scale**: `hover:scale-105`, `active:scale-95`
- **Pulse**: `animate-pulse` para notificaciones y estados activos

## ✅ REGLAS DE DISEÑO

### DO (Hacer)
✅ Usar fondos negros mate (#121212, #1f1c13)
✅ Dorado como único color de acento (#c9a74a)
✅ Glassmorphism en cards con backdrop-blur
✅ Fotografía urbana con overlays oscuros
✅ Bordes sutiles con white/5 o white/10
✅ Sombras neón doradas en CTAs
✅ Tipografía bold y uppercase para headers
✅ Efectos de hover con scale y glow
✅ Material Symbols Outlined para íconos
✅ Plus Jakarta Sans para toda la tipografía
✅ Textura grain/smoke sutil en fondos

### DON'T (Evitar)
❌ Colores corporativos o paletas multicolor
❌ Fondos blancos o claros
❌ Stock photos genéricos
❌ Tipografías serif o script decorativas
❌ Gradientes rainbow o neón multi-color
❌ Bordes gruesos sin glassmorphism
❌ Sombras drop-shadow estándar (usar neón dorado)
❌ Animaciones bruscas o exageradas
❌ Íconos de diferentes familias mezclados

## 📱 PANTALLAS Y ESTRUCTURA

### 1. Splash Screen
- Logo centrado con glow dorado
- Fondo negro con smoke overlay
- Botones Google/App Store con borde dorado
- Tagline itálica con gradiente dorado

### 2. Home Dashboard
- Hero con foto urbana full-width
- Glassmorphism card con status
- News cards con horizontal scroll
- Botón flotante "Book Now" dorado
- Nav bar inferior fija

### 3. Services Tab
- Grid de cards con íconos dorados
- Nombre, duración y precio
- Hover effects con border-primary

### 4. Barbers Team
- Cards verticales con foto grande
- Rating con estrellas doradas
- Status badge (Available/Next Slot)
- Botón "Book Now" por barbero

### 5. Booking Flow
- Progress stepper con dots dorados
- Horizontal scroll para servicios
- Selección de barbero con fotos grayscale
- Calendario con día seleccionado dorado
- Time slots grid
- Footer sticky con resumen y CTA

### 6. Profile & Loyalty
- Avatar con ring dorado neón
- Progress bar dorada animada con shimmer
- Quick actions grid
- "Your Squad" horizontal scroll
- History list con estado de pago

## 🔧 TECNOLOGÍA

- **Framework CSS**: Tailwind CSS
- **Fuentes**: Google Fonts (Plus Jakarta Sans)
- **Íconos**: Material Symbols Outlined
- **Imágenes**: URLs de Googleusercontent (temporal para diseño)

---

**ÚLTIMA ACTUALIZACIÓN**: Basado en diseño exportado de Stitch (Feb 2026)
**REFERENCIA**: Siempre consultar este documento al iniciar sesión antes de modificar cualquier archivo
