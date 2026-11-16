// Keyboard + mouse + pointer lock. No state writes except its own flags.
export function createInput(canvas, onLockChange) {
  const inp = {
    keys: new Set(), mouseDX: 0, mouseDY: 0, mouseDown: false,
    pressed: new Set(), // keys pressed since last consume (edge)
    locked: false, wheel: 0,
  };
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    inp.keys.add(e.code);
    inp.pressed.add(e.code);
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => inp.keys.delete(e.code));
  window.addEventListener('blur', () => { inp.keys.clear(); inp.mouseDown = false; });
  document.addEventListener('mousemove', (e) => {
    if (!inp.locked) return;
    inp.mouseDX += e.movementX || 0;
    inp.mouseDY += e.movementY || 0;
  });
  canvas.addEventListener('mousedown', (e) => { if (e.button === 0) inp.mouseDown = true; });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) inp.mouseDown = false; });
  canvas.addEventListener('wheel', (e) => { inp.wheel += Math.sign(e.deltaY); }, { passive: true });
  document.addEventListener('pointerlockchange', () => {
    inp.locked = document.pointerLockElement === canvas;
    if (onLockChange) onLockChange(inp.locked);
  });
  inp.requestLock = () => { try { canvas.requestPointerLock(); } catch { /* noop */ } };
  inp.consumeMouse = () => { const d = [inp.mouseDX, inp.mouseDY]; inp.mouseDX = 0; inp.mouseDY = 0; return d; };
  inp.wasPressed = (code) => { const hit = inp.pressed.has(code); inp.pressed.delete(code); return hit; };
  inp.clearPressed = () => inp.pressed.clear();
  return inp;
}
