# AGENTS.md - Mundo Templado CAD

## Contexto del Proyecto

Este repositorio es una PWA de CAD tecnico para corte de cristal templado.
Frontend puro: HTML + CSS + JavaScript vanilla, sin frameworks ni bundlers.
Desplegado en GitHub Pages. Sin backend (usa IndexedDB para persistencia local).

## Estado Actual (rama: main)

- `app.js` — monolito con toda la logica: coordenadas, render, eventos, storage, export
- `index.html` — shell de la PWA
- `styles.css` — UI responsiva mobile-first
- `manifest.json` + `sw.js` — configuracion PWA
- No existe carpeta `/src/` todavia
- No existe infraestructura de tests todavia

## Objetivo de Refactorizacion

REFACTORIZAR, NO REESCRIBIR.
Extraer modulos sin cambiar comportamiento visible ni UX tactil.

## Arquitectura Target

```
/src
  /core
    coordinateSystem.js  <- CALIBRATION, canvasToWorld, worldToCanvas
    geometry.js          <- lineLength, distToSegment, snapToGrid
  /rendering
    canvasRenderer.js    <- render, drawShape, drawGrid, drawMeasureLabel
    gridRenderer.js      <- drawGrid separado
  /tools
    lineTool.js
    rectTool.js
    booleanTool.js       <- futuro: union/subtract/intersect
  /export
    pdfExporter.js       <- jsPDF calibrado
    svgExporter.js       <- SVG con viewBox en mm
app.js                   <- orquestador, solo importa modulos
```

## Restricciones Criticas (OBLIGATORIO RESPETAR)

1. COMPATIBILIDAD 100%
   - No romper pinch-to-zoom (onTouchMove con 2 dedos)
   - No romper pan con mouse
   - No romper dibujo de lineas y rectangulos
   - No cambiar comportamiento visible

2. UNIDAD LOGICA: MILIMETROS
   - Todo calculo geometrico debe trabajar en mm
   - CALIBRATION.MM_PER_PX = 1 (ajustable por DPI)
   - CALIBRATION.PT_PER_MM = 2.835 (estandar ISO para PDF)

3. PRECISION
   - Error maximo permitido en round-trip worldToCanvas->canvasToWorld: < 0.1 mm
   - Las medidas mostradas en pantalla deben ser consistentes con exportacion

4. NO INTRODUCIR DEPENDENCIAS EXTERNAS en Semana 1-2
   - Sin npm, sin bundlers, sin frameworks
   - ES Modules nativos unicamente (type="module" en index.html)
   - Paper.js o jsPDF solo en Semana 2-3 si se aprueba

5. COMMITS ATOMICOS
   - Un commit por archivo creado o modificado
   - Mensaje formato: `refactor: descripcion breve`
   - No mezclar refactor con features nuevas en el mismo commit

## Funciones Clave a Extraer (Semana 1)

### De app.js -> src/core/coordinateSystem.js

```javascript
// Estado necesario (referencia via parametro o import)
// state.viewOffset: { x, y }  — desplazamiento en px
// state.viewScale: number      — factor de zoom
// canvas: HTMLCanvasElement

export const CALIBRATION = {
  MM_PER_PX: 1,       // 1 pixel logico = 1 mm (calibrable)
  PT_PER_MM: 2.835    // puntos PDF por milimetro (ISO)
};

// Convierte coordenadas de evento (clientX/Y) a mundo logico en mm
export function canvasToWorld(cx, cy, canvas, state) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (cx - r.left - state.viewOffset.x) / state.viewScale * CALIBRATION.MM_PER_PX,
    y: (cy - r.top  - state.viewOffset.y) / state.viewScale * CALIBRATION.MM_PER_PX
  };
}

// Convierte coordenadas logicas en mm a posicion en canvas en px
export function worldToCanvas(wx, wy, canvas, state) {
  const r = canvas.getBoundingClientRect();
  return {
    x: wx / CALIBRATION.MM_PER_PX * state.viewScale + state.viewOffset.x,
    y: wy / CALIBRATION.MM_PER_PX * state.viewScale + state.viewOffset.y
  };
}
```

## Test de Round-Trip (insertar cuando haya infra de tests)

```javascript
// Punto de insercion: /tests/coordinateSystem.test.js
describe('CoordinateSystem round-trip', () => {
  it('debe mantener precision < 0.1mm', () => {
    const mockState = { viewOffset: { x: 0, y: 0 }, viewScale: 1 };
    const mockCanvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
    const world = { x: 500, y: 300 };
    const screen = worldToCanvas(world.x, world.y, mockCanvas, mockState);
    const back = canvasToWorld(screen.x, screen.y, mockCanvas, mockState);
    expect(Math.abs(back.x - world.x)).toBeLessThan(0.1);
    expect(Math.abs(back.y - world.y)).toBeLessThan(0.1);
  });
});
```

## Riesgos Conocidos

| Riesgo | Impacto | Mitigacion |
|--------|---------|------------|
| DPI variable por dispositivo | Medidas incorrectas en hardware real | Rutina de autocalib manual con localStorage |
| `state` acoplado globalmente | Dificil testear modulos aislados | Pasar state como parametro en funciones puras |
| Logica de pan duplicada en onTouchMove | Bug si se refactoriza a medias | Extraer SOLO conversiones, no tocar eventos |
| `worldToCanvas` en insertHerraje usa coordenadas mezcladas | Error silencioso de escala | Auditar usos de worldToCanvas antes de extraer |

## Plan de 4 Semanas

- Semana 1: coordinateSystem.js + calibracion + actualizar app.js
- Semana 2: geometry.js + modularizacion + Paper.js para booleanos
- Semana 3: pdfExporter.js + svgExporter.js calibrados
- Semana 4: tests de precision + dirty-rectangle rendering

## Notas para Jules / Codex

- Lee este archivo ANTES de proponer cualquier cambio
- La rama de trabajo es `main` (no existe `dev` todavia)
- Verifica compatibilidad tactil antes de cada commit
- El archivo `enhance_app.py` es script auxiliar de Python, no modificar
- No crear package.json ni node_modules — es un proyecto vanilla sin bundler
- Si dudas entre "limpiar" y "compatibilidad", elige SIEMPRE compatibilidad
