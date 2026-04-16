# 🔥 LEGENDS BARBERIA - APP MÓVIL

> **Your cut. Your style. Your throne.**

Una aplicación móvil estática para barbería urbana de lujo con estética hip-hop/reggaeton premium.

---

## 📱 CARACTERÍSTICAS

### Pantallas Implementadas

1. **Splash Screen** - Pantalla de bienvenida con logo y acceso
2. **Home Dashboard** - Portada con hero, noticias y accesos rápidos
3. **Services** - Catálogo de servicios premium
4. **Barbers** - Galería del equipo de barberos elite
5. **Booking** - Flujo de reserva visual (servicio, barbero, fecha/hora)
6. **Profile** - Perfil de usuario con sistema de lealtad

---

## 🎨 DISEÑO

### Paleta de Colores
- **Dorado Principal**: `#c9a74a`
- **Negro Mate**: `#121212`, `#171717`, `#1f1f1f`
- **Efectos**: Glassmorphism, sombras neón doradas

### Tipografía
- **Plus Jakarta Sans** (Google Fonts)
- Pesos: 300, 400, 500, 600, 700, 800

### Estilo Visual
- Fotografía urbana premium
- Efectos glassmorphism en cards
- Gradientes dorados
- Bordes sutiles con opacidad baja
- Iconografía Material Symbols Outlined

---

## 📁 ESTRUCTURA DEL PROYECTO

```
APP LEGENDS/
│
├── index.html                  # Wrapper principal (tabs + splash + login)
├── styles.css                  # Estilos personalizados
├── parametros.md               # Guía de estética
├── HANDOFF.md                  # Notas de la refactorización
├── README.md                   # Este archivo
│
└── public/
    ├── app.js                  # Ciclo de vida + navegación entre tabs
    ├── role-config.js          # Roles válidos y tabs por rol
    ├── role-manager.js         # Render de la interfaz según el rol
    ├── firebase-adapter.js     # Auth (Google) + acceso a Firestore
    ├── barber-manager.js       # Facade del panel de barberos (admin)
    ├── screen-loader.js        # Carga lazy de los partials HTML
    ├── interactions.js         # Touch, haptic, scroll suave
    │
    ├── screens/                # Contenido HTML de cada tab
    │   ├── cliente/            # home, services, barbers, booking, profile
    │   ├── barbero/            # dashboard, citas, servicios, stats, perfil
    │   └── admin/              # dashboard, usuarios, barberos, reportes, config
    │
    ├── services/               # Capa de datos (Firebase puro, sin UI)
    │   ├── barbers-service.js
    │   ├── servicios-service.js
    │   └── adicionales-service.js
    │
    ├── admin/                  # UI del panel de administración
    │   ├── usuarios-ui.js
    │   ├── dashboard-ui.js
    │   └── (barbers-list-ui, barber-modal-ui, pickers, confirm-dialog)
    │
    └── components/
        └── toast.js            # window.showToast() global
```

---

## 🚀 CÓMO USAR

### Instalación

1. **Abrir la app**
   ```bash
   # Simplemente abre index.html en tu navegador
   # O usa Live Server en VS Code
   ```

2. **Ver en dispositivo móvil**
   - Usa las herramientas de desarrollo (F12)
   - Activa el modo "Responsive Design" o "Device Toolbar"
   - Selecciona un dispositivo móvil (iPhone, Android, etc.)

### Navegación

- **Splash Screen**: Click en "Enter App" para acceder
- **Tabs Inferiores**: Navega entre Home, Services, Barbers, Profile
- **Botón "Book Now"**: Lleva al flujo de reservas
- **Todo es visual**: No hay funcionalidad backend

---

## 🛠️ TECNOLOGÍAS

- **HTML5**: Estructura semántica
- **Tailwind CSS**: Framework de utilidades (CDN)
- **CSS Custom**: Efectos glassmorphism, gradientes, animaciones
- **JavaScript Vanilla**: Navegación entre tabs (mínimo código)
- **Google Fonts**: Plus Jakarta Sans
- **Material Symbols**: Iconografía

---

## ⚠️ IMPORTANTE

### Antes de Modificar

**SIEMPRE lee primero [`parametros.md`](./parametros.md)** - Contiene:
- Paleta de colores exacta
- Guía de tipografía
- Componentes visuales
- Reglas de diseño
- Tono de marca

### Restricciones

❌ **NO IMPLEMENTADO (solo visual)**:
- Backend / Base de datos
- Autenticación real
- Integración con APIs
- Procesamiento de pagos
- Sistema de reservas funcional

✅ **SÍ IMPLEMENTADO**:
- Diseño responsive
- Navegación entre pantallas
- Efectos visuales y animaciones
- Estructura HTML semántica
- Clases CSS bien nombradas

---

## 📸 CAPTURAS

### Splash Screen
![Splash]
- Logo con glow dorado
- Botones con borde dorado
- Fondo negro con smoke texture

### Home Dashboard
![Home]
- Hero con foto urbana
- Cards con glassmorphism
- FAB "Book Now" flotante

### Services
![Services]
- Grid de servicios
- Iconos dorados
- Precios en dorado

### Barbers Team
![Barbers]
- Cards verticales con fotos
- Rating con estrellas
- Status de disponibilidad

### Booking Flow
![Booking]
- Selección de servicio
- Galería de barberos
- Calendario y horarios

### Profile & Loyalty
![Profile]
- Avatar con ring neón
- Progress bar animada
- Historial de servicios

---

## 🎯 PRÓXIMOS PASOS (Para Desarrollo Futuro)

1. **Backend**
   - Base de datos (Firebase, Supabase, etc.)
   - API REST o GraphQL
   - Autenticación (Firebase Auth, Auth0, etc.)

2. **Funcionalidad**
   - Sistema de reservas real
   - Notificaciones push
   - Integración de pagos (Stripe, PayPal)
   - Chat con barberos

3. **Optimización**
   - Service Workers (PWA)
   - Caché de imágenes
   - Lazy loading
   - Optimización de assets

4. **Deploy**
   - Vercel, Netlify, o similar
   - Dominio personalizado
   - SSL/HTTPS
   - Analytics (Google Analytics, Mixpanel)

---

## 📝 NOTAS DE DESARROLLO

### Imágenes
Actualmente usa URLs de `googleusercontent.com` del diseño de Stitch. Para producción:
- Descargar y optimizar imágenes
- Usar servicios como Cloudinary o Imgix
- Implementar responsive images (srcset)

### Performance
- **Tailwind CSS**: Considera usar PostCSS para purgar clases no usadas
- **Google Fonts**: Considera self-hosting para mejor performance
- **JavaScript**: Mínimo código, listo para framework (React, Vue, etc.)

### Accesibilidad
- Agregar atributos ARIA
- Mejorar navegación por teclado
- Texto alternativo descriptivo en imágenes
- Contraste de colores cumple WCAG AA

---

## 👤 CRÉDITOS

- **Diseño Original**: Google Stitch
- **Desarrollo**: Claude Code (Anthropic)
- **Concepto**: Barbería urbana de lujo con estética hip-hop/Supreme

---

## 📄 LICENCIA

Este es un prototipo visual sin licencia específica. Todos los derechos del diseño original pertenecen a sus respectivos creadores.

---

## 🤝 CONTRIBUIR

Para modificar o extender este proyecto:

1. Lee `parametros.md` primero
2. Mantén la consistencia visual
3. Usa las clases CSS existentes
4. Documenta cambios significativos
5. Respeta la paleta de colores y tipografía

---

## 📞 SOPORTE

Para preguntas o soporte:
- Revisa `parametros.md` para guía de estética
- Revisa `Guia para crear la app` para contexto original
- Revisa `HANDOFF.md` para el estado de la refactorización

---

**Made with 🔥 for the culture**

*Legends Barberia - Where style meets precision*
