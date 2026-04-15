import re

# Read the current app.js
with open('app.js', 'r') as f:
    content = f.read()

# Find where to insert the new features - before the START section
start_marker = '// ==================== START ==
if start_marker in content:
    before_start, after_start = content.split(start_marker, 1)
else:
    print('ERROR: START marker not found!')
    exit(1)

# Hardware library data
herrajes_code = '''
// ================== HERRAJES LIBRARY ==================
const herrajesLibrary = {
  tapalpa: { width: 100, height: 50, name: 'Tapalpa' },
  ryobi: { width: 80, height: 40, name: 'RYOBI' },
  brk714: { width: 90, height: 45, name: 'BRK714' },
  perfil1992: { width: 120, height: 30, name: 'Perfil 1992' }
};

function insertHerraje(type) {
  const herraje = herrajesLibrary[type];
  if (!herraje) return;
  
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const wc = worldToCanvas(cx, cy);
  
  state.shapes.push({
    type: 'herraje',
    herrajeType: type,
    x: wc.x,
    y: wc.y,
    width: herraje.width,
    height: herraje.height,
    name: herraje.name
  });
  
  saveToLocalStorage();
  render();
  showToast(`Herraje ${herraje.name} insertado`);
}

'''

# Circle and Arc tool code  
geometry_code = '''
// ================== CIRCLE & ARC TOOLS ==================
function handleCircleTool(e) {
  const { wx, wy } = getCanvasCoords(e);
  
  if (!state.tempShape) {
    state.tempShape = { type: 'circle', cx: wx, cy: wy, radius: 0 };
  } else {
    const dx = wx - state.tempShape.cx;
    const dy = wy - state.tempShape.cy;
    const radius = Math.sqrt(dx*dx + dy*dy);
    
    state.shapes.push({
      type: 'circle',
      cx: state.tempShape.cx,
      cy: state.tempShape.cy,
      radius: radius
    });
    
    state.tempShape = null;
    saveToLocalStorage();
  }
  render();
}

function handleArcTool(e) {
  const { wx, wy } = getCanvasCoords(e);
  
  if (!state.tempShape) {
    state.tempShape = { type: 'arc', cx: wx, cy: wy };
  } else if (!state.tempShape.radius) {
    const dx = wx - state.tempShape.cx;
    const dy = wy - state.tempShape.cy;
    state.tempShape.radius = Math.sqrt(dx*dx + dy*dy);
    state.tempShape.startAngle = Math.atan2(dy, dx);
  } else {
    const dx = wx - state.tempShape.cx;
    const dy = wy - state.tempShape.cy;
    state.tempShape.endAngle = Math.atan2(dy, dx);
    
    state.shapes.push({
      type: 'arc',
      cx: state.tempShape.cx,
      cy: state.tempShape.cy,
      radius: state.tempShape.radius,
      startAngle: state.tempShape.startAngle,
      endAngle: state.tempShape.endAngle
    });
    
    state.tempShape = null;
    saveToLocalStorage();
  }
  render();
}

'''

# Coordinate input code
coord_input_code = '''
// ================== COORDINATE INPUT ==================
let coordInputDialog = null;

function showCoordDialog() {
  if (coordInputDialog) {
    coordInputDialog.remove();
  }
  
  coordInputDialog = document.createElement('div');
  coordInputDialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #1e293b;
    border: 2px solid #3b82f6;
    border-radius: 8px;
    padding: 20px;
    z-index: 10000;
    min-width: 300px;
  `;
  
  coordInputDialog.innerHTML = `
    <h3 style="color: #60a5fa; margin: 0 0 15px 0;">Entrada por Coordenadas</h3>
    <div style="margin-bottom: 10px;">
      <label style="color: #94a3b8; display: block; margin-bottom: 5px;">X (mm):</label>
      <input type="number" id="coord-x" style="width: 100%; padding: 8px; background: #0f172a; color: white; border: 1px solid #475569; border-radius: 4px;">
    </div>
    <div style="margin-bottom: 15px;">
      <label style="color: #94a3b8; display: block; margin-bottom: 5px;">Y (mm):</label>
      <input type="number" id="coord-y" style="width: 100%; padding: 8px; background: #0f172a; color: white; border: 1px solid #475569; border-radius: 4px;">
    </div>
    <div style="display: flex; gap: 10px;">
      <button id="coord-ok" style="flex: 1; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer;">OK</button>
      <button id="coord-cancel" style="flex: 1; padding: 10px; background: #475569; color: white; border: none; border-radius: 4px; cursor: pointer;">Cancelar</button>
    </div>
  `;
  
  document.body.appendChild(coordInputDialog);
  
  document.getElementById('coord-x').focus();
  
  document.getElementById('coord-ok').onclick = () => {
    const x = parseFloat(document.getElementById('coord-x').value);
    const y = parseFloat(document.getElementById('coord-y').value);
    
    if (!isNaN(x) && !isNaN(y)) {
      if (state.currentTool === 'line' && state.tempLine) {
        state.tempLine.x2 = x;
        state.tempLine.y2 = y;
        state.shapes.push({ ...state.tempLine });
        state.tempLine = null;
        saveToLocalStorage();
        render();
      }
      showToast(`Punto agregado: (${x}, ${y})`);
    }
    
    coordInputDialog.remove();
    coordInputDialog = null;
  };
  
  document.getElementById('coord-cancel').onclick = () => {
    coordInputDialog.remove();
    coordInputDialog = null;
  };
}

'''

# Templates code
templates_code = '''
// ================== TEMPLATES ==================
const templates = {
  ventanaCorrediza: [
    { type: 'rect', x: 0, y: 0, width: 1200, height: 1500 },
    { type: 'line', x1: 600, y1: 0, x2: 600, y2: 1500 },
    { type: 'herraje', herrajeType: 'ryobi', x: 100, y: 100, width: 80, height: 40, name: 'RYOBI' }
  ],
  puertaBatiente: [
    { type: 'rect', x: 0, y: 0, width: 900, height: 2100 },
    { type: 'herraje', herrajeType: 'tapalpa', x: 50, y: 1050, width: 100, height: 50, name: 'Tapalpa' }
  ],
  mampara: [
    { type: 'rect', x: 0, y: 0, width: 800, height: 2000 },
    { type: 'circle', cx: 400, cy: 1000, radius: 50 }
  ]
};

function insertTemplate(templateName) {
  const template = templates[templateName];
  if (!template) {
    showToast('Plantilla no encontrada');
    return;
  }
  
  // Clear current shapes
  if (confirm('¿Limpiar diseño actual y cargar plantilla?')) {
    state.shapes = JSON.parse(JSON.stringify(template));
    saveToLocalStorage();
    render();
    showToast(`Plantilla "${templateName}" cargada`);
  }
}

'''

# Modify the render function to draw new geometry types
render_additions = '''
      // Draw circles
      if (shape.type === 'circle') {
        const center = canvasToWorld(shape.cx, shape.cy);
        ctx.beginPath();
        ctx.arc(center.x, center.y, shape.radius / state.viewScale, 0, Math.PI * 2);
        ctx.stroke();
      }
      
      // Draw arcs
      if (shape.type === 'arc') {
        const center = canvasToWorld(shape.cx, shape.cy);
        ctx.beginPath();
        ctx.arc(center.x, center.y, shape.radius / state.viewScale, shape.startAngle, shape.endAngle);
        ctx.stroke();
      }
      
      // Draw herrajes
      if (shape.type === 'herraje') {
        const pos = canvasToWorld(shape.x, shape.y);
        ctx.strokeRect(pos.x, pos.y, shape.width / state.viewScale, shape.height / state.viewScale);
        ctx.fillStyle = '#60a5fa';
        ctx.font = '12px Arial';
        ctx.fillText(shape.name, pos.x + 5, pos.y + 20);
      }
'''

# Insert all new code before the START marker
enhanced_before = before_start + herrajes_code + geometry_code + coord_input_code + templates_code

# Reconstruct the file
enhanced_content = enhanced_before + start_marker + after_start

# Write the enhanced file
with open('app.js', 'w') as f:
    f.write(enhanced_content)

print('✅ Enhanced app.js with Pro features!')
print('✅ Added: Hardware library, Círculos, Arcos, Coordinate input, Templates')
print(f'New line count: {enhanced_content.count(chr(10))}')
