// Keyboard and mouse input for Perla Bay.
//
// One object owns every key and mouse button. The game loop reads it once a
// frame: isDown for held keys, pressed for edge-triggered actions (cleared by
// endFrame), and takeMouse for the pointer movement accumulated since the
// last frame. Pointer lock gives real mouse-look on desktop; dragging with
// the mouse held down works as a fallback (and in browsers without lock).
export function createInput(canvas) {
  const down = new Set();
  const hit = new Set();
  let mouseX = 0;
  let mouseY = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let locked = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  const GAME_KEYS = new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyE', 'KeyQ', 'KeyR',
    'KeyM', 'KeyP', 'KeyC', 'KeyT', 'Space', 'ShiftLeft', 'ShiftRight',
    'Tab', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Enter',
  ]);

  function onKeyDown(event) {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) {
      down.add(event.code);
      hit.add(event.code);
    }
  }

  function onKeyUp(event) {
    down.delete(event.code);
  }

  function onBlur() {
    down.clear();
    hit.clear();
    dragging = false;
  }

  function onMouseDown(event) {
    mouseDown = true;
    if (event.button === 0) hit.add('Mouse0');
    if (event.button === 2) hit.add('Mouse2');
    if (!locked) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }

  function onMouseUp() {
    mouseDown = false;
    dragging = false;
  }

  function onMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (locked) {
      mouseDX += event.movementX || 0;
      mouseDY += event.movementY || 0;
    } else if (dragging) {
      mouseDX += event.clientX - lastX;
      mouseDY += event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  }

  function onLockChange() {
    locked = document.pointerLockElement === canvas;
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('contextmenu', onContextMenu);

  return {
    // True while the key (event.code, e.g. 'KeyW') is held down.
    isDown(code) {
      return down.has(code);
    },
    // True only on the frame the key was first pressed.
    pressed(code) {
      return hit.has(code);
    },
    // Pointer movement accumulated since the last takeMouse call.
    takeMouse() {
      const dx = mouseDX;
      const dy = mouseDY;
      mouseDX = 0;
      mouseDY = 0;
      return { dx, dy };
    },
    get mouseDown() {
      return mouseDown;
    },
    get locked() {
      return locked;
    },
    get mouseX() {
      return mouseX;
    },
    get mouseY() {
      return mouseY;
    },
    // Ask the browser to lock the pointer to the canvas (mouse-look).
    lockPointer() {
      if (canvas.requestPointerLock) {
        try {
          canvas.requestPointerLock();
        } catch (err) {
          // Pointer lock is a nicety, not a requirement.
        }
      }
    },
    unlockPointer() {
      if (document.exitPointerLock) document.exitPointerLock();
    },
    // Call once at the end of each frame: clears edge-triggered presses.
    endFrame() {
      hit.clear();
    },
  };
}

// Convenience: the four movement keys as a single -1..1 pair, already
// normalized, so the player code never repeats the same key checks.
export function moveVector(input) {
  let x = 0;
  let y = 0;
  if (input.isDown('KeyW') || input.isDown('ArrowUp')) y += 1;
  if (input.isDown('KeyS') || input.isDown('ArrowDown')) y -= 1;
  if (input.isDown('KeyA') || input.isDown('ArrowLeft')) x -= 1;
  if (input.isDown('KeyD') || input.isDown('ArrowRight')) x += 1;
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}
