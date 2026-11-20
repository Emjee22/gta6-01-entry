// Renderer, sky, lights and fog for Perla Bay.
//
// The look is golden hour: a low warm sun, a pink-orange gradient sky, and
// a soft warm fog that melts the far streets into the sunset. Shadows are
// on, with a single directional sun so the frame stays fast.
import * as THREE from 'three';

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  return renderer;
}

// A gradient sky dome: deep violet overhead, pink in the middle, burning
// orange at the horizon. The dome is BackSide so the camera sits inside it.
function createSkyDome(scene) {
  const geo = new THREE.SphereGeometry(900, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x4a3a78) },
      midColor: { value: new THREE.Color(0xd86a9e) },
      lowColor: { value: new THREE.Color(0xff9e4a) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 lowColor;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col = h > 0.25
          ? mix(midColor, topColor, smoothstep(0.25, 0.85, h))
          : mix(lowColor, midColor, smoothstep(-0.08, 0.25, h));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(geo, mat);
  scene.add(dome);
  return dome;
}

export function createSkyAndLights(scene) {
  const dome = createSkyDome(scene);

  // Low sun from the west: long warm shadows across the streets.
  const sun = new THREE.DirectionalLight(0xffb36b, 2.4);
  sun.position.set(-260, 130, -140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -280;
  sun.shadow.camera.right = 280;
  sun.shadow.camera.top = 280;
  sun.shadow.camera.bottom = -280;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  scene.add(sun.target);

  // Pink sky light from above, dark warm ground bounce from below.
  const hemi = new THREE.HemisphereLight(0xffd9e8, 0x3a2f4a, 0.85);
  scene.add(hemi);

  // Warm haze: the far city dissolves into the sunset.
  scene.fog = new THREE.Fog(0xe89a6a, 160, 720);

  // The sun disc itself, low over the ocean.
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe8b0, fog: false }),
  );
  disc.position.set(-420, 95, 420);
  disc.lookAt(0, 40, 0);
  scene.add(disc);

  return { dome, sun, hemi, disc };
}

export function createCamera() {
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);
  camera.position.set(0, 14, 24);
  return camera;
}

// Third-person follow camera: trails behind the target, smooths its motion,
// and looks slightly ahead of the direction of travel. `dist` and `height`
// let cars use a higher, further camera than walking does. When the camera
// is far from where it should be (a teleport, a respawn, a staged shot),
// it snaps there instead of gliding across the city.
export function followCamera(camera, targetPos, heading, dist, height, dt, state) {
  const back = new THREE.Vector3(-Math.sin(heading), 0, -Math.cos(heading));
  const desired = new THREE.Vector3(
    targetPos.x + back.x * dist,
    targetPos.y + height,
    targetPos.z + back.z * dist,
  );
  if (state.pos.distanceTo(desired) > 25) {
    state.pos.copy(desired);
  } else {
    const k = 1 - Math.pow(0.0015, dt);
    state.pos.lerp(desired, k);
  }
  camera.position.copy(state.pos);
  const look = new THREE.Vector3(
    targetPos.x + Math.sin(heading) * 6,
    targetPos.y + 2,
    targetPos.z + Math.cos(heading) * 6,
  );
  camera.lookAt(look);
}

export function createCameraState(camera) {
  return { pos: camera.position.clone() };
}

// Keep the renderer and camera honest when the window is resized.
export function handleResize(renderer, camera) {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
