// render.js — three.js renderer, dusk scene and the chase camera.
// Sunset light, low sun, warm fog. No shadow maps (headless-safe and fast);
// depth comes from the lighting and the fog.

import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  // Dusk over the bay: deep blue-violet sky, warm haze at the horizon.
  scene.background = new THREE.Color(0x2a2440);
  scene.fog = new THREE.Fog(0x3a2a4a, 120, 520);
  const ambient = new THREE.AmbientLight(0x9090a8, 0.75);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffb36b, 1.6);
  sun.position.set(-120, 60, 180);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0x6a7ab8, 0.5);
  fill.position.set(100, 80, -120);
  scene.add(fill);
  return scene;
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1200);
  cam.position.set(0, 8, -14);
  return cam;
}

// The chase camera: eases behind the player's heading, looks a little ahead.
// `snap` jumps it straight behind the player (used by screenshot staging).
export function createCameraRig() {
  let yaw = 0;
  let first = true;
  return {
    update(cam, player, dt, snap) {
      const targetYaw = player.heading;
      if (first || snap) {
        yaw = targetYaw;
        first = false;
      } else {
        let dh = targetYaw - yaw;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        yaw += Math.max(-3.2 * dt, Math.min(3.2 * dt, dh));
      }
      const dist = player.onFoot ? 8 : 11;
      const height = player.onFoot ? 3.4 : 4.6;
      const fx = Math.sin(yaw);
      const fz = Math.cos(yaw);
      const wantX = player.x - fx * dist;
      const wantZ = player.z - fz * dist;
      const k = snap ? 1 : Math.min(1, dt * 6);
      cam.position.x += (wantX - cam.position.x) * k;
      cam.position.y += (height - cam.position.y) * k;
      cam.position.z += (wantZ - cam.position.z) * k;
      cam.lookAt(player.x + fx * 5, 1.6, player.z + fz * 5);
    },
    snapCamera(cam, player) {
      yaw = player.heading;
      const dist = player.onFoot ? 8 : 11;
      const height = player.onFoot ? 3.4 : 4.6;
      cam.position.set(
        player.x - Math.sin(yaw) * dist,
        height,
        player.z - Math.cos(yaw) * dist,
      );
      cam.lookAt(player.x + Math.sin(yaw) * 5, 1.6, player.z + Math.cos(yaw) * 5);
    },
  };
}

// A high aerial view for the city screenshot: above the plaza, looking
// down the grid toward the beach and the sea. Kept low enough that the
// dusk fog does not wash the streets out.
export function aerialView(cam) {
  cam.position.set(50, 150, -130);
  cam.lookAt(0, 0, 100);
}
