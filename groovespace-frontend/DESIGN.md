# Sistema de diseño GrooveSpace

Tokens en `src/index.css`, componentes en `src/ui/design.css`, utilidades React en `src/ui/kit.jsx` e iconos en `src/ui/icons.jsx`.

**Reglas:** bloques de color planos · líneas de 1 px · esquinas rectas · sin sombras, degradados ni brillos · texto alineado a la izquierda · una cosa dominante por sección · movimiento ≤ 400 ms (respeta `prefers-reduced-motion`).

| Elemento | Valor |
|---|---|
| Paleta | fondo `#100d17`, panel `#1d1725`, lima `#c2ff3c` (solo acción principal y estados activos), rosa `#ff5d8f` (numeración y etiquetas) |
| Tipografía | Inter (Source Sans como alternativa). Display 40–72 px · H1 32–52 · H2 28–40 · H3 20 · cuerpo 16/1.5 · apoyo 14 · etiqueta 12 |
| Espaciado | múltiplos de 8 (`--s-1` … `--s-8`) |
| Botones | primario (lima, relleno), secundario (borde), texto (subrayado lima); alto 48 px (40 px `--sm`) |
| Enlaces | subrayado con grosor 2 px lima; hover en lima |
| Foco | contorno lima 2 px con separación de 2 px, siempre visible |
| Rejilla | 12 columnas (`.gs-cols` + `.c-N` / `.s-N`), una columna en móvil |
| Iconos | un solo juego (Lucide, trazo 1.75), vía `icons.jsx` |
| Fotos | reales del proyecto o `<Placeholder label=…>` (rótulo "FOTO", borde punteado) |

Datos de contacto de ejemplo: `src/lib/site.js` (sustituir antes de publicar).
