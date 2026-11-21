// input.js — keyboard + mouse for PERLA BAY.
// WASD move/drive, Shift run/handbrake, F enter/exit car, E crew ability,
// Space jump (on foot) / handbrake (in car), M mute, P/Esc pause, R restart.
// Mouse steers the camera via pointer lock; without lock, arrow keys turn.

export function createInput(canvas) {
  const keys = Object.create(null);
  const pressed = Object.create(null);
  let mouseDX = 0;
  let mouseDY = 0;
  let locked = false;

  function onKeyDown(e) {
    const k = e.key.toLowerCase();
    if (!keys[k]) pressed[k] = true;
    keys[k] = true;
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
      e.preventDefault();
    }
  }

  function onKeyUp(e) {
    keys[e.key.toLowerCase()] = false;
  }

  function onMouseMove(e) {
    if (locked) {
      mouseDX += e.movementX || 0;
      mouseDY += e.movementY || 0;
    }
  }

  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  document.addEventListener('pointerlockchange', onLockChange);

  function requestLock() {
    if (canvas && canvas.requestPointerLock) {
      try {
        const p = canvas.requestPointerLock();
        if (p && p.catch) p.catch(function () { /* lock refused — arrows still work */ });
      } catch (e) {
        // pointer lock unavailable in this browser context
      }
    }
  }

  const input = {
    keys,
    requestLock,
    isLocked() { return locked; },
    isDown(k) { return !!keys[k]; },
    // Edge-triggered: true only on the frame the key went down.
    wasPressed(k) { return !!pressed[k]; },
    // Mouse deltas since last frame; calling this consumes them.
    takeMouse() {
      const d = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    // Axis helpers: -1..1 from key pairs.
    axis(neg, pos) {
      let v = 0;
      if (keys[neg]) v -= 1;
      if (keys[pos]) v += 1;
      return v;
    },
    endFrame() {
      for (const k of Object.keys(pressed)) pressed[k] = false;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
  return input;
}

// Human-readable control hints shown on the start screen and pause menu.
export const CONTROL_HINTS = [
  ['W A S D', 'jalan / nyetir'],
  ['Mouse', 'putar kamera (klik untuk kunci)'],
  ['Shift', 'lari / handbrake drift'],
  ['F', 'masuk / keluar mobil'],
  ['E', 'ability crew (Nadia)'],
  ['Space', 'lompat / handbrake'],
  ['1 - 4', 'ganti senjata'],
  ['M', 'mute suara'],
  ['P / Esc', 'pause'],
];

export function formatHint(pair) {
  return pair[0] + ' — ' + pair[1];
}
