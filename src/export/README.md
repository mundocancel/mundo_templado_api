# src/export

Modulo de exportacion calibrada - Semana 3 de Refactorizacion.

## Archivos planificados

- `pdfExporter.js` - jsPDF con CALIBRATION.PT_PER_MM, exporta 1mm logico = 1mm en PDF
- `svgExporter.js` - SVG con viewBox en mm (width="Xmm" height="Ymm")

## Requisito de precision

- 100mm logico en pantalla = 100mm en PDF impreso
- Usa CALIBRATION.PT_PER_MM = 2.835 como factor de conversion
- Validar con regla fisica antes de considerar completo

## Estado

Pendiente. Depende de que coordinateSystem.js este integrado primero.
