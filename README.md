# Garaje — mantenimiento del carro

App para llevar el plan y el historial de mantenimiento de tu carro: aceite, llantas, frenos,
revisiones, kilometraje y vencimientos. Funciona como **PWA** en iPhone, Android y escritorio,
guarda todo **sin conexión** y puede sincronizar entre dispositivos con **Supabase**.

Hecha con React + TypeScript + Vite. Sin backend propio: el modo local funciona solo y la nube es
opcional.

## Arrancar

```bash
npm install       # solo la primera vez
npm run dev       # http://localhost:5173
```

La app arranca en **modo local** aunque no haya credenciales. Para activar la cuenta y la
sincronización, seguí la sección [Configurar Supabase](#configurar-supabase).

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción (ahí se prueba la PWA) |
| `npm run icons` | Regenera los íconos desde `scripts/generate-icons.mjs` |

## Qué hace

- Onboarding con nombre y kilometraje; crea un plan con 8 servicios típicos (aceite, rotación y
  cambio de llantas, frenos, revisión general, filtros, refrigerante y batería).
- Cada servicio tiene **intervalo por km y/o por meses** (podés usar uno o los dos).
- Calcula el próximo vencimiento desde el último servicio y muestra:
  - **Vencido** si ya pasaste los km o la fecha.
  - **Próximo** si falta poco (10% del intervalo o 30 días).
  - **Al día** en el resto.
- Barra de progreso del intervalo y texto tipo “faltan 800 km · en 12 días”.
- **Registrar servicio**: guarda fecha, km y detalle en el historial, actualiza el último servicio
  y sube el kilometraje si corresponde.
- Alta, edición y borrado de servicios personalizados.
- Filtros por estado y resumen con contadores.
- Guía rápida de mantenimiento integrada.
- Tema claro/oscuro automático, responsive y accesible.
- **PWA instalable**, con funcionamiento offline y actualización automática.
- **Cuenta opcional** con sincronización entre dispositivos (Supabase + RLS).

## Instalar en el celular

### iPhone / iPad (Safari)

1. Abrí la app publicada en **Safari**.
2. Tocá **Compartir** → **Añadir a pantalla de inicio**.
3. Abrilá desde el ícono nuevo.
4. Para sincronizar, entrá con tu email y usá el **código de 6 dígitos**. No uses el enlace del
   correo en iPhone: abre Safari y la sesión quedaría en Safari, no en la app instalada.

La app instalada tiene su propio almacenamiento, separado de Safari. Por eso conviene
**instalarla primero y después iniciar sesión**. Si ya iniciaste sesión en Safari, podés volver a
entrar en la app con un código nuevo.

### Android / escritorio

- Chrome/Edge: menú → **Instalar app** (o el botón “Instalar app” que aparece en la app).
- Safari en Mac: **Archivo** → **Añadir al Dock**.

La app funciona sin conexión después de la primera visita. Si desinstalás la PWA o borrás los
datos del navegador, se borra la copia local; con cuenta, los datos vuelven desde la nube.

## Configurar Supabase

### 1. Crear el proyecto y la tabla

1. Creá un proyecto en [supabase.com](https://supabase.com) (elegí la región más cercana).
2. Abrí **SQL Editor** → **New query**.
3. Pegá el contenido de [`supabase/schema.sql`](supabase/schema.sql) y ejecutá con **Run**.
4. Verificá en **Table Editor** que exista `public.garages` y que tenga **RLS enabled**.

El esquema crea:

- `garages` con una fila por usuario (`user_id` es la PK), `data jsonb`, `client_id` y
  `updated_at`.
- Políticas RLS para que cada usuario solo lea/escriba su propia fila.
- Realtime habilitado para la tabla.
- Un trigger que pone `updated_at` con la hora del servidor.

### 2. Activar el acceso por email y el código

El acceso por email viene activado por defecto. Para que la app pueda pedir un **código de 6
dígitos**, editá la plantilla **Magic Link**:

1. **Authentication** → **Email Templates** → **Magic Link**.
2. Asunto sugerido: `Código de acceso a Garaje`.
3. Cuerpo sugerido:

```html
<h2>Tu código de acceso</h2>
<p>Ingresá este código en Garaje:</p>
<p style="font-size: 28px; font-weight: 700; letter-spacing: 6px">{{ .Token }}</p>
<p>También podés abrir este enlace desde el mismo dispositivo:</p>
<p><a href="{{ .ConfirmationURL }}">Entrar a Garaje</a></p>
```

Sin `{{ .Token }}` el email solo trae el enlace. En iPhone el enlace abre Safari, así que el
código es el camino recomendado.

### 3. Configurar URLs de redirección

En **Authentication** → **URL Configuration**:

- **Site URL**: la URL principal (al principio `http://localhost:5173`; después la de Vercel).
- **Redirect URLs**: agregá cada origen desde el que se puede pedir el enlace:
  - `http://localhost:5173`
  - `https://tu-app.vercel.app`
  - Si usás previews de Vercel, podés agregar un patrón como
    `https://*-tu-equipo.vercel.app/**` (más amplio; usalo con cuidado).

La app manda `emailRedirectTo: window.location.origin`, así que el origen debe estar permitido.

### 4. Variables de entorno

1. En **Project Settings** → **API**, copiá **Project URL** y la **anon public** (o
   `sb_publishable_...`) key.
2. Copiá `.env.example` a `.env.local` y completá:

```bash
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-publica
```

3. Reiniciá `npm run dev`.

La anon key es **pública** y puede viajar al navegador: RLS protege los datos. La
**service_role** key nunca debe estar en el frontend ni en el repo.

### 5. Email para usuarios reales

El servicio de email integrado de Supabase está limitado a **2 emails por hora por proyecto**, que
sirve para probar pero no para publicar. Para producción, configurá un SMTP propio en
**Authentication** → **Emails** → **SMTP Settings** (Resend, Brevo, SendGrid, etc.). Revisá también
los [rate limits de Supabase](https://supabase.com/docs/guides/auth/rate-limits).

### 6. Probar

1. Con la app abierta, tocá el chip de cuenta → **Iniciar sesión**.
2. Ingresá tu email y pedí el código.
3. Pegá el código de 6 dígitos. La app carga el garaje de la nube; si la cuenta es nueva, sube el
   garaje de ese dispositivo.
4. Abrí la app en otro dispositivo, entrá con el mismo email y verificá que aparezca el mismo
   garaje.

## Publicar en Vercel

1. Subí el repo a GitHub.
2. En [vercel.com](https://vercel.com): **Add New** → **Project** → importá el repo.
3. Vercel detecta Vite. Build: `npm run build`; Output: `dist`.
4. En **Environment Variables** cargá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` para
   Production (y Preview si querés).
5. Deploy. Las variables `VITE_*` se incrustan en el build: si las cambiás, **redeploy**.
6. Copiá el dominio (`https://tu-app.vercel.app`) y actualizá **Site URL** + **Redirect URLs** en
   Supabase.
7. Probá el login y la instalación desde el celular.

No hace falta `vercel.json`: la app no usa rutas del lado del cliente y Vercel sirve `index.html`
y los assets estáticos directamente.

## Sincronización y datos

### Dónde viven los datos

- **IndexedDB** es la fuente local principal (`garaje` / `cache` / `garage`).
- **localStorage** guarda un espejo (`garaje.v1`) para el primer render y para migrar datos de
  versiones anteriores. Al cargar, IndexedDB manda; si está vacío, se migra el espejo.
- Se llama a `navigator.storage.persist()` para pedir almacenamiento persistente (importante en
  iOS).
- Con cuenta, la nube guarda **un documento JSON por usuario** en `public.garages`.

### Cómo sincroniza

1. Al iniciar sesión se lee la fila del usuario.
2. Si la cuenta **tiene** garaje, gana la nube (la copia local se reemplaza).
3. Si la cuenta está **vacía**, se sube el garaje local.
4. Cada cambio local se sube con un debounce de ~700 ms.
5. Los cambios de otros dispositivos llegan por **Realtime** (`postgres_changes`).
6. Si la lectura inicial falla, la app **no sube** nada hasta poder leer la nube: así un error de
   red no pisa datos remotos.
7. Al cerrar sesión se intenta sincronizar y después se borra la copia local. Si la subida falla,
   no se cierra la sesión.

Es **last-write-wins** a nivel de documento: no hay merge por campo. Si editás el mismo garaje en
dos dispositivos al mismo tiempo, gana la última escritura. Para el uso normal (un dispositivo a
la vez) alcanza; si más adelante hace falta, se puede pasar a operaciones por servicio.

### Límites conocidos

- Un solo vehículo por cuenta.
- Borrar la cuenta de email no es autoservicio todavía: se puede borrar el garaje desde la app,
  pero el usuario de Auth se elimina desde el panel de Supabase. Si publicás para terceros,
  conviene agregar un borrado de cuenta (Edge Function con service role) y actualizar la política
  de privacidad.
- No hay exportación/importación JSON todavía.
- El email integrado de Supabase limita a 2 envíos por hora.
- El plan gratuito de Supabase puede pausar el proyecto tras una semana sin actividad; para una
  app pública con usuarios conviene revisar el plan o mantener actividad.
- En iOS, la PWA y Safari no comparten almacenamiento: instalá primero y usá el código.

## Seguridad

- **RLS** en `garages`: cada usuario solo ve y modifica su fila (`auth.uid() = user_id`).
- La **anon key** es pública por diseño; no da acceso a datos de otros usuarios.
- Nunca uses la **service_role** key en el cliente, en `VITE_*` ni en el repo.
- `.env.local` está ignorado por git.
- Para una app pública, considerá activar **CAPTCHA (Turnstile)** en Supabase Auth y un SMTP
  propio para limitar abuso.

## Privacidad

Hay una página estática en [`public/privacidad.html`](public/privacidad.html) (queda en
`/privacidad.html`). **Antes de publicar, reemplazá el email de contacto de ejemplo** y revisá el
texto con alguien que sepa del tema: es una base, no asesoría legal.

## Estructura

```text
src/
  main.tsx                 Punto de entrada + registro del service worker
  App.tsx                  Pantalla principal, filtros, diálogos y cuenta
  useGarage.ts             Estado, caché local, sync y Realtime
  useAuth.ts               Sesión, envío de código y verificación
  storage.ts               IndexedDB + espejo en localStorage
  supabase.ts              Cliente condicional según variables de entorno
  maintenance.ts           Cálculos de vencimiento, orden y formato
  types.ts                 Tipos del dominio
  components/
    SetupScreen.tsx        Onboarding (nombre + km)
    ItemCard.tsx           Tarjeta de un servicio
    ItemDialog.tsx         Crear/editar servicio
    ServiceDialog.tsx      Registrar un servicio hecho
    VehicleDialog.tsx      Editar nombre y kilometraje
    AccountDialog.tsx      Login, cuenta y estado de sincronización
    InstallCard.tsx        Instalación en iOS/Android/escritorio
    Modal.tsx              Diálogo base
    Guide.tsx              Guía rápida
  styles.css               Estilos y temas
public/
  favicon.svg              Ícono vectorial
  icons/                   Íconos PWA (192, 512 y maskable)
  apple-touch-icon.png     Ícono para iOS
  privacidad.html          Política de privacidad
  robots.txt
supabase/
  schema.sql               Tabla, RLS, Realtime y trigger
scripts/
  generate-icons.mjs       Genera los PNG desde el SVG
```

## Cómo se calcula el estado

En `maintenance.ts`, `getDue()` combina las dos dimensiones:

```text
dueKm    = lastKm + intervalKm
kmLeft   = dueKm - currentKm

dueDate  = lastDate + intervalMonths
daysLeft = dueDate - hoy
```

- Vencido si `kmLeft < 0` o `daysLeft < 0`.
- Próximo si `kmLeft <= max(300, 10% del intervalo)` o `daysLeft <= 30`.
- El progreso es el mayor entre `km usados / intervalo` y `días usados / meses del intervalo`.

## Ideas para seguir

1. **Costos**: campo `cost` en cada registro y total gastado por año.
2. **Recordatorios**: notificaciones web (en iOS requieren la PWA instalada) o exportar `.ics`.
3. **Varios vehículos**: lista de garajes con selector.
4. **Exportar/importar JSON**: respaldo real de los datos.
5. **Modo millas**: cambiar unidad y convertir intervalos.
6. **Borrado de cuenta** autoservicio con una Edge Function.
7. **Tests**: Vitest para `getDue` (bordes de fecha, meses cortos, km negativos).
8. **App nativa** con Capacitor, solo si la PWA crece.

## Aviso

Los intervalos precargados son orientativos. Siempre priorizá el manual del fabricante y las
condiciones reales de uso (ciudad, tierra, carga, clima).
