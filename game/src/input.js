// Keyboard + mouse input for Perla Bay.
// Tracks held keys, edge-triggered presses, and pointer-lock mouse look.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let lookDX = 0;
  let lookDY = 0;
  let pointerLocked = false;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) {
      e.preventDefault();
    }
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    if (!pointerLocked) return;
    lookDX += e.movementX || 0;
    lookDY += e.movementY || 0;
  }
  function onPointerLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
  }
  function onBlur() { keys.clear(); }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onPointerLockChange);

  return {
    isDown(code) { return keys.has(code); },
    _touchDown(code) { keys.add(code); pressed.add(code); },
    _touchUp(code) { keys.delete(code); },
    // Edge-triggered: true once per physical press; consumed by endFrame().
    wasPressed(code) { return pressed.has(code); },
    axis() {
      let x = 0, z = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) z += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) z -= 1;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      return { x, z };
    },
    consumeLook() {
      const out = { dx: lookDX, dy: lookDY };
      lookDX = 0; lookDY = 0;
      return out;
    },
    requestLock() {
      try {
        const p = canvas.requestPointerLock();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch (e) { /* headless or denied: mouse look simply stays off */ }
    },
    releaseLock() {
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch (e) {}
    },
    get locked() { return pointerLocked; },
    endFrame() { pressed.clear(); },
  };
}
// Touch fallback: on-screen buttons for the rare touch visitor.
// Desktop is the target; this only keeps the game from being unusable.
export function createTouchPad(root, input) {
  if (!('ontouchstart' in window)) return null;
  const pad = document.createElement('div');
  pad.id = 'touch-pad';
  pad.innerHTML = '<button data-k="KeyW">▲</button><button data-k="KeyA">◀</button>' +
    '<button data-k="KeyS">▼</button><button data-k="KeyD">▶</button>' +
    '<button data-k="KeyF">F</button>';
  pad.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:40;display:flex;gap:6px;';
  pad.querySelectorAll('button').forEach((b) => {
    b.style.cssText = 'width:44px;height:44px;font-size:18px;border-radius:8px;';
    b.addEventListener('touchstart', (e) => { e.preventDefault(); input._touchDown(b.dataset.k); });
    b.addEventListener('touchend', (e) => { e.preventDefault(); input._touchUp(b.dataset.k); });
  });
  root.appendChild(pad);
  return pad;
}
