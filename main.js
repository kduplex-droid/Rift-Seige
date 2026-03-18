import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);
scene.fog = new THREE.FogExp2(0x0a0f16, 0.015);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 500);
const baseFov = 75;
const adsFov = 42;

const pitchObject = new THREE.Object3D();
pitchObject.add(camera);

const yawObject = new THREE.Object3D();
yawObject.position.set(0, 2.2, 58);
yawObject.add(pitchObject);
scene.add(yawObject);

const clock = new THREE.Clock();

const world = {
  walls: [],
  pickups: [],
  enemies: [],
  enemyProjectiles: [],
  decor: [],
  missionObjects: [],
  extractPad: null,
  doors: {}
};

const ui = {
  overlay: document.getElementById('overlay'),
  startBtn: document.getElementById('startBtn'),
  loadoutBtn: document.getElementById('loadoutBtn'),
  intelBtn: document.getElementById('intelBtn'),
  pauseMenu: document.getElementById('pauseMenu'),
  resumeBtn: document.getElementById('resumeBtn'),
  restartBtn: document.getElementById('restartBtn'),
  hud: document.getElementById('hud'),
  health: document.getElementById('health'),
  armor: document.getElementById('armor'),
  ammo: document.getElementById('ammo'),
  enemyCount: document.getElementById('enemyCount'),
  message: document.getElementById('message'),
  damageFlash: document.getElementById('damageFlash'),
  scopeOverlay: document.getElementById('scopeOverlay'),
  crosshair: document.getElementById('crosshair'),
  missionTitle: document.getElementById('missionTitle'),
  missionObjective: document.getElementById('missionObjective'),
  missionProgress: document.getElementById('missionProgress')
};

const player = {
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  radius: 0.5,
  height: 2.2,
  health: 100,
  armor: 25,
  ammo: 30,
  reserveAmmo: 150,
  maxAmmo: 30,
  canJump: false,
  isGrounded: false,
  fireCooldown: 0,
  reloadTimer: 0,
  bobTime: 0,
  dead: false,
  weaponKick: 0,
  ads: false,
  adsAmount: 0
};

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  crouch: false,
  shoot: false,
  ads: false
};

const settings = {
  gravity: 32,
  walkSpeed: 7,
  sprintSpeed: 11,
  crouchSpeed: 4.2,
  jumpForce: 12,
  friction: 10,
  mouseSensitivity: 0.002,
  enemyViewDistance: 32,
  enemyShootDistance: 18
};

const campaign = {
  current: 0,
  started: false,
  missions: [
    {
      title: 'Mission 1: Breach the Yard',
      objective: 'Neutralize the perimeter squad',
      type: 'kill',
      target: 6,
      progress: 0,
      setup: setupMission1
    },
    {
      title: 'Mission 2: Disable Relays',
      objective: 'Secure all signal relays',
      type: 'relay',
      target: 3,
      progress: 0,
      setup: setupMission2
    },
    {
      title: 'Mission 3: Core Lockdown',
      objective: 'Clear the reactor chamber',
      type: 'kill',
      target: 8,
      progress: 0,
      setup: setupMission3
    },
    {
      title: 'Mission 4: Extraction',
      objective: 'Reach the extraction pad',
      type: 'extract',
      target: 1,
      progress: 0,
      setup: setupMission4
    }
  ]
};

let isPaused = false;
let gameStarted = false;
let missionAdvanceTimer = null;

const raycaster = new THREE.Raycaster();
const tmpBox = new THREE.Box3();
const tmpBox2 = new THREE.Box3();
const tmpVec = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

const hemiLight = new THREE.HemisphereLight(0x7aa0ff, 0x0f1118, 0.46);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xd5e4ff, 1.0);
dirLight.position.set(20, 34, 14);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 180;
dirLight.shadow.camera.left = -90;
dirLight.shadow.camera.right = 90;
dirLight.shadow.camera.top = 90;
dirLight.shadow.camera.bottom = -90;
scene.add(dirLight);

const ambientGlow = new THREE.PointLight(0x446dff, 3.5, 8, 2);
scene.add(ambientGlow);

function makeMaterial(color, metalness = 0.65, roughness = 0.45, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness,
    roughness,
    emissive,
    emissiveIntensity
  });
}

function setMessage(text) {
  ui.message.textContent = text;
}

function updateHUD() {
  ui.health.textContent = Math.max(0, Math.ceil(player.health)).toString();
  ui.armor.textContent = Math.max(0, Math.ceil(player.armor)).toString();
  ui.ammo.textContent = `${player.ammo} / ${player.reserveAmmo}`;
  ui.enemyCount.textContent = world.enemies.length.toString();
}

function updateMissionUI() {
  const mission = campaign.missions[campaign.current];
  if (!mission) {
    ui.missionTitle.textContent = 'Campaign Complete';
    ui.missionObjective.textContent = 'Facility captured';
    ui.missionProgress.textContent = 'Complete';
    return;
  }
  ui.missionTitle.textContent = mission.title;
  ui.missionObjective.textContent = mission.objective;
  ui.missionProgress.textContent = `${mission.progress} / ${mission.target}`;
}

function requestLock() {
  renderer.domElement.requestPointerLock();
}

function onLockChange() {
  const locked = document.pointerLockElement === renderer.domElement;

  if (!gameStarted) {
    ui.overlay.style.display = 'grid';
    ui.hud.style.display = 'none';
    return;
  }

  if (isPaused) {
    ui.overlay.style.display = 'none';
    ui.hud.style.display = 'block';
    ui.pauseMenu.style.display = 'grid';
    return;
  }

  ui.overlay.style.display = locked ? 'none' : 'grid';
  ui.hud.style.display = locked ? 'block' : 'none';
}

function pauseGame() {
  if (!gameStarted || player.dead || isPaused) return;
  isPaused = true;
  input.shoot = false;
  input.ads = false;
  player.ads = false;
  ui.pauseMenu.style.display = 'grid';
  ui.scopeOverlay.style.display = 'none';
  if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
  setMessage('Paused');
}

function resumeGame() {
  if (!isPaused) return;
  isPaused = false;
  ui.pauseMenu.style.display = 'none';
  requestLock();
  setMessage('Back online.');
}

function restartGame() {
  window.location.reload();
}

function addSolid(mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.solid = true;
  scene.add(mesh);
  world.walls.push(mesh);
  return mesh;
}

function removeSolid(mesh) {
  scene.remove(mesh);
  const i = world.walls.indexOf(mesh);
  if (i >= 0) world.walls.splice(i, 1);
}

function addWall(x, y, z, w, h, d, color = 0x2b3642) {
  const mesh = addSolid(new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeMaterial(color, 0.78, 0.28)
  ));
  mesh.position.set(x, y, z);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, 0.15, d + 0.2),
    makeMaterial(0x6a96ff, 0.5, 0.35, 0x2b55d1, 0.65)
  );
  trim.position.set(x, y + h / 2 - 0.2, z);
  scene.add(trim);

  return mesh;
}

function addColumn(x, y, z, size = 3) {
  const mesh = addSolid(new THREE.Mesh(
    new THREE.BoxGeometry(size, 8, size),
    makeMaterial(0x222b34, 0.76, 0.34)
  ));
  mesh.position.set(x, y, z);

  const glow = new THREE.PointLight(0x7ba0ff, 4, 12, 2);
  glow.position.set(x, 5.4, z);
  scene.add(glow);

  return mesh;
}

function createPlatform(x, y, z, w, h, d, rail = false) {
  const mesh = addSolid(new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeMaterial(0x343f4c, 0.62, 0.5)
  ));
  mesh.position.set(x, y, z);

  if (rail) {
    addWall(x - w / 2 + 0.15, y + 1, z, 0.3, 2, d, 0x26303b);
    addWall(x + w / 2 - 0.15, y + 1, z, 0.3, 2, d, 0x26303b);
  }
  return mesh;
}

function createPipe(x, y, z, len = 6) {
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, len, 8),
    makeMaterial(0x475565, 0.75, 0.25)
  );
  pipe.rotation.z = Math.random() > 0.5 ? Math.PI / 2 : 0;
  pipe.rotation.x = Math.random() > 0.75 ? Math.PI / 2 : 0;
  pipe.position.set(x, y, z);
  pipe.castShadow = true;
  scene.add(pipe);
  world.decor.push(pipe);
}

function createLamp(x, y, z, color = 0x6e9cff, intensity = 7, dist = 18) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.14, 6, 8),
    makeMaterial(0x2c3440, 0.7, 0.35)
  );
  pole.position.set(x, 3, z);
  pole.castShadow = true;
  scene.add(pole);
  world.decor.push(pole);

  const light = new THREE.PointLight(color, intensity, dist, 2);
  light.position.set(x, y, z);
  scene.add(light);
  world.decor.push(light);
}

function createDoor(name, x, z, width = 14, height = 8, depth = 2.4) {
  const group = new THREE.Group();

  const left = new THREE.Mesh(
    new THREE.BoxGeometry(width / 2, height, depth),
    makeMaterial(0x24303c, 0.78, 0.28)
  );
  left.position.set(-width / 4, height / 2, 0);

  const right = new THREE.Mesh(
    new THREE.BoxGeometry(width / 2, height, depth),
    makeMaterial(0x24303c, 0.78, 0.28)
  );
  right.position.set(width / 4, height / 2, 0);

  const header = new THREE.Mesh(
    new THREE.BoxGeometry(width + 2, 1, depth + 0.4),
    makeMaterial(0x1d2731, 0.72, 0.3)
  );
  header.position.set(0, height + 0.5, 0);

  const indicator = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.25, 0.25),
    makeMaterial(0x0e1825, 0.2, 0.3, 0xff5f5f, 2.5)
  );
  indicator.position.set(0, height - 0.7, depth * 0.55);

  group.add(left, right, header, indicator);
  group.position.set(x, 0, z);
  group.userData = {
    left,
    right,
    header,
    indicator,
    closedLeftX: left.position.x,
    closedRightX: right.position.x,
    openLeftX: left.position.x - width * 0.55,
    openRightX: right.position.x + width * 0.55,
    opening: false,
    open: false
  };

  left.castShadow = true;
  left.receiveShadow = true;
  right.castShadow = true;
  right.receiveShadow = true;
  header.castShadow = true;
  header.receiveShadow = true;
  indicator.castShadow = true;
  indicator.receiveShadow = true;

  scene.add(group);

  const leftSolid = addSolid(left);
  const rightSolid = addSolid(right);

  world.doors[name] = {
    group,
    left,
    right,
    header,
    indicator,
    leftSolid,
    rightSolid,
    width
  };

  return world.doors[name];
}

function openDoor(name) {
  const door = world.doors[name];
  if (!door || door.group.userData.open || door.group.userData.opening) return;

  door.group.userData.opening = true;
  door.indicator.material.emissive.setHex(0x55ffbf);
  door.indicator.material.emissiveIntensity = 3;
  setMessage(`Sector gate ${name.toUpperCase()} opening.`);
}

function updateDoors(delta) {
  for (const key of Object.keys(world.doors)) {
    const door = world.doors[key];
    const data = door.group.userData;
    if (!data.opening || data.open) continue;

    door.left.position.x += (data.openLeftX - door.left.position.x) * Math.min(1, delta * 2.6);
    door.right.position.x += (data.openRightX - door.right.position.x) * Math.min(1, delta * 2.6);

    if (
      Math.abs(door.left.position.x - data.openLeftX) < 0.05 &&
      Math.abs(door.right.position.x - data.openRightX) < 0.05
    ) {
      door.left.position.x = data.openLeftX;
      door.right.position.x = data.openRightX;
      data.opening = false;
      data.open = true;
      removeSolid(door.leftSolid);
      removeSolid(door.rightSolid);
    }
  }
}

function createWorld() {
  const floor = new THREE.Mesh(
    new THREE.BoxGeometry(140, 1, 160),
    makeMaterial(0x181f28, 0.55, 0.78)
  );
  floor.receiveShadow = true;
  floor.position.y = -0.5;
  scene.add(floor);

  const border = 3;
  addWall(0, 3, -78.5, 140, 8, border);
  addWall(0, 3, 78.5, 140, 8, border);
  addWall(-68.5, 3, 0, border, 8, 160);
  addWall(68.5, 3, 0, border, 8, 160);

  addWall(-26, 3, 24, 20, 8, 4);
  addWall(26, 3, 24, 20, 8, 4);

  addWall(-30, 3, -10, 4, 8, 24);
  addWall(30, 3, -10, 4, 8, 24);

  addWall(-18, 3, -46, 18, 8, 4);
  addWall(18, 3, -46, 18, 8, 4);

  addWall(-24, 3, 52, 16, 8, 4);
  addWall(24, 3, 52, 16, 8, 4);

  createDoor('alpha', 0, 24, 18, 8, 2.5);
  createDoor('beta', 0, -10, 18, 8, 2.5);
  createDoor('gamma', 0, -46, 18, 8, 2.5);

  createPlatform(-44, 3.6, 10, 6, 1, 28, true);
  createPlatform(44, 3.6, -6, 6, 1, 28, true);
  createPlatform(0, 3.6, -62, 28, 1, 6, true);
  createPlatform(0, 3.6, 64, 24, 1, 6, true);

  createPlatform(-18, 1, 0, 10, 2, 10, false);
  createPlatform(18, 1, 10, 10, 2, 10, false);
  createPlatform(-22, 0.75, -28, 8, 1.5, 8, false);
  createPlatform(24, 0.75, -34, 8, 1.5, 8, false);

  for (let x = -50; x <= 50; x += 25) {
    addColumn(x, 4, -62, 3.5);
    addColumn(x, 4, 62, 3.5);
  }
  for (let z = -30; z <= 30; z += 30) {
    addColumn(-52, 4, z, 3.5);
    addColumn(52, 4, z, 3.5);
  }

  const coverPositions = [
    [-24, 1.5, 8, 6, 3, 4],
    [24, 1.5, 8, 6, 3, 4],
    [-12, 1.5, -20, 5, 3, 5],
    [12, 1.5, -22, 5, 3, 5],
    [-38, 1.5, -54, 5, 3, 5],
    [38, 1.5, -54, 5, 3, 5],
    [-38, 1.5, 44, 5, 3, 5],
    [38, 1.5, 44, 5, 3, 5]
  ];
  for (const [x, y, z, w, h, d] of coverPositions) {
    addWall(x, y, z, w, h, d, 0x2a3138);
  }

  for (let i = 0; i < 52; i++) {
    createPipe((Math.random() - 0.5) * 120, 2 + Math.random() * 5, (Math.random() - 0.5) * 145, 4 + Math.random() * 8);
  }

  createLamp(-48, 6, -66);
  createLamp(48, 6, -66);
  createLamp(-48, 6, 66);
  createLamp(48, 6, 66);
  createLamp(0, 6, -26, 0x5d8eff, 8, 20);
  createLamp(0, 6, 34, 0x5d8eff, 8, 20);

  addPickup('health', -58, 1, 68);
  addPickup('ammo', 56, 1, 68);
  addPickup('armor', 0, 4.8, 64);
  addPickup('ammo', -44, 4.8, 4);
  addPickup('health', 44, 4.8, -6);

  const reactor = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 6, 12),
    makeMaterial(0x0d1630, 0.72, 0.18, 0x4f88ff, 2.2)
  );
  reactor.position.set(0, 3, -64);
  reactor.castShadow = true;
  reactor.receiveShadow = true;
  scene.add(reactor);

  const reactorLight = new THREE.PointLight(0x5d8eff, 18, 28, 2);
  reactorLight.position.set(0, 4, -64);
  scene.add(reactorLight);

  world.extractPad = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 0.35, 24),
    makeMaterial(0x122130, 0.35, 0.35, 0x55ffbf, 0)
  );
  world.extractPad.position.set(0, 0.2, -74);
  world.extractPad.visible = false;
  scene.add(world.extractPad);
}

function createWeapon() {
  const gun = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.18, 0.85),
    makeMaterial(0x202833, 0.82, 0.25)
  );
  body.position.set(0.28, -0.28, -0.65);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.04, 0.52, 12),
    makeMaterial(0xb7c9e7, 0.9, 0.15)
  );
  barrel.rotation.z = Math.PI / 2;
  barrel.position.set(0.41, -0.24, -1.02);

  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.04, 0.3),
    makeMaterial(0x182640, 0.5, 0.3, 0x5f92ff, 1.8)
  );
  glow.position.set(0.23, -0.18, -0.72);

  const scopeBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.08, 0.18),
    makeMaterial(0x10161f, 0.7, 0.3)
  );
  scopeBase.position.set(0.18, -0.12, -0.6);

  const scopeTube = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.34, 18),
    makeMaterial(0x151d27, 0.8, 0.22)
  );
  scopeTube.rotation.z = Math.PI / 2;
  scopeTube.position.set(0.22, -0.08, -0.8);

  gun.add(body, barrel, glow, scopeBase, scopeTube);
  camera.add(gun);
  return gun;
}

const weapon = createWeapon();
const muzzleFlash = new THREE.PointLight(0x8db7ff, 0, 4, 2);
muzzleFlash.position.set(0.48, -0.24, -1.08);
camera.add(muzzleFlash);

function addPickup(type, x, y, z) {
  const color = type === 'health' ? 0x4cff88 : type === 'ammo' ? 0xffd166 : 0x62b3ff;
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.6),
    makeMaterial(0x141d26, 0.45, 0.25, color, 1.6)
  );
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.08, 8, 24),
    makeMaterial(color, 0.65, 0.2, color, 0.8)
  );
  ring.rotation.x = Math.PI / 2;

  group.add(body, ring);
  group.position.set(x, y, z);
  scene.add(group);
  world.pickups.push({ type, mesh: group, time: Math.random() * Math.PI * 2 });
}

function spawnRelay(x, y, z) {
  const relay = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.8, 1, 1.6, 8),
    makeMaterial(0x1a222c, 0.5, 0.4)
  );
  base.position.y = 0.8;

  const core = new THREE.Mesh(
    new THREE.CylinderGeometry(0.26, 0.26, 2.2, 10),
    makeMaterial(0x0e1623, 0.35, 0.2, 0x79a8ff, 2.4)
  );
  core.position.y = 2.1;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.7, 0.08, 10, 24),
    makeMaterial(0x79a8ff, 0.45, 0.2, 0x79a8ff, 0.8)
  );
  ring.position.y = 2.2;
  ring.rotation.x = Math.PI / 2;

  relay.add(base, core, ring);
  relay.position.set(x, y, z);
  relay.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(relay);
  world.missionObjects.push({ type: 'relay', mesh: relay, time: Math.random() * Math.PI * 2 });
}

function spawnEnemy(x, y, z, type) {
  const group = new THREE.Group();
  const color = type === 'brute' ? 0xc63d48 : type === 'gunner' ? 0x7e4bff : 0xff7b5a;
  const height = type === 'brute' ? 2.8 : 2.2;
  const speed = type === 'brute' ? 2.2 : type === 'gunner' ? 2.9 : 3.8;
  const health = type === 'brute' ? 140 : type === 'gunner' ? 85 : 60;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.3, 0.7),
    makeMaterial(0x291d23, 0.35, 0.55, color, 0.22)
  );
  torso.position.y = 1.35;

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.45, 0.18),
    makeMaterial(0x131720, 0.2, 0.3, color, 1.5)
  );
  chest.position.set(0, 1.4, 0.38);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 16),
    makeMaterial(0x171217, 0.25, 0.7, color, 0.4)
  );
  head.position.y = 2.22;

  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 8, 8),
    makeMaterial(0xffffff, 0.1, 0.2, color, 3)
  );
  eyeL.position.set(-0.1, 2.22, 0.28);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;

  const shoulderL = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.28, 0.28),
    makeMaterial(0x1c2028, 0.5, 0.55)
  );
  shoulderL.position.set(-0.58, 1.7, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.58;

  const armL = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.7, 0.2),
    makeMaterial(0x1f2328, 0.5, 0.6)
  );
  armL.position.set(-0.72, 1.2, 0);
  const armR = armL.clone();
  armR.position.x = 0.72;

  const forearmL = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.6, 0.18),
    makeMaterial(0x1a1e25, 0.45, 0.62)
  );
  forearmL.position.set(-0.72, 0.65, 0.06);
  const forearmR = forearmL.clone();
  forearmR.position.x = 0.72;

  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.7, 0.24),
    makeMaterial(0x1d2026, 0.5, 0.6)
  );
  legL.position.set(-0.24, 0.8, 0);
  const legR = legL.clone();
  legR.position.x = 0.24;

  const shinL = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.55, 0.2),
    makeMaterial(0x171b21, 0.5, 0.62)
  );
  shinL.position.set(-0.24, 0.25, 0.04);
  const shinR = shinL.clone();
  shinR.position.x = 0.24;

  group.add(
    torso, chest, head, eyeL, eyeR,
    shoulderL, shoulderR, armL, armR,
    forearmL, forearmR, legL, legR, shinL, shinR
  );
  group.position.set(x, y, z);
  group.traverse(o => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  scene.add(group);

  world.enemies.push({
    mesh: group,
    type,
    speed,
    health,
    maxHealth: health,
    shootCooldown: 1 + Math.random(),
    radius: 0.65,
    height,
    hitFlash: 0,
    strafePhase: Math.random() * Math.PI * 2
  });

  updateHUD();
}

function clearMissionObjects() {
  for (const obj of world.missionObjects) {
    scene.remove(obj.mesh);
  }
  world.missionObjects.length = 0;
}

function clearEnemies() {
  for (const enemy of world.enemies) {
    scene.remove(enemy.mesh);
  }
  world.enemies.length = 0;
  updateHUD();
}

function resetDoors() {
  for (const key of Object.keys(world.doors)) {
    const door = world.doors[key];
    const data = door.group.userData;

    data.open = false;
    data.opening = false;

    door.left.position.x = data.closedLeftX;
    door.right.position.x = data.closedRightX;

    if (!world.walls.includes(door.left)) world.walls.push(door.left);
    if (!world.walls.includes(door.right)) world.walls.push(door.right);

    door.leftSolid = door.left;
    door.rightSolid = door.right;

    door.indicator.material.emissive.setHex(0xff5f5f);
    door.indicator.material.emissiveIntensity = 2.5;
  }
}

function startCampaign() {
  campaign.started = true;
  campaign.current = 0;
  for (const mission of campaign.missions) mission.progress = 0;
  resetDoors();
  world.extractPad.visible = false;
  beginMission();
}

function beginMission() {
  clearMissionObjects();
  clearEnemies();
  if (missionAdvanceTimer) {
    clearTimeout(missionAdvanceTimer);
    missionAdvanceTimer = null;
  }

  const mission = campaign.missions[campaign.current];
  if (!mission) {
    ui.missionTitle.textContent = 'Campaign Complete';
    ui.missionObjective.textContent = 'Facility captured';
    ui.missionProgress.textContent = 'Complete';
    setMessage('Campaign complete. Extraction successful.');
    world.extractPad.visible = false;
    return;
  }

  mission.progress = 0;
  updateMissionUI();
  mission.setup();
  setMessage(mission.objective);
}

function completeMission() {
  const mission = campaign.missions[campaign.current];
  if (!mission) return;

  if (campaign.current === 0) openDoor('alpha');
  if (campaign.current === 1) openDoor('beta');
  if (campaign.current === 2) openDoor('gamma');

  setMessage(`${mission.title} complete.`);
  campaign.current += 1;

  missionAdvanceTimer = setTimeout(() => {
    beginMission();
  }, 1800);
}

function setupMission1() {
  spawnEnemy(-40, 1, 52, 'stalker');
  spawnEnemy(-18, 1, 44, 'stalker');
  spawnEnemy(20, 1, 42, 'stalker');
  spawnEnemy(42, 1, 48, 'gunner');
  spawnEnemy(-32, 4.2, 8, 'gunner');
  spawnEnemy(38, 4.2, -4, 'gunner');
  yawObject.position.set(0, 2.2, 66);
}

function setupMission2() {
  spawnRelay(-48, 0, -2);
  spawnRelay(48, 0, -8);
  spawnRelay(0, 4, -26);

  spawnEnemy(-36, 1, 12, 'stalker');
  spawnEnemy(34, 1, 4, 'stalker');
  spawnEnemy(-46, 1, -20, 'gunner');
  spawnEnemy(46, 1, -20, 'gunner');
  spawnEnemy(0, 4.2, -28, 'brute');
}

function setupMission3() {
  spawnEnemy(-18, 1, -42, 'stalker');
  spawnEnemy(18, 1, -38, 'stalker');
  spawnEnemy(-28, 1, -56, 'stalker');
  spawnEnemy(28, 1, -56, 'stalker');
  spawnEnemy(-42, 4.2, -58, 'gunner');
  spawnEnemy(42, 4.2, -58, 'gunner');
  spawnEnemy(-10, 1, -66, 'brute');
  spawnEnemy(10, 1, -66, 'brute');
}

function setupMission4() {
  world.extractPad.visible = true;
  campaign.missions[campaign.current].progress = 0;
  updateMissionUI();
  setMessage('Move through the final sector and reach extraction.');
}

function getPlayerAABB(pos = yawObject.position, crouching = input.crouch) {
  const h = crouching ? 1.35 : player.height;
  return new THREE.Box3(
    new THREE.Vector3(pos.x - player.radius, pos.y - h, pos.z - player.radius),
    new THREE.Vector3(pos.x + player.radius, pos.y, pos.z + player.radius)
  );
}

function resolvePlayerCollisions(nextPos) {
  const box = getPlayerAABB(nextPos);
  let grounded = false;

  for (const wall of world.walls) {
    tmpBox.setFromObject(wall);
    if (!box.intersectsBox(tmpBox)) continue;

    const overlapX = Math.min(box.max.x - tmpBox.min.x, tmpBox.max.x - box.min.x);
    const overlapY = Math.min(box.max.y - tmpBox.min.y, tmpBox.max.y - box.min.y);
    const overlapZ = Math.min(box.max.z - tmpBox.min.z, tmpBox.max.z - box.min.z);

    if (overlapY < overlapX && overlapY < overlapZ) {
      if (nextPos.y > tmpBox.max.y - 0.2) {
        nextPos.y = tmpBox.max.y + (input.crouch ? 1.35 : player.height);
        player.velocity.y = 0;
        grounded = true;
      } else {
        nextPos.y = tmpBox.min.y;
        player.velocity.y = Math.min(0, player.velocity.y);
      }
    } else if (overlapX < overlapZ) {
      nextPos.x += box.min.x < tmpBox.min.x ? -overlapX : overlapX;
    } else {
      nextPos.z += box.min.z < tmpBox.min.z ? -overlapZ : overlapZ;
    }
    box.copy(getPlayerAABB(nextPos));
  }

  if (nextPos.y < (input.crouch ? 1.35 : player.height)) {
    nextPos.y = input.crouch ? 1.35 : player.height;
    player.velocity.y = 0;
    grounded = true;
  }

  player.isGrounded = grounded;
  if (grounded) player.canJump = true;
}

function updatePlayer(delta) {
  if (player.dead) return;

  const speed = input.crouch ? settings.crouchSpeed : input.sprint ? settings.sprintSpeed : settings.walkSpeed;

  player.direction.set(0, 0, 0);
  if (input.forward) player.direction.z -= 1;
  if (input.backward) player.direction.z += 1;
  if (input.left) player.direction.x -= 1;
  if (input.right) player.direction.x += 1;
  player.direction.normalize();

  const forward = new THREE.Vector3();
  camera.getWorldDirection(forward);
  forward.y = 0;
  forward.normalize();

  const right = new THREE.Vector3().crossVectors(forward, upAxis).normalize();

  const move = new THREE.Vector3();
  move.addScaledVector(forward, -player.direction.z * speed);
  move.addScaledVector(right, player.direction.x * speed);

  player.velocity.x += (move.x - player.velocity.x) * Math.min(1, delta * settings.friction);
  player.velocity.z += (move.z - player.velocity.z) * Math.min(1, delta * settings.friction);
  player.velocity.y -= settings.gravity * delta;

  const nextPos = yawObject.position.clone().addScaledVector(player.velocity, delta);
  resolvePlayerCollisions(nextPos);
  yawObject.position.copy(nextPos);

  const bobStrength = player.isGrounded ? Math.min(1, move.length() / settings.sprintSpeed) : 0;
  player.bobTime += delta * (input.sprint ? 15 : 10) * bobStrength;
  const crouchOffset = input.crouch ? -0.5 : 0;

  player.ads = input.ads && !input.sprint && !player.dead;
  player.adsAmount += ((player.ads ? 1 : 0) - player.adsAmount) * Math.min(1, delta * 10);

  camera.fov += ((player.ads ? adsFov : baseFov) - camera.fov) * Math.min(1, delta * 10);
  camera.updateProjectionMatrix();

  camera.position.y = Math.sin(player.bobTime) * 0.04 * bobStrength * (1 - player.adsAmount) + crouchOffset;
  camera.position.x = Math.cos(player.bobTime * 0.5) * 0.03 * bobStrength * (1 - player.adsAmount);

  player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  player.reloadTimer = Math.max(0, player.reloadTimer - delta);
  if (player.reloadTimer === 0 && player.ammo === 0 && player.reserveAmmo > 0) finishReload();

  player.weaponKick = Math.max(0, player.weaponKick - delta * 8);

  weapon.position.x = 0.18 - player.adsAmount * 0.16 + Math.cos(player.bobTime * 0.5) * 0.03 * (1 - player.adsAmount);
  weapon.position.y = -0.28 + player.adsAmount * 0.12 + Math.sin(player.bobTime) * 0.04 * (1 - player.adsAmount);
  weapon.position.z = -player.weaponKick * 0.18 - player.adsAmount * 0.28;

  muzzleFlash.intensity = Math.max(0, muzzleFlash.intensity - delta * 28);

  ui.scopeOverlay.style.display = player.adsAmount > 0.82 ? 'block' : 'none';
  ui.crosshair.style.display = player.adsAmount > 0.82 ? 'none' : 'block';

  if (input.shoot) shoot();
}

function startReload() {
  if (player.reloadTimer > 0 || player.ammo === player.maxAmmo || player.reserveAmmo <= 0 || player.dead) return;
  player.reloadTimer = 1.2;
  setMessage('Reloading...');
  setTimeout(() => {
    if (!player.dead) finishReload();
  }, 1200);
}

function finishReload() {
  const needed = player.maxAmmo - player.ammo;
  if (needed <= 0 || player.reserveAmmo <= 0) return;
  const amount = Math.min(needed, player.reserveAmmo);
  player.ammo += amount;
  player.reserveAmmo -= amount;
  player.reloadTimer = 0;
  updateHUD();
  setMessage('Weapon ready.');
}

function shoot() {
  if (player.fireCooldown > 0 || player.reloadTimer > 0) return;
  if (player.ammo <= 0) {
    startReload();
    return;
  }

  player.fireCooldown = player.ads ? 0.14 : 0.11;
  player.ammo--;
  player.weaponKick = 1;
  muzzleFlash.intensity = 6;
  updateHUD();

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const direction = camera.getWorldDirection(new THREE.Vector3());
  const spread = player.ads ? 0.0025 : input.sprint ? 0.03 : input.crouch ? 0.006 : 0.014;

  direction.x += (Math.random() - 0.5) * spread;
  direction.y += (Math.random() - 0.5) * spread;
  direction.z += (Math.random() - 0.5) * spread;
  direction.normalize();

  raycaster.set(origin, direction);
  raycaster.far = 90;

  let closestHit = null;
  let closestDistance = Infinity;

  for (const enemy of world.enemies) {
    const bodyBox = new THREE.Box3(
      new THREE.Vector3(enemy.mesh.position.x - 0.7, enemy.mesh.position.y, enemy.mesh.position.z - 0.7),
      new THREE.Vector3(enemy.mesh.position.x + 0.7, enemy.mesh.position.y + enemy.height, enemy.mesh.position.z + 0.7)
    );
    const hitPoint = raycaster.ray.intersectBox(bodyBox, tmpVec);
    if (hitPoint) {
      const distance = hitPoint.distanceTo(origin);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestHit = { enemy, point: hitPoint.clone() };
      }
    }
  }

  for (const wall of world.walls) {
    const hit = raycaster.intersectObject(wall, false)[0];
    if (hit && hit.distance < closestDistance) {
      closestHit = null;
      closestDistance = hit.distance;
    }
  }

  if (closestHit) {
    damageEnemy(closestHit.enemy, 18 + Math.random() * 8, closestHit.point);
  }
}

function damageEnemy(enemy, amount, point) {
  enemy.health -= amount;
  enemy.hitFlash = 0.2;
  setMessage('Target hit.');

  const spark = new THREE.PointLight(0xff8a6c, 4, 4, 2);
  spark.position.copy(point);
  scene.add(spark);
  setTimeout(() => scene.remove(spark), 80);

  if (enemy.health <= 0) {
    scene.remove(enemy.mesh);
    const index = world.enemies.indexOf(enemy);
    if (index >= 0) world.enemies.splice(index, 1);

    const mission = campaign.missions[campaign.current];
    if (mission && mission.type === 'kill' && mission.progress < mission.target) {
      mission.progress++;
      updateMissionUI();
      if (mission.progress >= mission.target) completeMission();
    }

    if (Math.random() > 0.55) addPickup('ammo', point.x, 0.9, point.z);
    setMessage(world.enemies.length === 0 ? 'Sector clear.' : 'Hostile neutralized.');
    updateHUD();
  }
}

function damagePlayer(amount) {
  if (player.dead) return;

  let remaining = amount;
  if (player.armor > 0) {
    const absorbed = Math.min(player.armor, remaining * 0.55);
    player.armor -= absorbed;
    remaining -= absorbed;
  }

  player.health -= remaining;
  ui.damageFlash.style.opacity = '1';
  setTimeout(() => ui.damageFlash.style.opacity = '0', 80);
  updateHUD();

  if (player.health <= 0) {
    player.dead = true;
    setMessage('You died. Refresh to restart.');
    document.exitPointerLock();
  }
}

function updateEnemies(delta) {
  const playerPos = yawObject.position;

  for (const enemy of [...world.enemies]) {
    enemy.shootCooldown -= delta;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - delta * 2.5);

    const enemyMat = enemy.mesh.children[0].material;
    enemyMat.emissiveIntensity = enemy.hitFlash > 0 ? 1.6 : 0.22;

    tmpVec.copy(playerPos).sub(enemy.mesh.position);
    const flatDist = Math.hypot(tmpVec.x, tmpVec.z);
    const seesPlayer = flatDist < settings.enemyViewDistance;

    if (seesPlayer) {
      const desired = tmpVec.clone().setY(0).normalize();
      const strafe = Math.sin(performance.now() * 0.0015 + enemy.strafePhase) * 0.65;
      const lateral = new THREE.Vector3(-desired.z, 0, desired.x).multiplyScalar(strafe);
      const movement = desired.multiplyScalar(enemy.speed).add(lateral.multiplyScalar(enemy.type === 'gunner' ? 1 : 0.35));

      if (flatDist > (enemy.type === 'brute' ? 3.4 : 7.5)) {
        enemy.mesh.position.addScaledVector(movement, delta);
      }

      enemy.mesh.lookAt(playerPos.x, enemy.mesh.position.y + 1.2, playerPos.z);

      if (flatDist < settings.enemyShootDistance && enemy.shootCooldown <= 0) {
        if (enemy.type === 'brute' && flatDist < 3.5) {
          damagePlayer(14 + Math.random() * 6);
          enemy.shootCooldown = 1.0;
          setMessage('Heavy impact.');
        } else {
          fireEnemyShot(enemy, playerPos);
          enemy.shootCooldown = enemy.type === 'gunner' ? 0.78 : 1.1;
        }
      }
    }

    resolveEnemyCollisions(enemy);
  }
}

function resolveEnemyCollisions(enemy) {
  const enemyBox = new THREE.Box3(
    new THREE.Vector3(enemy.mesh.position.x - enemy.radius, enemy.mesh.position.y, enemy.mesh.position.z - enemy.radius),
    new THREE.Vector3(enemy.mesh.position.x + enemy.radius, enemy.mesh.position.y + enemy.height, enemy.mesh.position.z + enemy.radius)
  );

  for (const wall of world.walls) {
    tmpBox2.setFromObject(wall);
    if (!enemyBox.intersectsBox(tmpBox2)) continue;

    const pushX1 = tmpBox2.max.x - enemyBox.min.x;
    const pushX2 = enemyBox.max.x - tmpBox2.min.x;
    const pushZ1 = tmpBox2.max.z - enemyBox.min.z;
    const pushZ2 = enemyBox.max.z - tmpBox2.min.z;
    const minPush = Math.min(pushX1, pushX2, pushZ1, pushZ2);

    if (minPush === pushX1) enemy.mesh.position.x = tmpBox2.max.x + enemy.radius;
    else if (minPush === pushX2) enemy.mesh.position.x = tmpBox2.min.x - enemy.radius;
    else if (minPush === pushZ1) enemy.mesh.position.z = tmpBox2.max.z + enemy.radius;
    else enemy.mesh.position.z = tmpBox2.min.z - enemy.radius;

    enemyBox.set(
      new THREE.Vector3(enemy.mesh.position.x - enemy.radius, enemy.mesh.position.y, enemy.mesh.position.z - enemy.radius),
      new THREE.Vector3(enemy.mesh.position.x + enemy.radius, enemy.mesh.position.y + enemy.height, enemy.mesh.position.z + enemy.radius)
    );
  }
}

function fireEnemyShot(enemy, playerPos) {
  const projectile = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 12),
    makeMaterial(0x7aa4ff, 0.25, 0.2, enemy.type === 'gunner' ? 0xa06cff : 0xff7848, 3)
  );
  projectile.position.copy(enemy.mesh.position).add(new THREE.Vector3(0, 1.6, 0));
  scene.add(projectile);

  const direction = playerPos.clone().add(new THREE.Vector3(0, -0.6, 0)).sub(projectile.position).normalize();
  direction.x += (Math.random() - 0.5) * 0.05;
  direction.y += (Math.random() - 0.5) * 0.05;
  direction.z += (Math.random() - 0.5) * 0.05;
  direction.normalize();

  world.enemyProjectiles.push({
    mesh: projectile,
    velocity: direction.multiplyScalar(enemy.type === 'gunner' ? 22 : 16),
    life: 4,
    damage: enemy.type === 'gunner' ? 10 : 7
  });
}

function updateEnemyProjectiles(delta) {
  for (const p of [...world.enemyProjectiles]) {
    p.mesh.position.addScaledVector(p.velocity, delta);
    p.life -= delta;

    const distanceToPlayer = p.mesh.position.distanceTo(yawObject.position.clone().add(new THREE.Vector3(0, -1.1, 0)));
    if (distanceToPlayer < 1.05) {
      damagePlayer(p.damage);
      destroyEnemyProjectile(p);
      continue;
    }

    for (const wall of world.walls) {
      tmpBox.setFromObject(wall);
      if (tmpBox.containsPoint(p.mesh.position)) {
        destroyEnemyProjectile(p);
        break;
      }
    }

    if (!scene.getObjectById(p.mesh.id) || p.life <= 0) destroyEnemyProjectile(p);
  }
}

function destroyEnemyProjectile(p) {
  scene.remove(p.mesh);
  const index = world.enemyProjectiles.indexOf(p);
  if (index >= 0) world.enemyProjectiles.splice(index, 1);
}

function updatePickups(delta, elapsed) {
  for (const pickup of [...world.pickups]) {
    pickup.time += delta;
    pickup.mesh.rotation.y += delta * 1.8;
    pickup.mesh.position.y += Math.sin(elapsed * 2 + pickup.time) * 0.003;

    if (pickup.mesh.position.distanceTo(yawObject.position.clone().add(new THREE.Vector3(0, -1.2, 0))) < 1.8) {
      collectPickup(pickup);
    }
  }
}

function collectPickup(pickup) {
  if (pickup.type === 'health') player.health = Math.min(100, player.health + 30);
  if (pickup.type === 'ammo') player.reserveAmmo = Math.min(300, player.reserveAmmo + 30);
  if (pickup.type === 'armor') player.armor = Math.min(100, player.armor + 25);

  updateHUD();
  setMessage(`${pickup.type.toUpperCase()} acquired.`);
  scene.remove(pickup.mesh);

  const index = world.pickups.indexOf(pickup);
  if (index >= 0) world.pickups.splice(index, 1);
}

function updateMissionObjects(delta, elapsed) {
  for (const obj of [...world.missionObjects]) {
    obj.time += delta;
    obj.mesh.rotation.y += delta * 1.5;
    obj.mesh.position.y += Math.sin(elapsed * 2 + obj.time) * 0.003;

    if (obj.type === 'relay') {
      const dist = obj.mesh.position.distanceTo(yawObject.position.clone().add(new THREE.Vector3(0, -1.2, 0)));
      if (dist < 2.2) {
        scene.remove(obj.mesh);
        const index = world.missionObjects.indexOf(obj);
        if (index >= 0) world.missionObjects.splice(index, 1);

        const mission = campaign.missions[campaign.current];
        if (mission && mission.type === 'relay') {
          mission.progress++;
          updateMissionUI();
          setMessage('Relay secured.');
          if (mission.progress >= mission.target) completeMission();
        }
      }
    }
  }

  const mission = campaign.missions[campaign.current];
  if (mission && mission.type === 'extract' && world.extractPad.visible) {
    world.extractPad.material.emissiveIntensity = 0.8 + Math.sin(elapsed * 4) * 0.25;
    const dist = world.extractPad.position.distanceTo(yawObject.position.clone().add(new THREE.Vector3(0, -2, 0)));
    if (dist < 4.8) {
      mission.progress = 1;
      updateMissionUI();
      completeMission();
      world.extractPad.visible = false;
    }
  }
}

function animateDecor(elapsed) {
  ambientGlow.position.copy(yawObject.position).add(new THREE.Vector3(0, 1, 0));
  for (let i = 0; i < world.decor.length; i++) {
    const piece = world.decor[i];
    if (piece.isMesh) {
      piece.rotation.y += 0.001;
      if (i % 6 === 0) piece.position.y += Math.sin(elapsed + i) * 0.0006;
    }
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', onResize);
document.addEventListener('pointerlockchange', onLockChange);

ui.startBtn.addEventListener('click', () => {
  gameStarted = true;
  startCampaign();
  requestLock();
});

ui.resumeBtn.addEventListener('click', resumeGame);
ui.restartBtn.addEventListener('click', restartGame);

ui.loadoutBtn.addEventListener('click', () => setMessage('Loadout locked.'));
ui.intelBtn.addEventListener('click', () => setMessage('Campaign intel uploaded.'));

renderer.domElement.addEventListener('click', () => {
  if (gameStarted && !isPaused && document.pointerLockElement !== renderer.domElement) {
    requestLock();
  }
});

document.addEventListener('mousemove', (e) => {
  if (isPaused) return;
  if (document.pointerLockElement !== renderer.domElement || player.dead) return;
  yawObject.rotation.y -= e.movementX * settings.mouseSensitivity;
  pitchObject.rotation.x -= e.movementY * settings.mouseSensitivity;
  pitchObject.rotation.x = Math.max(-1.35, Math.min(1.35, pitchObject.rotation.x));
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault();
    if (isPaused) resumeGame();
    else pauseGame();
    return;
  }

  if (isPaused) return;

  if (e.code === 'KeyW') input.forward = true;
  if (e.code === 'KeyS') input.backward = true;
  if (e.code === 'KeyA') input.left = true;
  if (e.code === 'KeyD') input.right = true;
  if (e.code === 'ShiftLeft') input.sprint = true;
  if (e.code === 'ControlLeft') input.crouch = true;
  if (e.code === 'Space' && player.canJump) {
    player.velocity.y = settings.jumpForce;
    player.canJump = false;
    player.isGrounded = false;
  }
  if (e.code === 'KeyR') startReload();
});

document.addEventListener('keyup', (e) => {
  if (isPaused) return;
  if (e.code === 'KeyW') input.forward = false;
  if (e.code === 'KeyS') input.backward = false;
  if (e.code === 'KeyA') input.left = false;
  if (e.code === 'KeyD') input.right = false;
  if (e.code === 'ShiftLeft') input.sprint = false;
  if (e.code === 'ControlLeft') input.crouch = false;
});

document.addEventListener('mousedown', (e) => {
  if (isPaused) return;
  if (e.button === 0) input.shoot = true;
  if (e.button === 2) input.ads = true;
});

document.addEventListener('mouseup', (e) => {
  if (isPaused) return;
  if (e.button === 0) input.shoot = false;
  if (e.button === 2) input.ads = false;
});

document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

createWorld();
updateHUD();
updateMissionUI();
setMessage('Breach the facility perimeter.');

function loop() {
  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;

  if (isPaused) {
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
    return;
  }

  if (campaign.started) {
    updatePlayer(delta);
    updateEnemies(delta);
    updateEnemyProjectiles(delta);
    updatePickups(delta, elapsed);
    updateMissionObjects(delta, elapsed);
    updateDoors(delta);
    animateDecor(elapsed);
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

loop();