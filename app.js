// Cristal Templado CAD - app.js
'use strict';

// ===================  STATE  ===================
const state = {
  lines: [],
  currentTool: 'line',
  isDrawing: false,
  startPoint: null,
  previewLine: null,
  selectedLineIndex: null,
  viewOffset: { x: 0, y: 0 },
  viewScale: 1,
  gridSize: 10,
  snapThreshold: 10,
  history: [],
  animating: false,
  animFrame: 0
};

// Touch gestures
let touches = [];
let lastDist = 0;
let lastCenter = null;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// =================== INIT ==================
function init() {
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  setupEvents();
  loadFromStorage();
  render();
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  render();
}

// =================== EVENTS ==================
function setupEvents() {
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });
  
  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);

  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentTool = btn.dataset.tool || btn.id.replace('btn-', '');
      state.selectedLineIndex = null;
      render();
    });
  });

  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-clear').addEventListener('click', clearAll);
  document.getElementById('btn-menu').addEventListener('click', togglePanel);
  document.getElementById('btn-close-panel').addEventListener('click', togglePanel);
  document.getElementById('btn-new').addEventListener('click', newProject);
  document.getElementById('btn-save').addEventListener('click', saveProject);
  document.getElementById('btn-load-json').addEventListener('click', () => document.getElementById('file-input').click());
  document.getElementById('btn-export-json').addEventListener('click', exportJSON);
  document.getElementById('btn-export').addEventListener('click', exportPNG);
  document.getElementById('btn-play').addEventListener('click', toggleAnimation);
  document.getElementById('file-input').addEventListener('change', importJSON);
  
  loadProjectsList();
}

// =================== COORDINATES ===================
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

function snapToGrid(x, y) {
  const g = state.gridSize;
  return { x: Math.round(x / g) * g, y: Math.round(y / g) * g };
}

function lineLength(l) {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  return Math.sqrt(dx * dx + dy * dy);
}

// =================== MOUSE ===================
function onMouseDown(e) {
  if (e.button !== 0) return;
  const pt = canvasToWorld(e.clientX, e.clientY);
  handlePointerDown(pt);
}

function onMouseMove(e) {
  const pt = canvasToWorld(e.clientX, e.clientY);
  handlePointerMove(pt);
}

function onMouseUp(e) {
  if (e.button !== 0) return;
  handlePointerUp();
}

// =================== TOUCH ===================
function onTouchStart(e) {
  e.preventDefault();
  touches = Array.from(e.touches);
  if (touches.length === 1) {
    const pt = canvasToWorld(touches[0].clientX, touches[0].clientY);
    handlePointerDown(pt);
  } else if (touches.length === 2) {
    state.isDrawing = false;
    state.startPoint = null;
    lastDist = getTouchDist(touches);
    lastCenter = getTouchCenter(touches);
  }
}

function onTouchMove(e) {
  e.preventDefault();
  touches = Array.from(e.touches);
  if (touches.length === 1) {
    const pt = canvasToWorld(touches[0].clientX, touches[0].clientY);
    handlePointerMove(pt);
  } else if (touches.length === 2) {
    const dist = getTouchDist(touches);
    const center = getTouchCenter(touches);
    const scaleDelta = dist / lastDist;
    const worldCenter = canvasToWorld(center.x, center.y);
    const oldScale = state.viewScale;
    state.viewScale = Math.max(0.1, Math.min(10, state.viewScale * scaleDelta));
    state.viewOffset.x += (worldCenter.x * (oldScale - state.viewScale));
    state.viewOffset.y += (worldCenter.y * (oldScale - state.viewScale));
    if (lastCenter) {
      const r = canvas.getBoundingClientRect();
      state.viewOffset.x += (center.x - lastCenter.x) - r.left * 0;
      state.viewOffset.y += (center.y - lastCenter.y) - r.top * 0;
      const dx = center.x - lastCenter.x;
      const dy = center.y - lastCenter.y;
      state.viewOffset.x += dx;
      state.viewOffset.y += dy;
    }
    lastDist = dist;
    lastCenter = center;
    render();
  }
}

function onTouchEnd(e) {
  e.preventDefault();
  if (Array.from(e.touches).length === 0) {
    handlePointerUp();
  }
  touches = Array.from(e.touches);
}

function getTouchDist(t) {
  const dx = t[0].clientX - t[1].clientX;
  const dy = t[0].clientY - t[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(t) {
  return {
    x: (t[0].clientX + t[1].clientX) / 2,
    y: (t[0].clientY + t[1].clientY) / 2
  };
}

// =================== POINTER LOGIC ===================
function handlePointerDown(pt) {
  const snapped = snapToGrid(pt.x, pt.y);
  if (state.currentTool === 'line' || state.currentTool === 'rect') {
    state.isDrawing = true;
    state.startPoint = snapped;
    state.previewLine = null;
  } else if (state.currentTool === 'select') {
    selectLineAt(pt.x, pt.y);
  }
}

function handlePointerMove(pt) {
  if (!state.isDrawing || !state.startPoint) return;
  const snapped = snapToGrid(pt.x, pt.y);
  if (state.currentTool === 'line') {
    state.previewLine = { x1: state.startPoint.x, y1: state.startPoint.y, x2: snapped.x, y2: snapped.y, color: '#00b4d8' };
    const len = lineLength(state.previewLine);
    document.getElementById('line-info').textContent = len.toFixed(1) + ' mm';
  } else if (state.currentTool === 'rect') {
    state.previewLine = {
      type: 'rect',
      x1: Math.min(state.startPoint.x, snapped.x),
      y1: Math.min(state.startPoint.y, snapped.y),
      x2: Math.max(state.startPoint.x, snapped.x),
      y2: Math.max(state.startPoint.y, snapped.y),
      color: '#06d6a0'
    };
    const w = Math.abs(snapped.x - state.startPoint.x);
    const h = Math.abs(snapped.y - state.startPoint.y);
    document.getElementById('line-info').textContent = w.toFixed(0) + ' x ' + h.toFixed(0) + ' mm';
  }
  render();
}

function handlePointerUp() {
  if (state.isDrawing && state.previewLine) {
    state.history.push(JSON.parse(JSON.stringify(state.lines)));
    if (state.history.length > 50) state.history.shift();
    state.lines.push({ ...state.previewLine, id: Date.now() });
    saveToStorage();
  }
  state.isDrawing = false;
  state.startPoint = null;
  state.previewLine = null;
  render();
}

function selectLineAt(wx, wy) {
  const threshold = 8 / state.viewScale;
  state.selectedLineIndex = null;
  for (let i = state.lines.length - 1; i >= 0; i--) {
    const l = state.lines[i];
    if (l.type === 'rect') {
      if (wx >= l.x1 && wx <= l.x2 && wy >= l.y1 && wy <= l.y2) {
        state.selectedLineIndex = i;
        break;
      }
    } else {
      const d = distToSegment(wx, wy, l.x1, l.y1, l.x2, l.y2);
      if (d < threshold) {
        state.selectedLineIndex = i;
        break;
      }
    }
  }
  if (state.selectedLineIndex !== null) {
    const l = state.lines[state.selectedLineIndex];
    const len = lineLength(l);
    document.getElementById('line-info').textContent = 'Sel: ' + len.toFixed(1) + ' mm';
  } else {
    document.getElementById('line-info').textContent = '';
  }
  render();
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt((px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2);
}

// =================== RENDER ===================
function render() {
  const w = canvas.getBoundingClientRect().width;
  const h = canvas.getBoundingClientRect().height;
  ctx.clearRect(0, 0, w, h);

  ctx.save();
  ctx.translate(state.viewOffset.x, state.viewOffset.y);
  ctx.scale(state.viewScale, state.viewScale);

  drawGrid(w, h);
  
  const linesToDraw = state.animating
    ? state.lines.slice(0, state.animFrame)
    : state.lines;
  
  linesToDraw.forEach((l, i) => {
    const isSelected = i === state.selectedLineIndex;
    drawShape(l, isSelected ? '#f8961e' : (l.color || '#00b4d8'), isSelected ? 3 : 2);
    if (isSelected) drawMeasureLabel(l);
  });

  if (state.previewLine) {
    ctx.setLineDash([6, 4]);
    drawShape(state.previewLine, '#90e0ef', 1.5);
    drawMeasureLabel(state.previewLine);
    ctx.setLineDash([]);
  }

  ctx.restore();
}

function drawGrid(w, h) {
  const g = state.gridSize;
  const inv = 1 / state.viewScale;
  const ox = -state.viewOffset.x * inv;
  const oy = -state.viewOffset.y * inv;
  const rw = w * inv;
  const rh = h * inv;

  const startX = Math.floor(ox / g) * g;
  const startY = Math.floor(oy / g) * g;

  ctx.strokeStyle = '#1e1e3a';
  ctx.lineWidth = 0.5 / state.viewScale;
  ctx.beginPath();
  for (let x = startX; x < ox + rw + g; x += g) {
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + rh);
  }
  for (let y = startY; y < oy + rh + g; y += g) {
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + rw, y);
  }
  ctx.stroke();

  // Axis every 100mm
  ctx.strokeStyle = '#2a2a4a';
  ctx.lineWidth = 1 / state.viewScale;
  ctx.beginPath();
  for (let x = Math.floor(ox / 100) * 100; x < ox + rw + 100; x += 100) {
    ctx.moveTo(x, oy);
    ctx.lineTo(x, oy + rh);
  }
  for (let y = Math.floor(oy / 100) * 100; y < oy + rh + 100; y += 100) {
    ctx.moveTo(ox, y);
    ctx.lineTo(ox + rw, y);
  }
  ctx.stroke();

  // Origin cross
  ctx.strokeStyle = '#3a3a6a';
  ctx.lineWidth = 1.5 / state.viewScale;
  ctx.beginPath();
  ctx.moveTo(-20, 0); ctx.lineTo(20, 0);
  ctx.moveTo(0, -20); ctx.lineTo(0, 20);
  ctx.stroke();
}

function drawShape(l, color, lw) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw / state.viewScale;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (l.type === 'rect') {
    ctx.strokeRect(l.x1, l.y1, l.x2 - l.x1, l.y2 - l.y1);
  } else {
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    // endpoint dots
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(l.x1, l.y1, 2.5 / state.viewScale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(l.x2, l.y2, 2.5 / state.viewScale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawMeasureLabel(l) {
  let len, label, mx, my;
  if (l.type === 'rect') {
    const w = l.x2 - l.x1, h = l.y2 - l.y1;
    label = w.toFixed(0) + ' x ' + h.toFixed(0) + ' mm';
    mx = l.x1 + w / 2;
    my = l.y1 - 8 / state.viewScale;
  } else {
    len = lineLength(l);
    label = len.toFixed(1) + ' mm';
    mx = (l.x1 + l.x2) / 2;
    my = (l.y1 + l.y2) / 2 - 8 / state.viewScale;
  }
  const fs = Math.max(8, 11 / state.viewScale);
  ctx.font = `bold ${fs}px system-ui, sans-serif`;
  ctx.fillStyle = '#f8961e';
  ctx.textAlign = 'center';
  ctx.fillText(label, mx, my);
}

// =================== ANIMATION ===================
let animInterval = null;

function toggleAnimation() {
  if (state.animating) {
    stopAnimation();
  } else {
    startAnimation();
  }
}

function startAnimation() {
  if (state.lines.length === 0) { showToast('Sin lineas para animar'); return; }
  state.animating = true;
  state.animFrame = 0;
  document.getElementById('btn-play').querySelector('span').textContent = 'Pause';
  
  let bar = document.getElementById('anim-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'anim-bar';
    document.getElementById('canvas-container').appendChild(bar);
  }
  
  animInterval = setInterval(() => {
    state.animFrame++;
    bar.textContent = 'Corte ' + state.animFrame + ' / ' + state.lines.length;
    render();
    if (state.animFrame >= state.lines.length) {
      stopAnimation();
    }
  }, 600);
  render();
}

function stopAnimation() {
  clearInterval(animInterval);
  state.animating = false;
  state.animFrame = state.lines.length;
  document.getElementById('btn-play').querySelector('span').textContent = 'Play';
  const bar = document.getElementById('anim-bar');
  if (bar) bar.remove();
  render();
}

// =================== ACTIONS ===================
function undo() {
  if (state.history.length === 0) { showToast('Nada que deshacer'); return; }
  state.lines = state.history.pop();
  state.selectedLineIndex = null;
  document.getElementById('line-info').textContent = '';
  saveToStorage();
  render();
  showToast('Deshecho');
}

function clearAll() {
  if (state.lines.length === 0) return;
  if (!confirm('Limpiar todos los cortes?')) return;
  state.history.push(JSON.parse(JSON.stringify(state.lines)));
  state.lines = [];
  state.selectedLineIndex = null;
  document.getElementById('line-info').textContent = '';
  saveToStorage();
  render();
  showToast('Canvas limpiado');
}

function newProject() {
  if (state.lines.length > 0 && !confirm('Perder cambios no guardados?')) return;
  state.lines = [];
  state.history = [];
  state.selectedLineIndex = null;
  state.viewOffset = { x: 0, y: 0 };
  state.viewScale = 1;
  document.getElementById('line-info').textContent = '';
  render();
  togglePanel();
  showToast('Nuevo proyecto');
}

// =================== PANEL ===================
function togglePanel() {
  const panel = document.getElementById('panel');
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) loadProjectsList();
}

// =================== STORAGE (IndexedDB) ===================
const DB_NAME = 'cristal-cad';
const STORE_NAME = 'projects';
const CURRENT_KEY = '__current__';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

function dbSet(key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }));
}

function dbGet(key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

function dbGetAll() {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAllKeys();
    req.onsuccess = () => resolve(req.result.filter(k => k !== CURRENT_KEY));
    req.onerror = () => reject(req.error);
  }));
}

function dbDelete(key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  }));
}

function saveToStorage() {
  dbSet(CURRENT_KEY, { lines: state.lines }).catch(console.warn);
}

function loadFromStorage() {
  dbGet(CURRENT_KEY).then(data => {
    if (data && data.lines) {
      state.lines = data.lines;
      render();
    }
  }).catch(console.warn);
}

function saveProject() {
  const name = prompt('Nombre del proyecto:', 'Proyecto ' + new Date().toLocaleDateString());
  if (!name) return;
  dbSet('proj_' + name, { name, lines: state.lines, date: Date.now() })
    .then(() => { showToast('Guardado: ' + name); loadProjectsList(); togglePanel(); })
    .catch(e => showToast('Error al guardar'));
}

function loadProjectsList() {
  const container = document.getElementById('projects-list');
  dbGetAll().then(keys => {
    if (keys.length === 0) {
      container.innerHTML = '<div style="color:#8888aa;font-size:12px;padding:8px">No hay proyectos guardados</div>';
      return;
    }
    container.innerHTML = '';
    keys.filter(k => k.startsWith('proj_')).forEach(key => {
      dbGet(key).then(proj => {
        const div = document.createElement('div');
        div.className = 'project-item';
        const date = proj.date ? new Date(proj.date).toLocaleDateString() : '';
        div.innerHTML = `<span>${proj.name || key} <small style="color:#8888aa">${date}</small></span>
          <span>
            <button class="load-btn" data-key="${key}">Cargar</button>
            <button class="del-btn" data-key="${key}">&#128465;</button>
          </span>`;
        div.querySelector('.load-btn').addEventListener('click', () => {
          state.lines = proj.lines || [];
          state.selectedLineIndex = null;
          saveToStorage();
          render();
          togglePanel();
          showToast('Cargado: ' + (proj.name || key));
        });
        div.querySelector('.del-btn').addEventListener('click', () => {
          if (!confirm('Eliminar proyecto?')) return;
          dbDelete(key).then(() => { loadProjectsList(); showToast('Eliminado'); });
        });
        container.appendChild(div);
      });
    });
  }).catch(() => {
    container.innerHTML = '<div style="color:#ef233c;font-size:12px">Error al cargar proyectos</div>';
  });
}

// =================== EXPORT / IMPORT ===================
function exportPNG() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = rect.width * dpr * 2;
  exportCanvas.height = rect.height * dpr * 2;
  const ectx = exportCanvas.getContext('2d');
  ectx.scale(dpr * 2, dpr * 2);
  
  // Background
  ectx.fillStyle = '#0f0f1a';
  ectx.fillRect(0, 0, rect.width, rect.height);
  
  ectx.save();
  ectx.translate(state.viewOffset.x, state.viewOffset.y);
  ectx.scale(state.viewScale, state.viewScale);
  
  // Draw grid (simplified)
  const g = state.gridSize;
  const inv = 1 / state.viewScale;
  const ox = -state.viewOffset.x * inv;
  const oy = -state.viewOffset.y * inv;
  const rw = rect.width * inv;
  const rh = rect.height * inv;
  ectx.strokeStyle = '#1e1e3a';
  ectx.lineWidth = 0.5 / state.viewScale;
  ectx.beginPath();
  for (let x = Math.floor(ox / g) * g; x < ox + rw + g; x += g) {
    ectx.moveTo(x, oy); ectx.lineTo(x, oy + rh);
  }
  for (let y = Math.floor(oy / g) * g; y < oy + rh + g; y += g) {
    ectx.moveTo(ox, y); ectx.lineTo(ox + rw, y);
  }
  ectx.stroke();

  state.lines.forEach(l => {
    ectx.strokeStyle = l.color || '#00b4d8';
    ectx.lineWidth = 2 / state.viewScale;
    ectx.lineCap = 'round';
    if (l.type === 'rect') {
      ectx.strokeRect(l.x1, l.y1, l.x2 - l.x1, l.y2 - l.y1);
    } else {
      ectx.beginPath();
      ectx.moveTo(l.x1, l.y1);
      ectx.lineTo(l.x2, l.y2);
      ectx.stroke();
    }
    // label
    const len = lineLength(l);
    ectx.font = `bold ${Math.max(8, 10 / state.viewScale)}px sans-serif`;
    ectx.fillStyle = '#f8961e';
    ectx.textAlign = 'center';
    ectx.fillText(len.toFixed(1) + ' mm', (l.x1 + l.x2) / 2, (l.y1 + l.y2) / 2 - 7 / state.viewScale);
  });
  ectx.restore();
  
  const a = document.createElement('a');
  a.download = 'cristal-cad-' + Date.now() + '.png';
  a.href = exportCanvas.toDataURL('image/png');
  a.click();
  showToast('PNG exportado');
}

function exportJSON() {
  const data = JSON.stringify({ version: 1, lines: state.lines, date: Date.now() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.download = 'cristal-cad-' + Date.now() + '.json';
  a.href = URL.createObjectURL(blob);
  a.click();
  showToast('JSON exportado');
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      state.history.push(JSON.parse(JSON.stringify(state.lines)));
      state.lines = data.lines || [];
      state.selectedLineIndex = null;
      saveToStorage();
      render();
      showToast('JSON importado: ' + state.lines.length + ' elementos');
    } catch {
      showToast('Error al leer JSON');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// =================== TOAST ===================
let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// =================== START ===================
document.addEventListener('DOMContentLoaded', init);
