// input.js — keyboard + mouse input for Perla Bay.
// Tracks held keys, edge-triggered presses (consumed each frame) and the
// mouse delta while the pointer is locked. Arrow keys and Space never scroll.

export function createInput() {
  const keys = new Set();
  const pressed = new Set();
  const onKeyDown = (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  const onKeyUp = (e) => keys.delete(e.code);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;
  const onMouseMove = (e) => {
    if (locked) {
      mouseDX += e.movementX;
      mouseDY += e.movementY;
    }
  };
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement != null;
  });

  return {
    isDown: (code) => keys.has(code),
    wasPressed: (code) => pressed.has(code),
    consumeMouse: () => {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    endFrame: () => pressed.clear(),
    // Drop every held key (used when the game pauses or the window blurs,
    // so a key held through the pause cannot stick afterwards).
    clearKeys: () => {
      keys.clear();
      pressed.clear();
    },
    lockPointer: () => {
      const c = document.getElementById('game');
      if (c && c.requestPointerLock) {
        try {
          // requestPointerLock returns a promise in newer browsers; a
          // rejected lock (no user gesture in headless) must not surface
          // as an unhandled rejection.
          const p = c.requestPointerLock();
          if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch { /* headless or denied */ }
      }
    },
    get locked() { return locked; },
  };
}
