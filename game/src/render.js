// render.js — WebGL renderer, golden-hour lighting and cameras for PERLA BAY.
// Warm directional sun low in the west, pink-orange sky fog, soft ambient.

import * as THREE from 'three';
import { clamp } from './random.js';

export function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(container.clientWidth || 1280, container.clientHeight || 800);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.shadowMap.enabled = false;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf2a05a);
  scene.fog = new THREE.Fog(0xf0a878, 300, 1000);

  const camera = new THREE.PerspectiveCamera(62, (container.clientWidth || 1280) / (container.clientHeight || 800), 0.1, 1200);
  camera.position.set(0, 8, -14);

  // Golden-hour sun from the west-southwest, warm and low.
  const sun = new THREE.DirectionalLight(0xffc880, 1.6);
  sun.position.set(-180, 90, 140);
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffd0a0, 0x3a3a50, 0.85);
  scene.add(hemi);
  const amb = new THREE.AmbientLight(0x804060, 0.35);
  scene.add(amb);

  // Sunset sky dome: big gradient sphere, backside.
  const skyGeo = new THREE.SphereGeometry(900, 16, 12);
  const skyMat = new THREE.MeshBasicMaterial({
    color: 0xf2a05a, side: THREE.BackSide, fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);
  // Sun disc low on the horizon.
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(34, 24),
    new THREE.MeshBasicMaterial({ color: 0xffe8a0, fog: false })
  );
  sunDisc.position.set(-520, 70, 320);
  sunDisc.lookAt(camera.position);
  scene.add(sunDisc);

  function resize() {
    const w = container.clientWidth || 1280;
    const h = container.clientHeight || 800;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  return { renderer, scene, camera, sun, sunDisc, resize };
}

// Third-person chase camera: behind and above the target, smoothed.
// mode 'car' sits further back and lower; 'foot' is closer and higher.
export function updateCamera(camera, target, heading, mode, dt, state) {
  const dist = mode === 'car' ? 11.5 : 8.5;
  const height = mode === 'car' ? 4.2 : 3.4;
  const bx = target.x - Math.sin(heading) * dist;
  const bz = target.z - Math.cos(heading) * dist;
  const k = 1 - Math.pow(0.0001, dt);
  camera.position.x += (bx - camera.position.x) * k;
  camera.position.y += (target.y + height - camera.position.y) * k;
  camera.position.z += (bz - camera.position.z) * k;
  camera.lookAt(target.x + Math.sin(heading) * 6, target.y + 1.6, target.z + Math.cos(heading) * 6);
}

// Slow cinematic orbit used by the city screenshot.
export function orbitCamera(camera, t, center) {
  const a = t * 0.05;
  camera.position.set(center.x + Math.cos(a) * 135, 95, center.z + Math.sin(a) * 135);
  camera.lookAt(center.x, 0, center.z + 60);
}

// Keep the sun disc facing the camera so it reads as a glowing sunset ball.
export function faceSun(sunDisc, camera) {
  sunDisc.lookAt(camera.position);
}

// Simple screen-space check helper for the playtest: is the canvas painted?
export function canvasPainted(renderer) {
  const gl = renderer.getContext();
  const px = new Uint8Array(4);
  gl.readPixels(2, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px[0] + px[1] + px[2] > 0;
}
