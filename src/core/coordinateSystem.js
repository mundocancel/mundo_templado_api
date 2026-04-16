// src/core/coordinateSystem.js
// Cristal Templado CAD - Sistema de Coordenadas
// Semana 1 de Refactorizacion
//
// UNIDAD LOGICA: MILIMETROS (mm)
// Todas las coordenadas del mundo son en mm.
// Las coordenadas de canvas son en pixeles (px).
//
// Uso:
//   import { CALIBRATION, canvasToWorld, worldToCanvas } from './src/core/coordinateSystem.js';
//   const pt = canvasToWorld(e.clientX, e.clientY, canvas, state);

'use strict';

// =================== CALIBRACION ===================
// MM_PER_PX: cuantos mm logicos equivale 1 pixel de canvas
//   - Valor 1 = esquema 1px:1mm (default, calibrable por DPI)
//   - Ajustar via calibrateFromMeasurement() para hardware real
//
// PT_PER_MM: puntos PDF por milimetro (estandar ISO 32000)
//   - 1 pt = 1/72 inch, 1 inch = 25.4 mm -> 72/25.4 = 2.8346
export const CALIBRATION = {
  MM_PER_PX: 1,      // 1 pixel logico = 1 mm (ajustable)
  PT_PER_MM: 2.835   // puntos PDF por milimetro - ISO
};

// =================== CONVERSION COORDENADAS ===================

/**
 * Convierte coordenadas de evento del browser (clientX/Y en px)
 * a coordenadas del mundo logico en mm.
 *
 * @param {number} cx - clientX del evento (px desde borde izquierdo de viewport)
 * @param {number} cy - clientY del evento (px desde borde superior de viewport)
 * @param {HTMLCanvasElement} canvas - referencia al elemento canvas
 * @param {object} state - estado de la vista con viewOffset y viewScale
 * @param {object} state.viewOffset - {x, y} desplazamiento de pan en px
 * @param {number} state.viewScale - factor de zoom (1 = sin zoom)
 * @returns {{x: number, y: number}} coordenadas en mm
 */
export function canvasToWorld(cx, cy, canvas, state) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (cx - r.left - state.viewOffset.x) / state.viewScale * CALIBRATION.MM_PER_PX,
    y: (cy - r.top  - state.viewOffset.y) / state.viewScale * CALIBRATION.MM_PER_PX
  };
}

/**
 * Convierte coordenadas del mundo logico en mm
 * a posicion en canvas en px.
 *
 * @param {number} wx - coordenada X en mm
 * @param {number} wy - coordenada Y en mm
 * @param {HTMLCanvasElement} canvas - referencia al elemento canvas
 * @param {object} state - estado de la vista con viewOffset y viewScale
 * @param {object} state.viewOffset - {x, y} desplazamiento de pan en px
 * @param {number} state.viewScale - factor de zoom (1 = sin zoom)
 * @returns {{x: number, y: number}} coordenadas en px (sin r.left/top, relativas al canvas)
 */
export function worldToCanvas(wx, wy, canvas, state) {
  return {
    x: wx / CALIBRATION.MM_PER_PX * state.viewScale + state.viewOffset.x,
    y: wy / CALIBRATION.MM_PER_PX * state.viewScale + state.viewOffset.y
  };
}

// =================== CALIBRACION DINAMICA ===================

/**
 * Ajusta MM_PER_PX basado en medicion fisica del usuario.
 * El usuario mide con regla fisica cuantos mm mide una linea de 100mm en pantalla.
 *
 * @param {number} measuredPx - pixeles que ocupa la linea de 100mm en pantalla real
 * @param {number} [expectedMm=100] - mm teoricos de la linea de referencia
 */
export function calibrateFromMeasurement(measuredPx, expectedMm = 100) {
  if (measuredPx <= 0) return;
  CALIBRATION.MM_PER_PX = expectedMm / measuredPx;
  // Persistir para proxima sesion
  try {
    localStorage.setItem('cad_calibration_mm_per_px', CALIBRATION.MM_PER_PX.toString());
  } catch (e) {
    // localStorage no disponible (modo privado, etc)
  }
}

/**
 * Carga la calibracion guardada en localStorage (si existe).
 * Llamar al inicio de la app, antes del primer render.
 */
export function loadCalibration() {
  try {
    const saved = localStorage.getItem('cad_calibration_mm_per_px');
    if (saved) {
      const val = parseFloat(saved);
      if (isFinite(val) && val > 0) {
        CALIBRATION.MM_PER_PX = val;
      }
    }
  } catch (e) {
    // localStorage no disponible
  }
}

// =================== VALIDACION DE PRECISION ===================

/**
 * Verifica que el round-trip worldToCanvas->canvasToWorld
 * mantiene precision menor a tolerancia especificada.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {object} state
 * @param {number} [toleranceMm=0.1] - tolerancia maxima en mm
 * @returns {boolean} true si la precision es correcta
 */
export function validatePrecision(canvas, state, toleranceMm = 0.1) {
  const testPoints = [
    { x: 0,   y: 0   },
    { x: 100, y: 0   },
    { x: 500, y: 300 },
    { x: 250, y: 175 }
  ];
  return testPoints.every(pt => {
    const screen = worldToCanvas(pt.x, pt.y, canvas, state);
    const back   = canvasToWorld(screen.x, screen.y, canvas, state);
    return Math.abs(back.x - pt.x) < toleranceMm &&
           Math.abs(back.y - pt.y) < toleranceMm;
  });
}

// =================== PUNTO DE INSERCION DE TESTS ===================
// Para anadir tests unitarios, crear: /tests/coordinateSystem.test.js
//
// Ejemplo Jest:
// import { canvasToWorld, worldToCanvas, CALIBRATION } from '../src/core/coordinateSystem.js';
// describe('round-trip', () => {
//   it('debe mantener precision < 0.1mm', () => {
//     const s = { viewOffset: { x: 0, y: 0 }, viewScale: 1 };
//     const c = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
//     const w = { x: 500, y: 300 };
//     const px = worldToCanvas(w.x, w.y, c, s);
//     const back = canvasToWorld(px.x, px.y, c, s);
//     expect(Math.abs(back.x - w.x)).toBeLessThan(0.1);
//     expect(Math.abs(back.y - w.y)).toBeLessThan(0.1);
//   });
// });
