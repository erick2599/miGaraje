# Notas

App de notas y tareas hecha con **React + TypeScript + Vite**. Sin backend: todo se guarda en el
`localStorage` del navegador, así que funciona offline y no necesita base de datos.

## Arrancar

```bash
npm install     # solo la primera vez
npm run dev     # abre http://localhost:5173
```

Otros comandos:

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo con recarga automática |
| `npm run build` | Typecheck + build de producción en `dist/` |
| `npm run preview` | Sirve el build de producción para probarlo |

## Qué trae

- Crear notas con el botón **Añadir** o la tecla `Enter`.
- Marcar como completadas con el checkbox.
- Editar haciendo clic sobre el texto (`Enter` guarda, `Esc` cancela).
- Eliminar con la `×` que aparece al pasar el mouse.
- Filtrar por **Todas / Pendientes / Completadas** con contadores.
- Buscar por texto.
- Barra de progreso y botón para borrar las completadas.
- Tema claro/oscuro automático según el sistema.
- Diseño responsive y accesible (foco visible, etiquetas ARIA, `prefers-reduced-motion`).

## Estructura

```text
src/
  main.tsx        Punto de entrada de React
  App.tsx         Pantalla principal: formulario, filtros, búsqueda y lista
  NoteRow.tsx     Una fila de nota + su modo de edición
  useNotes.ts     Estado y persistencia (localStorage)
  types.ts        Tipo Note y Filter
  styles.css      Todos los estilos y variables de tema
```

## Cómo funciona el estado

`useNotes` es un hook que:

1. Carga las notas desde `localStorage` al iniciar y valida su forma (`isNote`).
2. Expone `add`, `toggle`, `update`, `remove` y `clearCompleted`.
3. Guarda automáticamente en cada cambio.

Si algún día quieres backend, lo único que cambia es el interior de ese hook: el resto de la app
no se entera.

## Ideas para seguir practicando

En orden de dificultad:

1. **Prioridades**: campo `priority` y ordenar la lista.
2. **Etiquetas**: varias por nota, filtro por etiqueta.
3. **Fechas límite**: input `date` y resaltar las vencidas.
4. **Arrastrar para reordenar**: campo `order` + drag & drop.
5. **Deshacer al borrar**: guardar la última acción y mostrar un aviso.
6. **Tests**: Vitest + Testing Library para `useNotes` y los filtros.
7. **Sincronizar entre dispositivos**: backend propio o Supabase.
8. **Publicar**: GitHub Pages, Vercel o Netlify.

## Desplegar en GitHub Pages (resumen)

1. `npm run build`.
2. Publicar la carpeta `dist/` (por ejemplo con `gh-pages`).
3. Si el repo es `usuario.github.io/proyecto`, definir `base: '/proyecto/'` en `vite.config.ts`.
