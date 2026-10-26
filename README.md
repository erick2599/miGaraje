# Garaje — mantenimiento del carro

App para llevar el mantenimiento de tu carro: kilometraje, servicios, vencimientos e historial.
Hecha con **React + TypeScript + Vite**, sin backend. Todo se guarda en el `localStorage` del
navegador.

## Arrancar

```bash
npm install     # solo la primera vez
npm run dev     # abre http://localhost:5173
```

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción |

## Qué hace

- Al empezar, pedís nombre y kilometraje del carro y crea un plan con 8 servicios típicos:
  aceite, rotación y cambio de llantas, frenos, revisión general, filtros, refrigerante y batería.
- Cada servicio tiene **intervalo por km y/o por meses** (podés usar uno o los dos).
- Calcula el próximo vencimiento desde el último servicio y muestra:
  - **Vencido** si ya pasaste los km o la fecha.
  - **Próximo** si falta poco (10% del intervalo o 30 días).
  - **Al día** en el resto.
- Barra de progreso del intervalo y texto tipo "faltan 800 km · en 12 días".
- **Registrar servicio**: guarda fecha, km y detalle en el historial, actualiza el último servicio y
  sube el kilometraje si corresponde.
- Alta, edición y borrado de servicios personalizados.
- Filtros por estado y resumen con contadores.
- Guía rápida de mantenimiento integrada (qué revisar y cada cuánto).
- Tema claro/oscuro automático, responsive y accesible.

## Estructura

```text
src/
  main.tsx                 Punto de entrada
  App.tsx                  Pantalla principal, resumen, filtros y diálogos
  useGarage.ts             Estado, persistencia y datos iniciales
  maintenance.ts           Cálculos de vencimiento, orden y formato
  types.ts                 Tipos del dominio
  components/
    SetupScreen.tsx        Onboarding (nombre + km)
    ItemCard.tsx           Tarjeta de un servicio
    ItemDialog.tsx         Crear/editar servicio
    ServiceDialog.tsx      Registrar un servicio hecho
    VehicleDialog.tsx      Editar nombre y kilometraje
    Modal.tsx              Diálogo base
    Guide.tsx              Guía rápida
  styles.css               Estilos y temas
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

Los datos viven en `localStorage` bajo la clave `garaje.v1`, con validación al cargar.

## Ideas para seguir

1. **Costos**: campo `cost` en cada registro y total gastado por año.
2. **Recordatorios**: exportar un `.ics` o notificaciones del navegador.
3. **Varios vehículos**: lista de garajes con selector.
4. **Exportar/importar JSON**: respaldo real de los datos.
5. **Modo millas**: cambiar unidad y convertir intervalos.
6. **Tests**: Vitest para `getDue` (bordes de fecha, meses cortos, km negativos).
7. **Publicar**: GitHub Pages, Vercel o Netlify.

## Aviso

Los intervalos precargados son orientativos. Siempre priorizá el manual del fabricante y las
condiciones reales de uso (ciudad, tierra, carga, clima).
