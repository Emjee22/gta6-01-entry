// Renderer + camera for Perla Bay. One WebGL renderer, dusk lighting,
// a chase camera that follows on foot and in a car.
import * as THREE from '../vendor/three.module.min.js';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  return renderer;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8a5a52, 260, 780);
  // Dusk sun: warm directional key light.
  const sun = new THREE.DirectionalLight(0xffb37a, 2.4);
  sun.position.set(-180, 120, -260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 900;
  scene.add(sun);
  // Cool ambient fill so shadows stay readable.
  scene.add(new THREE.HemisphereLight(0x8a6a9e, 0x3a2a22, 0.85));
  return scene;
}

export function createCamera() {
  const cam = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
  window.addEventListener('resize', () => {
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
  });
  return cam;
}

// Smooth third-person chase camera.
// player: {x, z, heading, speedKmh, onFoot}; look: {dx, dy} mouse deltas.
export function updateCamera(cam, player, look, dt, state) {
  state.yaw -= look.dx * 0.0032;
  state.pitch = Math.max(-0.5, Math.min(0.55, state.pitch + look.dy * 0.0026));
  const dist = player.onFoot ? 7.5 : 10.5;
  const height = player.onFoot ? 3.4 : 4.4;
  // Camera trails behind the player's facing direction, eased.
  const wantYaw = player.heading + Math.PI;
  let dy = wantYaw - state.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  state.yaw += dy * Math.min(1, dt * (player.onFoot ? 6 : 3.2));
  const cx = player.x + Math.sin(state.yaw) * dist;
  const cz = player.z + Math.cos(state.yaw) * dist;
  const cy = height + state.pitch * 6;
  cam.position.set(cx, cy, cz);
  cam.lookAt(player.x, (player.onFoot ? 1.7 : 1.4), player.z);
  return state;
}

export function createCamState() { return { yaw: 0, pitch: 0.12 }; }
// A gold marker pillar + ring shown at the current mission objective.
export function createMarker(scene) {
  const g = new THREE.Group();
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false })
  );
  pillar.position.y = 15;
  g.add(pillar);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd94a, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  g.add(ring);
  g.visible = false;
  scene.add(g);
  return {
    group: g,
    set(x, z, visible) {
      g.position.set(x, 0, z);
      g.visible = visible;
    },
    pulse(t) {
      const s = 1 + Math.sin(t * 3) * 0.12;
      ring.scale.set(s, s, 1);
    },
  };
}
