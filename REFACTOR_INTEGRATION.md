# INTEGRACION coordinateSystem.js → app.js

## Estado actual (commit actual)

✅ **Completado:**
- `AGENTS.md` - guia de refactorizacion para Jules/agentes
- `src/core/coordinateSystem.js` - modulo con CALIBRATION, canvasToWorld, worldToCanvas, loadCalibration, validatePrecision
- `src/rendering/README.md` - placeholder Semana 2
- `src/tools/README.md` - placeholder Semana 2
- `src/export/README.md` - placeholder Semana 3

❌ **Pendiente:**
- Integrar `coordinateSystem.js` en `app.js`
- Actualizar `index.html` para cargar `app.js` como modulo ES6

---

## Pasos de integracion (manual o via Jules)

### Paso 1: Actualizar index.html

Cambiar la linea de carga de `app.js` de:

```html
<script src="app.js"></script>
```

a:

```html
<script type="module" src="app.js"></script>
```

Esto habilita ES Modules para que app.js pueda hacer `import`.

### Paso 2: Agregar import al inicio de app.js

Despues de `'use strict';` (linea 2), agregar:

```javascript
// =================== IMPORTS ===================
import { 
  canvasToWorld, 
  worldToCanvas, 
  loadCalibration, 
  validatePrecision 
} from './src/core/coordinateSystem.js';
```

### Paso 3: Eliminar funciones duplicadas en app.js

Localizar la seccion `// =================== COORDINATES ===================` (aprox linea 88 en version original).

Eliminar SOLO estas dos funciones:

```javascript
function canvasToWorld(cx, cy) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (cx - r.left - state.viewOffset.x) / state.viewScale,
    y: (cy - r.top - state.viewOffset.y) / state.viewScale
  };
}

function worldToCanvas(wx, wy) {
  const r = canvas.getBoundingClientRect();
  return {
    x: wx * state.viewScale + state.viewOffset.x,
    y: wy * state.viewScale + state.viewOffset.y
  };
}
```

**NO TOCAR:**
- `function snapToGrid(x, y)` - dejar intacta
- `function lineLength(l)` - dejar intacta

### Paso 4: Actualizar llamadas a canvasToWorld y worldToCanvas

En el codigo original, `canvasToWorld` y `worldToCanvas` se llaman SIN pasar `canvas` ni `state`.

Ejemplo actual:
```javascript
const pt = canvasToWorld(e.clientX, e.clientY);
```

Cambiar a:
```javascript
const pt = canvasToWorld(e.clientX, e.clientY, canvas, state);
```

**Localizar y actualizar TODAS las llamadas:**
- Buscar `canvasToWorld(` → actualizar todas las llamadas
- Buscar `worldToCanvas(` → actualizar todas las llamadas

Ubicaciones tipicas:
- `onMouseDown`, `onMouseMove`
- `onTouchStart`, `onTouchMove`
- `insertHerraje` (si existe)
- cualquier funcion que convierta coordenadas

### Paso 5: (Opcional) Cargar calibracion al inicio

Dentro de `function init()`, despues de `resizeCanvas();`, agregar:

```javascript
loadCalibration(); // Carga MM_PER_PX guardado de sesiones previas
```

Esto permite que la calibracion persista entre sesiones.

### Paso 6: (Opcional) Validar precision

Dentro de `function init()`, al final (despues de `render();`), agregar:

```javascript
if (!validatePrecision(canvas, state)) {
  console.warn('Precision de coordenadas fuera de tolerancia <0.1mm');
}
```

Esto detecta errores de precision en desarrollo.

---

## Validacion post-integracion

1. Abrir `index.html` en navegador
2. Verificar que no hay errores de consola
3. Probar pinch-to-zoom (2 dedos en tactil)
4. Probar pan con mouse
5. Dibujar una linea y verificar que muestra medida en mm
6. Verificar que snap-to-grid sigue funcionando
7. Exportar PNG y verificar que no hay errores

## Riesgos conocidos

| Riesgo | Impacto | Solucion |
|--------|---------|----------|
| `insertHerraje` usa `worldToCanvas` con coordenadas mezcladas | Error de escala en herrajes | Auditar llamadas a `worldToCanvas` antes de integrar |
| `onTouchMove` tiene logica de pan duplicada | Bug si se refactoriza mal | No tocar eventos, solo cambiar llamadas a conversiones |
| Browser antiguo sin soporte ES Modules | App no carga | Agregar mensaje de fallback en index.html |

## Prompt para Jules (si lo usas)

```
Lee AGENTS.md y REFACTOR_INTEGRATION.md.

Integra src/core/coordinateSystem.js en app.js siguiendo los 6 pasos de REFACTOR_INTEGRATION.md.

No modifiques logica de UI ni eventos tactiles.
Solo actualiza imports y llamadas a canvasToWorld/worldToCanvas.

Validacion: la app debe funcionar igual que antes, sin errores de consola.
```
