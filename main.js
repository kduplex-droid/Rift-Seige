import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0d12);
scene.fog = new THREE.FogExp2(0x14181f, 0.028);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 700);
const baseFov = 75;
const adsFov = 42;

const pitchObject = new THREE.Object3D();
pitchObject.add(camera);

const yawObject = new THREE.Object3D();
yawObject.position.set(0, 2.2, 58);
yawObject.add(pitchObject);
scene.add(yawObject);

const clock = new THREE.Clock();

const weaponDefs = {
  rifle: {
    name: 'RIFLE',
    magSize: 30,
    reserveMax: 180,
    damageMin: 18,
    damageMax: 26,
    fireCooldown: 0.11,
    adsCooldown: 0.14,
    range: 90,
    spread: 0.014,
    crouchSpread: 0.006,
    sprintSpread: 0.03,
    adsSpread: 0.0025,
    reloadTime: 1.2,
    kick: 1.0,
    color: 0x5f92ff,
    pickupColor: 0x5f92ff
  },
  shotgun: {
    name: 'SHOTGUN',
    magSize: 8,
    reserveMax: 48,
    damageMin: 9,
    damageMax: 14,
    pellets: 8,
    fireCooldown: 0.6,
    adsCooldown: 0.68,
    range: 42,
    spread: 0.065,
    crouchSpread: 0.05,
    sprintSpread: 0.085,
    adsSpread: 0.04,
    reloadTime: 1.35,
    kick: 1.45,
    color: 0xffb45f,
    pickupColor: 0xffb45f
  },
  burst: {
    name: 'BURST',
    magSize: 24,
    reserveMax: 144,
    damageMin: 16,
    damageMax: 22,
    burstCount: 3,
    fireCooldown: 0.28,
    adsCooldown: 0.34,
    range: 95,
    spread: 0.01,
    crouchSpread: 0.004,
    sprintSpread: 0.022,
    adsSpread: 0.0018,
    reloadTime: 1.15,
    kick: 0.95,
    color: 0xa06cff,
    pickupColor: 0xa06cff
  }
};

const world = {
  walls: [],
  pickups: [],
  enemies: [],
  enemyProjectiles: [],
  decor: [],
  missionObjects: [],
  extractPad: null,
  doors: {},
  waves: [],
  portals: [],
  jumpPads: [],
  spawnPoints: [],
  minimapShapes: []
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
  weaponName: document.getElementById('weaponName'),
  message: document.getElementById('message'),
  damageFlash: document.getElementById('damageFlash'),
  scopeOverlay: document.getElementById('scopeOverlay'),
  crosshair: document.getElementById('crosshair'),
  missionTitle: document.getElementById('missionTitle'),
  missionObjective: document.getElementById('missionObjective'),
  missionProgress: document.getElementById('missionProgress'),
  sectorLabel: document.getElementById('sectorLabel'),
  missionShort: document.getElementById('missionShort'),
  threatLevel: document.getElementById('threatLevel'),
  healthBar: document.getElementById('healthBar'),
  armorBar: document.getElementById('armorBar'),
  bossHud: document.getElementById('bossHud'),
  bossBar: document.getElementById('bossBar'),
  bossName: document.getElementById('bossName'),
  slotRifle: document.getElementById('slot-rifle'),
  slotShotgun: document.getElementById('slot-shotgun'),
  slotBurst: document.getElementById('slot-burst'),
  terminalFeed: document.getElementById('terminalFeed'),
  minimapWrap: document.getElementById('minimapWrap'),
  minimap: document.getElementById('minimap')
};

const minimapCtx = ui.minimap.getContext('2d');
let minimapVisible = false;

const player = {
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  radius: 0.5,
  height: 2.2,
  health: 100,
  armor: 25,
  canJump: false,
  isGrounded: false,
  fireCooldown: 0,
  reloadTimer: 0,
  bobTime: 0,
  dead: false,
  weaponKick: 0,
  ads: false,
  adsAmount: 0,
  respawnTimer: 0,
  inventory: {
    rifle: { unlocked: true, ammo: 30, reserve: 150 },
    shotgun: { unlocked: false, ammo: 0, reserve: 0 },
    burst: { unlocked: false, ammo: 0, reserve: 0 }
  },
  currentWeapon: 'rifle'
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
  enemyViewDistance: 34,
  enemyShootDistance: 19,
  voidY: -24
};

const bossState = {
  active: false,
  enemy: null
};

const campaign = {
  current: 0,
  started: false,
  missions: [
    {
      title: 'Mission 1: Breach the Yard',
      short: 'BREACH',
      sector: 'OUTER YARD',
      objective: 'Neutralize the perimeter squad',
      type: 'kill',
      target: 10,
      progress: 0,
      setup: setupMission1
    },
    {
      title: 'Mission 2: Disable Relays',
      short: 'RELAYS',
      sector: 'MID FACILITY',
      objective: 'Secure all signal relays',
      type: 'relay',
      target: 3,
      progress: 0,
      setup: setupMission2
    },
    {
      title: 'Mission 3: Core Lockdown',
      short: 'LOCKDOWN',
      sector: 'REACTOR SECTOR',
      objective: 'Destroy the sector war engine',
      type: 'boss',
      target: 1,
      progress: 0,
      setup: setupMission3
    },
    {
      title: 'Mission 4: Extraction',
      short: 'EXTRACT',
      sector: 'OUTSIDE VOID',
      objective: 'Use jump pads to reach extraction',
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
let terminalTimer = 0;
let terminalIndex = 0;

const terminalLines = [
  '> perimeter breach route loaded',
  '> hostile signatures detected',
  '> reactor chamber unstable',
  '> signal relays remain active',
  '> sector lockdown in effect',
  '> external platforms unstable',
  '> extraction corridor awaiting clearance'
];

const raycaster = new THREE.Raycaster();
const tmpBox = new THREE.Box3();
const tmpBox2 = new THREE.Box3();
const tmpVec = new THREE.Vector3();
const upAxis = new THREE.Vector3(0, 1, 0);

const hemiLight = new THREE.HemisphereLight(0x8aa0c8, 0x0a0c10, 0.22);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xc8d8ff, 0.55);
dirLight.position.set(18, 26, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 180;
dirLight.shadow.camera.left = -90;
dirLight.shadow.camera.right = 90;
dirLight.shadow.camera.top = 90;
dirLight.shadow.camera.bottom = -90;
scene.add(dirLight);

const ambientGlow = new THREE.PointLight(0x7aa8ff, 2.2, 10, 2);
scene.add(ambientGlow);

function currentWeaponDef() {
  return weaponDefs[player.currentWeapon];
}

function currentWeaponState() {
  return player.inventory[player.currentWeapon];
}

function makeMaterial(color, metalness = 0.72, roughness = 0.32, emissive = 0x000000, emissiveIntensity = 0) {
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

function updateTopLabels() {
  const mission = campaign.missions[campaign.current];
  if (!mission) return;
  ui.sectorLabel.textContent = mission.sector;
  ui.missionShort.textContent = mission.short;
  ui.threatLevel.textContent =
    bossState.active ? 'CRITICAL' :
    world.enemies.length > 6 ? 'SEVERE' :
    world.enemies.length > 0 ? 'HIGH' : 'LOW';
}

function updateWeaponSlots() {
  const slots = [
    ['rifle', ui.slotRifle],
    ['shotgun', ui.slotShotgun],
    ['burst', ui.slotBurst]
  ];

  for (const [name, el] of slots) {
    el.classList.toggle('active', player.currentWeapon === name);
    el.classList.toggle('unlocked', player.inventory[name].unlocked);
  }
}

function updateBossHud() {
  if (!bossState.active || !bossState.enemy || !world.enemies.includes(bossState.enemy)) {
    ui.bossHud.style.display = 'none';
    return;
  }

  ui.bossHud.style.display = 'block';
  ui.bossName.textContent = 'WAR ENGINE';
  const ratio = Math.max(0, bossState.enemy.health / bossState.enemy.maxHealth);
  ui.bossBar.style.transform = `scaleX(${ratio})`;
}

function updateHUD() {
  ui.health.textContent = Math.max(0, Math.ceil(player.health)).toString();
  ui.armor.textContent = Math.max(0, Math.ceil(player.armor)).toString();

  const state = currentWeaponState();
  const def = currentWeaponDef();
  ui.weaponName.textContent = def.name;
  ui.ammo.textContent = `${state.ammo} / ${state.reserve}`;
  ui.enemyCount.textContent = world.enemies.length.toString();

  ui.healthBar.style.transform = `scaleX(${Math.max(0, player.health) / 100})`;
  ui.armorBar.style.transform = `scaleX(${Math.max(0, player.armor) / 100})`;

  updateWeaponSlots();
  updateTopLabels();
  updateBossHud();
  ui.minimapWrap.style.display = minimapVisible ? 'block' : 'none';
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
  updateTopLabels();
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

function createPlatform(x, y, z, w, h, d, rail = false, pushToWalls = true) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeMaterial(0x343f4c, 0.62, 0.5)
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  if (pushToWalls) world.walls.push(mesh);

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

function createTechBlock(x, y, z, w, h, d) {
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeMaterial(0x2c343d, 0.82, 0.24)
  );
  base.position.set(x, y, z);
  base.castShadow = true;
  base.receiveShadow = true;
  scene.add(base);
  world.decor.push(base);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(w * 0.78, h * 0.18, 0.08),
    makeMaterial(0x111923, 0.35, 0.25, 0x7aa8ff, 1.6)
  );
  panel.position.set(x, y + h * 0.12, z + d / 2 + 0.05);
  scene.add(panel);
  world.decor.push(panel);

  const panel2 = panel.clone();
  panel2.position.y = y - h * 0.12;
  scene.add(panel2);
  world.decor.push(panel2);

  const glow = new THREE.PointLight(0x8fb6ff, 3.5, 8, 2);
  glow.position.set(x, y, z + d / 2 + 0.6);
  scene.add(glow);
  world.decor.push(glow);
}

function createAngledSupport(x, y, z, side = 1) {
  const support = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 8, 2.2),
    makeMaterial(0x313a44, 0.85, 0.22)
  );
  support.position.set(x, y, z);
  support.rotation.z = side * 0.45;
  support.castShadow = true;
  support.receiveShadow = true;
  scene.add(support);
  world.walls.push(support);

  const brace = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 5.2, 1.4),
    makeMaterial(0x252c34, 0.8, 0.28)
  );
  brace.position.set(x + side * 1.8, y + 1.4, z);
  brace.rotation.z = side * -0.65;
  brace.castShadow = true;
  brace.receiveShadow = true;
  scene.add(brace);
  world.walls.push(brace);
}

function createLightStrip(x, y, z, w = 6) {
  const strip = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.12, 0.18),
    makeMaterial(0xcad8ff, 0.2, 0.12, 0x91b5ff, 2.4)
  );
  strip.position.set(x, y, z);
  scene.add(strip);
  world.decor.push(strip);

  const light = new THREE.PointLight(0xb9d1ff, 4, 12, 2);
  light.position.set(x, y - 0.2, z);
  scene.add(light);
  world.decor.push(light);
}

function createFloorPanel(x, z, w, d) {
  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.08, d),
    makeMaterial(0x222931, 0.86, 0.26)
  );
  panel.position.set(x, 0.04, z);
  panel.receiveShadow = true;
  scene.add(panel);
  world.decor.push(panel);
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
    indicator,
    closedLeftX: left.position.x,
    closedRightX: right.position.x,
    openLeftX: left.position.x - width * 0.55,
    openRightX: right.position.x + width * 0.55,
    opening: false,
    open: false
  };

  scene.add(group);

  const leftSolid = addSolid(left);
  const rightSolid = addSolid(right);

  world.doors[name] = {
    group,
    left,
    right,
    indicator,
    leftSolid,
    rightSolid
  };
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

function addSpawnPoint(x, y, z) {
  world.spawnPoints.push(new THREE.Vector3(x, y, z));
}

function createJumpPad(x, y, z, targetX, targetY, targetZ, radius = 2.2) {
  const pad = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.8, 2.2, 0.6, 18),
    makeMaterial(0x1a222c, 0.5, 0.22)
  );
  base.position.y = 0.3;

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.45, 0.12, 10, 28),
    makeMaterial(0x8ec0ff, 0.25, 0.1, 0x8ec0ff, 2)
  );
  ring.position.y = 0.68;
  ring.rotation.x = Math.PI / 2;

  const core = new THREE.Mesh(
    new THREE.CircleGeometry(1.15, 20),
    makeMaterial(0x122132, 0.2, 0.12, 0x7fb8ff, 2.4)
  );
  core.position.y = 0.7;
  core.rotation.x = -Math.PI / 2;

  pad.add(base, ring, core);
  pad.position.set(x, y, z);
  scene.add(pad);

  const glow = new THREE.PointLight(0x8ec0ff, 5, 10, 2);
  glow.position.set(x, y + 1.2, z);
  scene.add(glow);

  world.jumpPads.push({
    mesh: pad,
    ring,
    core,
    glow,
    position: new THREE.Vector3(x, y, z),
    target: new THREE.Vector3(targetX, targetY, targetZ),
    radius,
    cooldown: 0
  });

  world.minimapShapes.push({ type: 'jumppad', x, z });
}

function createOutsideArena() {
  const platformData = [
    { x: 0, y: -0.2, z: -104, w: 18, h: 0.8, d: 18 },
    { x: -22, y: 5, z: -122, w: 14, h: 0.8, d: 14 },
    { x: 18, y: 10, z: -138, w: 12, h: 0.8, d: 12 },
    { x: -10, y: 15, z: -156, w: 12, h: 0.8, d: 12 },
    { x: 16, y: 19, z: -174, w: 14, h: 0.8, d: 14 },
    { x: 0, y: 23, z: -194, w: 18, h: 0.8, d: 18 }
  ];

  for (const p of platformData) {
    createPlatform(p.x, p.y, p.z, p.w, p.h, p.d, false, true);
    const light = new THREE.PointLight(0x9fc6ff, 3, 16, 2);
    light.position.set(p.x, p.y + 4, p.z);
    scene.add(light);
    world.decor.push(light);
    world.minimapShapes.push({ type: 'platform', x: p.x, z: p.z, w: p.w, d: p.d });
  }

  createJumpPad(0, 0, -95, -22, 7, -122);
  createJumpPad(-22, 5.2, -122, 18, 12, -138);
  createJumpPad(18, 10.2, -138, -10, 17, -156);
  createJumpPad(-10, 15.2, -156, 16, 21, -174);
  createJumpPad(16, 19.2, -174, 0, 25, -194);

  addSpawnPoint(0, 2.2, 66);
  addSpawnPoint(-40, 2.2, 10);
  addSpawnPoint(42, 2.2, -6);
  addSpawnPoint(0, 4.5, -66);
  addSpawnPoint(0, 2.2, -104);
  addSpawnPoint(-22, 7, -122);
  addSpawnPoint(18, 12, -138);
  addSpawnPoint(-10, 17, -156);
  addSpawnPoint(16, 21, -174);
  addSpawnPoint(0, 25, -194);
}

function createWorld() {
  const interiorFloor = new THREE.Mesh(
    new THREE.BoxGeometry(150, 1, 176),
    makeMaterial(0x171c23, 0.72, 0.5)
  );
  interiorFloor.receiveShadow = true;
  interiorFloor.position.set(0, -0.5, -2);
  scene.add(interiorFloor);

  const border = 3;
  addWall(0, 3, 82, 150, 8, border, 0x2b333c);
  addWall(0, 3, -90, 150, 8, border, 0x2b333c);
  addWall(-73, 3, -2, border, 8, 176, 0x2b333c);
  addWall(73, 3, -2, border, 8, 176, 0x2b333c);

  addWall(-28, 3, 26, 22, 8, 4, 0x313943);
  addWall(28, 3, 26, 22, 8, 4, 0x313943);
  addWall(-34, 3, -8, 4, 8, 28, 0x313943);
  addWall(34, 3, -8, 4, 8, 28, 0x313943);
  addWall(-20, 3, -50, 20, 8, 4, 0x313943);
  addWall(20, 3, -50, 20, 8, 4, 0x313943);
  addWall(-26, 3, 56, 18, 8, 4, 0x313943);
  addWall(26, 3, 56, 18, 8, 4, 0x313943);

  createDoor('alpha', 0, 26, 18, 8, 2.5);
  createDoor('beta', 0, -10, 18, 8, 2.5);
  createDoor('gamma', 0, -50, 18, 8, 2.5);

  createPlatform(-48, 3.8, 10, 6, 1, 30, true);
  createPlatform(48, 3.8, -6, 6, 1, 30, true);
  createPlatform(0, 3.8, -66, 30, 1, 6, true);
  createPlatform(0, 3.8, 68, 26, 1, 6, true);

  createPlatform(-18, 1, 2, 10, 2, 10, false);
  createPlatform(18, 1, 12, 10, 2, 10, false);
  createPlatform(-22, 0.75, -30, 9, 1.5, 9, false);
  createPlatform(24, 0.75, -36, 9, 1.5, 9, false);

  for (let z = -70; z <= 70; z += 18) {
    createFloorPanel(-22, z, 16, 8);
    createFloorPanel(22, z, 16, 8);
  }
  createFloorPanel(0, 0, 26, 18);
  createFloorPanel(0, -60, 34, 12);

  createAngledSupport(-58, 4, 52, 1);
  createAngledSupport(58, 4, 52, -1);
  createAngledSupport(-58, 4, 8, 1);
  createAngledSupport(58, 4, -4, -1);
  createAngledSupport(-58, 4, -52, 1);
  createAngledSupport(58, 4, -52, -1);

  for (let x = -52; x <= 52; x += 26) {
    addColumn(x, 4, -66, 3.5);
    addColumn(x, 4, 66, 3.5);
  }

  createTechBlock(-8, 2.4, -62, 5, 4.8, 5);
  createTechBlock(0, 2.4, -62, 5, 4.8, 5);
  createTechBlock(8, 2.4, -62, 5, 4.8, 5);
  createTechBlock(-42, 2.1, 8, 4, 4.2, 4);
  createTechBlock(42, 2.1, -4, 4, 4.2, 4);

  createLightStrip(-44, 6.8, 26, 10);
  createLightStrip(44, 6.8, 26, 10);
  createLightStrip(-44, 6.8, -18, 10);
  createLightStrip(44, 6.8, -18, 10);
  createLightStrip(0, 6.8, -64, 14);

  const coverPositions = [
    [-24, 1.5, 8, 6, 3, 4],
    [24, 1.5, 8, 6, 3, 4],
    [-12, 1.5, -20, 5, 3, 5],
    [12, 1.5, -22, 5, 3, 5],
    [-40, 1.5, -56, 5, 3, 5],
    [40, 1.5, -56, 5, 3, 5],
    [-40, 1.5, 46, 5, 3, 5],
    [40, 1.5, 46, 5, 3, 5]
  ];
  for (const [x, y, z, w, h, d] of coverPositions) {
    addWall(x, y, z, w, h, d, 0x2a3138);
  }

  for (let i = 0; i < 46; i++) {
    createPipe((Math.random() - 0.5) * 126, 2 + Math.random() * 5, (Math.random() - 0.5) * 150, 4 + Math.random() * 7);
  }

  createLamp(-52, 6, -68);
  createLamp(52, 6, -68);
  createLamp(-52, 6, 68);
  createLamp(52, 6, 68);
  createLamp(0, 6, -28, 0x8eb4ff, 8, 20);
  createLamp(0, 6, 36, 0x8eb4ff, 8, 20);

  addPickup('health', -58, 1, 70);
  addPickup('ammo', 58, 1, 70, 'rifle');
  addPickup('armor', 0, 4.8, 68);
  addPickup('ammo', -46, 4.8, 6, 'rifle');
  addPickup('health', 46, 4.8, -6);

  const reactorBase = new THREE.Mesh(
    new THREE.CylinderGeometry(3.6, 4.2, 2.2, 16),
    makeMaterial(0x252d36, 0.78, 0.24)
  );
  reactorBase.position.set(0, 1.1, -64);
  reactorBase.castShadow = true;
  reactorBase.receiveShadow = true;
  scene.add(reactorBase);

  const reactor = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 6.2, 16),
    makeMaterial(0x0e1620, 0.72, 0.14, 0x7aa8ff, 2.6)
  );
  reactor.position.set(0, 4.2, -64);
  reactor.castShadow = true;
  reactor.receiveShadow = true;
  scene.add(reactor);

  const reactorRing = new THREE.Mesh(
    new THREE.TorusGeometry(3.2, 0.18, 12, 28),
    makeMaterial(0x7aa8ff, 0.35, 0.18, 0x9fc0ff, 1.2)
  );
  reactorRing.position.set(0, 4.3, -64);
  reactorRing.rotation.x = Math.PI / 2;
  scene.add(reactorRing);
  world.decor.push(reactorRing);

  const reactorLight = new THREE.PointLight(0x8fb6ff, 16, 30, 2);
  reactorLight.position.set(0, 4.4, -64);
  scene.add(reactorLight);

  createOutsideArena();

  world.extractPad = new THREE.Mesh(
    new THREE.CylinderGeometry(4.5, 4.5, 0.35, 24),
    makeMaterial(0x122130, 0.35, 0.35, 0x55ffbf, 0)
  );
  world.extractPad.position.set(0, 23.2, -194);
  world.extractPad.visible = false;
  scene.add(world.extractPad);

  world.minimapShapes.push({ type: 'rect', x: 0, z: -2, w: 150, d: 176 });
  world.minimapShapes.push({ type: 'reactor', x: 0, z: -64 });
  world.minimapShapes.push({ type: 'extract', x: 0, z: -194 });

  addSpawnPoint(0, 2.2, 66);
  addSpawnPoint(-40, 2.2, 10);
  addSpawnPoint(42, 2.2, -6);
  addSpawnPoint(0, 4.8, -66);
}

function createWeaponVisuals() {
  const root = new THREE.Group();
  camera.add(root);

  const visuals = {};

  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.95), makeMaterial(0x202833, 0.82, 0.25));
    body.position.set(0.28, -0.28, -0.68);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.6, 12), makeMaterial(0xb7c9e7, 0.9, 0.15));
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.48, -0.24, -1.08);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.3), makeMaterial(0x182640, 0.5, 0.3, weaponDefs.rifle.color, 1.8));
    glow.position.set(0.23, -0.18, -0.72);
    const scopeBase = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.18), makeMaterial(0x10161f, 0.7, 0.3));
    scopeBase.position.set(0.18, -0.12, -0.6);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 18), makeMaterial(0x151d27, 0.8, 0.22));
    scopeTube.rotation.z = Math.PI / 2;
    scopeTube.position.set(0.22, -0.08, -0.8);
    g.add(body, barrel, glow, scopeBase, scopeTube);
    root.add(g);
    visuals.rifle = g;
  }

  {
    const g = new THREE.Group();
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.22, 0.78), makeMaterial(0x271f18, 0.35, 0.6));
    stock.position.set(0.25, -0.3, -0.55);
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.22, 0.5), makeMaterial(0x242b33, 0.82, 0.2));
    receiver.position.set(0.42, -0.28, -0.9);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.95, 14), makeMaterial(0xc9d2dd, 0.9, 0.18));
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.78, -0.22, -1.18);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.32), makeMaterial(0x1a1d22, 0.5, 0.35, weaponDefs.shotgun.color, 0.7));
    pump.position.set(0.58, -0.23, -1.03);
    g.add(stock, receiver, barrel, pump);
    root.add(g);
    visuals.shotgun = g;
  }

  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.17, 0.8), makeMaterial(0x1f2430, 0.82, 0.25));
    body.position.set(0.27, -0.27, -0.66);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.52, 12), makeMaterial(0xd4dbeb, 0.9, 0.15));
    barrel.rotation.z = Math.PI / 2;
    barrel.position.set(0.43, -0.23, -1.02);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.28), makeMaterial(0x1a1830, 0.4, 0.25, weaponDefs.burst.color, 1.9));
    core.position.set(0.22, -0.17, -0.73);
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.32), makeMaterial(0x151a22, 0.65, 0.22));
    topRail.position.set(0.21, -0.1, -0.72);
    const optic = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.14), makeMaterial(0x11151d, 0.75, 0.2));
    optic.position.set(0.21, -0.04, -0.8);
    g.add(body, barrel, core, topRail, optic);
    root.add(g);
    visuals.burst = g;
  }

  return { root, visuals };
}

const weaponVisual = createWeaponVisuals();

function refreshWeaponVisual() {
  for (const key of Object.keys(weaponVisual.visuals)) {
    weaponVisual.visuals[key].visible = key === player.currentWeapon;
  }
}

const muzzleFlash = new THREE.PointLight(0x8db7ff, 0, 4, 2);
muzzleFlash.position.set(0.48, -0.24, -1.08);
camera.add(muzzleFlash);

function addPickup(type, x, y, z, weaponType = null) {
  let color = 0x62b3ff;
  if (type === 'health') color = 0x4cff88;
  if (type === 'armor') color = 0x62b3ff;
  if (type === 'ammo') color = weaponDefs[weaponType || 'rifle'].pickupColor;
  if (type === 'weapon') color = weaponDefs[weaponType].pickupColor;

  const group = new THREE.Group();

  if (type === 'weapon') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.35, 0.45),
      makeMaterial(0x151d24, 0.5, 0.25, color, 1.3)
    );
    const barrel = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.12, 0.12),
      makeMaterial(color, 0.5, 0.2, color, 0.8)
    );
    barrel.position.x = 0.55;
    group.add(body, barrel);
  } else {
    const body = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.6),
      makeMaterial(0x1a222b, 0.72, 0.18, color, 1.8)
    );
    group.add(body);
  }

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.9, 0.08, 8, 24),
    makeMaterial(color, 0.65, 0.2, color, 0.8)
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  group.position.set(x, y, z);
  scene.add(group);

  world.pickups.push({
    type,
    weaponType,
    mesh: group,
    time: Math.random() * Math.PI * 2
  });
}

function giveWeapon(weaponType) {
  const slot = player.inventory[weaponType];
  const def = weaponDefs[weaponType];

  if (!slot.unlocked) {
    slot.unlocked = true;
    slot.ammo = Math.max(slot.ammo, def.magSize);
    slot.reserve = Math.max(slot.reserve, Math.floor(def.magSize * 2));
    setMessage(`${def.name} acquired.`);
  } else {
    slot.reserve = Math.min(def.reserveMax, slot.reserve + def.magSize);
    setMessage(`${def.name} ammo acquired.`);
  }

  switchWeapon(weaponType);
}

function addAmmo(weaponType, amount) {
  const slot = player.inventory[weaponType];
  const def = weaponDefs[weaponType];
  slot.reserve = Math.min(def.reserveMax, slot.reserve + amount);
}

function switchWeapon(weaponType) {
  const slot = player.inventory[weaponType];
  if (!slot || !slot.unlocked) return;
  if (player.currentWeapon === weaponType) return;

  player.currentWeapon = weaponType;
  player.reloadTimer = 0;
  refreshWeaponVisual();
  updateHUD();
  setMessage(`${weaponDefs[weaponType].name} online.`);
}

function createPortal(x, y, z, color = 0x79a8ff) {
  const group = new THREE.Group();

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.3, 0.12, 14, 36),
    makeMaterial(color, 0.35, 0.12, color, 1.8)
  );
  ring.rotation.y = Math.PI / 2;

  const core = new THREE.Mesh(
    new THREE.CircleGeometry(1.08, 28),
    makeMaterial(0x0f1620, 0.08, 0.18, color, 2.2)
  );
  core.rotation.y = Math.PI / 2;

  const halo = new THREE.PointLight(color, 10, 14, 2);

  group.add(ring, core, halo);
  group.position.set(x, y, z);
  scene.add(group);

  world.portals.push({
    mesh: group,
    ring,
    core,
    glow: halo,
    life: 1.5
  });
}

function updatePortals(delta) {
  for (const portal of [...world.portals]) {
    portal.life -= delta;
    portal.mesh.rotation.z += delta * 2.8;
    portal.ring.rotation.x += delta * 3.4;
    portal.core.material.emissiveIntensity = 1.2 + Math.sin(performance.now() * 0.01) * 0.6;
    portal.glow.intensity = Math.max(0, portal.life * 8);

    if (portal.life <= 0) {
      scene.remove(portal.mesh);
      const i = world.portals.indexOf(portal);
      if (i >= 0) world.portals.splice(i, 1);
    }
  }
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
  const isBoss = type === 'boss';
  const height = isBoss ? 4.4 : type === 'brute' ? 2.8 : 2.2;
  const speed = isBoss ? 1.85 : type === 'brute' ? 2.2 : type === 'gunner' ? 2.9 : 3.8;
  const health = isBoss ? 620 : type === 'brute' ? 140 : type === 'gunner' ? 85 : 60;
  const scale = isBoss ? 1.55 : 1;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.1 * scale, 1.3 * scale, 0.7 * scale),
    makeMaterial(0x2a2326, 0.42, 0.48, isBoss ? 0xff6d6d : color, 0.28)
  );
  torso.position.y = 1.35 * scale;

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.55 * scale, 0.45 * scale, 0.18 * scale),
    makeMaterial(0x141920, 0.22, 0.24, isBoss ? 0xff6d6d : color, isBoss ? 2.8 : 1.8)
  );
  chest.position.set(0, 1.4 * scale, 0.38 * scale);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.36 * scale, 16, 16),
    makeMaterial(0x171217, 0.25, 0.7, isBoss ? 0xff6d6d : color, isBoss ? 0.8 : 0.4)
  );
  head.position.y = 2.22 * scale;

  const eyeL = new THREE.Mesh(
    new THREE.SphereGeometry(0.06 * scale, 8, 8),
    makeMaterial(0xffffff, 0.1, 0.2, isBoss ? 0xff8888 : color, isBoss ? 4 : 3)
  );
  eyeL.position.set(-0.1 * scale, 2.22 * scale, 0.28 * scale);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1 * scale;

  const shoulderL = new THREE.Mesh(
    new THREE.BoxGeometry(0.28 * scale, 0.28 * scale, 0.28 * scale),
    makeMaterial(0x1c2028, 0.5, 0.55)
  );
  shoulderL.position.set(-0.58 * scale, 1.7 * scale, 0);
  const shoulderR = shoulderL.clone();
  shoulderR.position.x = 0.58 * scale;

  const armL = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 0.7 * scale, 0.2 * scale),
    makeMaterial(0x1f2328, 0.5, 0.6)
  );
  armL.position.set(-0.72 * scale, 1.2 * scale, 0);
  const armR = armL.clone();
  armR.position.x = 0.72 * scale;

  const forearmL = new THREE.Mesh(
    new THREE.BoxGeometry(0.18 * scale, 0.6 * scale, 0.18 * scale),
    makeMaterial(0x1a1e25, 0.45, 0.62)
  );
  forearmL.position.set(-0.72 * scale, 0.65 * scale, 0.06 * scale);
  const forearmR = forearmL.clone();
  forearmR.position.x = 0.72 * scale;

  const legL = new THREE.Mesh(
    new THREE.BoxGeometry(0.24 * scale, 0.7 * scale, 0.24 * scale),
    makeMaterial(0x1d2026, 0.5, 0.6)
  );
  legL.position.set(-0.24 * scale, 0.8 * scale, 0);
  const legR = legL.clone();
  legR.position.x = 0.24 * scale;

  const shinL = new THREE.Mesh(
    new THREE.BoxGeometry(0.2 * scale, 0.55 * scale, 0.2 * scale),
    makeMaterial(0x171b21, 0.5, 0.62)
  );
  shinL.position.set(-0.24 * scale, 0.25 * scale, 0.04 * scale);
  const shinR = shinL.clone();
  shinR.position.x = 0.24 * scale;

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

  const enemy = {
    mesh: group,
    type,
    speed,
    health,
    maxHealth: health,
    shootCooldown: isBoss ? 0.8 : 1 + Math.random(),
    radius: isBoss ? 1.1 : 0.65,
    height,
    hitFlash: 0,
    strafePhase: Math.random() * Math.PI * 2
  };

  world.enemies.push(enemy);

  if (isBoss) {
    bossState.active = true;
    bossState.enemy = enemy;
    updateBossHud();
  }

  updateHUD();
  return enemy;
}

function queueWave(delay, enemies) {
  world.waves.push({
    delay,
    elapsed: 0,
    triggered: false,
    enemies
  });
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
  bossState.active = false;
  bossState.enemy = null;
  updateHUD();
}

function clearWaves() {
  world.waves.length = 0;
}

function clearPortals() {
  for (const portal of world.portals) {
    scene.remove(portal.mesh);
  }
  world.portals.length = 0;
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

function resetPlayerLoadout() {
  player.inventory.rifle = { unlocked: true, ammo: 30, reserve: 150 };
  player.inventory.shotgun = { unlocked: false, ammo: 0, reserve: 0 };
  player.inventory.burst = { unlocked: false, ammo: 0, reserve: 0 };
  player.currentWeapon = 'rifle';
  player.health = 100;
  player.armor = 25;
  player.dead = false;
  player.reloadTimer = 0;
  player.fireCooldown = 0;
  player.velocity.set(0, 0, 0);
  refreshWeaponVisual();
}

function respawnPlayer(randomized = true) {
  if (world.spawnPoints.length === 0) return;
  const index = randomized ? Math.floor(Math.random() * world.spawnPoints.length) : 0;
  const p = world.spawnPoints[index];
  yawObject.position.set(p.x, p.y, p.z);
  player.velocity.set(0, 0, 0);
  player.health = Math.max(50, player.health);
  setMessage('Respawned.');
  updateHUD();
}

function startCampaign() {
  campaign.started = true;
  campaign.current = 0;
  for (const mission of campaign.missions) mission.progress = 0;
  resetDoors();
  resetPlayerLoadout();
  world.extractPad.visible = false;
  beginMission();
  respawnPlayer(false);
}

function beginMission() {
  clearMissionObjects();
  clearEnemies();
  clearWaves();
  clearPortals();
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
    ui.bossHud.style.display = 'none';
    return;
  }

  mission.progress = 0;
  updateMissionUI();
  mission.setup();
  setMessage(mission.objective);
  updateHUD();
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

  queueWave(5.5, [
    { x: -32, y: 1, z: 8, type: 'gunner', portalColor: 0xa06cff },
    { x: 38, y: 1, z: -4, type: 'gunner', portalColor: 0xa06cff },
    { x: 0, y: 1, z: 34, type: 'stalker', portalColor: 0xff7b5a }
  ]);

  queueWave(10.5, [
    { x: -12, y: 1, z: 50, type: 'stalker', portalColor: 0xff7b5a },
    { x: 14, y: 1, z: 50, type: 'stalker', portalColor: 0xff7b5a },
    { x: 0, y: 1, z: 28, type: 'brute', portalColor: 0xc63d48 }
  ]);

  addPickup('weapon', -24, 1, 60, 'shotgun');
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

  queueWave(6.0, [
    { x: -24, y: 1, z: -12, type: 'stalker', portalColor: 0xff7b5a },
    { x: 24, y: 1, z: -12, type: 'stalker', portalColor: 0xff7b5a }
  ]);

  queueWave(12.0, [
    { x: 0, y: 1, z: -28, type: 'brute', portalColor: 0xc63d48 },
    { x: -40, y: 1, z: -6, type: 'gunner', portalColor: 0xa06cff },
    { x: 40, y: 1, z: -6, type: 'gunner', portalColor: 0xa06cff }
  ]);

  addPickup('ammo', -42, 1, -6, 'shotgun');
  addPickup('weapon', 36, 1, -14, 'burst');
}

function setupMission3() {
  spawnEnemy(-20, 1, -46, 'stalker');
  spawnEnemy(20, 1, -46, 'stalker');

  queueWave(4.0, [
    { x: -32, y: 1, z: -58, type: 'gunner', portalColor: 0xa06cff },
    { x: 32, y: 1, z: -58, type: 'gunner', portalColor: 0xa06cff }
  ]);

  queueWave(8.5, [
    { x: 0, y: 1, z: -66, type: 'boss', portalColor: 0xff6666 }
  ]);

  addPickup('ammo', -18, 1, -48, 'burst');
  addPickup('ammo', 18, 1, -48, 'shotgun');
}

function setupMission4() {
  world.extractPad.visible = true;
  campaign.missions[campaign.current].progress = 0;
  updateMissionUI();
  setMessage('Use jump pads to cross the outside void and reach extraction.');

  queueWave(4.0, [
    { x: 0, y: 0, z: -104, type: 'stalker', portalColor: 0xff7b5a },
    { x: -22, y: 5, z: -122, type: 'gunner', portalColor: 0xa06cff }
  ]);
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

  if (nextPos.y < player.height && nextPos.z > -90) {
    nextPos.y = input.crouch ? 1.35 : player.height;
    player.velocity.y = 0;
    grounded = true;
  }

  player.isGrounded = grounded;
  if (grounded) player.canJump = true;
}

function updateJumpPads(delta) {
  for (const pad of world.jumpPads) {
    pad.cooldown = Math.max(0, pad.cooldown - delta);
    pad.ring.rotation.z += delta * 2.4;
    pad.core.material.emissiveIntensity = 1.8 + Math.sin(performance.now() * 0.012) * 0.5;
    pad.glow.intensity = 4 + Math.sin(performance.now() * 0.01) * 1.2;

    if (pad.cooldown > 0) continue;

    const dx = yawObject.position.x - pad.position.x;
    const dz = yawObject.position.z - pad.position.z;
    const dist = Math.hypot(dx, dz);

    if (dist < pad.radius && yawObject.position.y <= pad.position.y + 3 && player.velocity.y <= 2) {
      const displacement = pad.target.clone().sub(yawObject.position);
      const flightTime = 1.0;
      player.velocity.x = displacement.x / flightTime;
      player.velocity.z = displacement.z / flightTime;
      player.velocity.y = Math.max(17, (displacement.y + 0.5 * settings.gravity * flightTime * flightTime) / flightTime);
      player.isGrounded = false;
      player.canJump = false;
      pad.cooldown = 1.0;
      setMessage('Jump pad engaged.');
    }
  }
}

function checkVoidRespawn() {
  if (yawObject.position.y < settings.voidY) {
    player.armor = Math.max(0, player.armor - 15);
    player.health = Math.max(25, player.health - 20);
    respawnPlayer(true);
  }
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
  player.weaponKick = Math.max(0, player.weaponKick - delta * 8);

  weaponVisual.root.position.x = 0.18 - player.adsAmount * 0.16 + Math.cos(player.bobTime * 0.5) * 0.03 * (1 - player.adsAmount);
  weaponVisual.root.position.y = -0.28 + player.adsAmount * 0.12 + Math.sin(player.bobTime) * 0.04 * (1 - player.adsAmount);
  weaponVisual.root.position.z = -player.weaponKick * 0.18 - player.adsAmount * 0.28;

  muzzleFlash.intensity = Math.max(0, muzzleFlash.intensity - delta * 28);

  ui.scopeOverlay.style.display = player.adsAmount > 0.82 ? 'block' : 'none';
  ui.crosshair.style.display = player.adsAmount > 0.82 ? 'none' : 'block';

  if (input.shoot) shoot();
}

function startReload() {
  const def = currentWeaponDef();
  const state = currentWeaponState();
  if (player.reloadTimer > 0 || state.ammo === def.magSize || state.reserve <= 0 || player.dead) return;

  player.reloadTimer = def.reloadTime;
  setMessage('Reloading...');

  setTimeout(() => {
    if (!player.dead) finishReload();
  }, def.reloadTime * 1000);
}

function finishReload() {
  const def = currentWeaponDef();
  const state = currentWeaponState();

  const needed = def.magSize - state.ammo;
  if (needed <= 0 || state.reserve <= 0) {
    player.reloadTimer = 0;
    return;
  }

  const amount = Math.min(needed, state.reserve);
  state.ammo += amount;
  state.reserve -= amount;
  player.reloadTimer = 0;
  updateHUD();
  setMessage('Weapon ready.');
}

function applyHitscanHit(direction, range, damageMin, damageMax) {
  const origin = camera.getWorldPosition(new THREE.Vector3());

  raycaster.set(origin, direction);
  raycaster.far = range;

  let closestHit = null;
  let closestDistance = Infinity;

  for (const enemy of world.enemies) {
    const bodyBox = new THREE.Box3(
      new THREE.Vector3(enemy.mesh.position.x - enemy.radius, enemy.mesh.position.y, enemy.mesh.position.z - enemy.radius),
      new THREE.Vector3(enemy.mesh.position.x + enemy.radius, enemy.mesh.position.y + enemy.height, enemy.mesh.position.z + enemy.radius)
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
    damageEnemy(
      closestHit.enemy,
      damageMin + Math.random() * (damageMax - damageMin),
      closestHit.point
    );
  }
}

function shoot() {
  if (player.fireCooldown > 0 || player.reloadTimer > 0) return;

  const def = currentWeaponDef();
  const state = currentWeaponState();

  if (state.ammo <= 0) {
    startReload();
    return;
  }

  player.fireCooldown = player.ads ? def.adsCooldown : def.fireCooldown;
  state.ammo--;
  player.weaponKick = def.kick;
  muzzleFlash.intensity = 6;
  muzzleFlash.color.setHex(def.color);
  updateHUD();

  const shotCount = def.burstCount || 1;
  const pelletCount = def.pellets || 1;

  for (let s = 0; s < shotCount; s++) {
    const burstDelay = s * 55;
    setTimeout(() => {
      if (player.dead) return;

      for (let p = 0; p < pelletCount; p++) {
        const direction = camera.getWorldDirection(new THREE.Vector3());
        const spread = player.ads
          ? def.adsSpread
          : input.sprint ? def.sprintSpread
          : input.crouch ? def.crouchSpread
          : def.spread;

        direction.x += (Math.random() - 0.5) * spread;
        direction.y += (Math.random() - 0.5) * spread;
        direction.z += (Math.random() - 0.5) * spread;
        direction.normalize();

        applyHitscanHit(direction, def.range, def.damageMin, def.damageMax);
      }
    }, burstDelay);
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

    if (enemy.type === 'boss') {
      bossState.active = false;
      bossState.enemy = null;
      const mission = campaign.missions[campaign.current];
      if (mission && mission.type === 'boss') {
        mission.progress = 1;
        updateMissionUI();
        completeMission();
      }
    } else {
      const mission = campaign.missions[campaign.current];
      if (mission && mission.type === 'kill' && mission.progress < mission.target) {
        mission.progress++;
        updateMissionUI();
        if (mission.progress >= mission.target) completeMission();
      }
    }

    const roll = Math.random();
    if (enemy.type !== 'boss') {
      if (roll > 0.82) addPickup('weapon', point.x, point.y, point.z, enemy.type === 'gunner' ? 'burst' : 'shotgun');
      else if (roll > 0.55) addPickup('ammo', point.x, point.y, point.z, enemy.type === 'gunner' ? 'burst' : 'shotgun');
    }

    setMessage(enemy.type === 'boss' ? 'War engine destroyed.' : world.enemies.length === 0 ? 'Sector clear.' : 'Hostile neutralized.');
    updateHUD();
  } else if (enemy.type === 'boss') {
    updateBossHud();
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
    enemyMat.emissiveIntensity = enemy.hitFlash > 0 ? 1.6 : enemy.type === 'boss' ? 0.5 : 0.22;

    tmpVec.copy(playerPos).sub(enemy.mesh.position);
    const flatDist = Math.hypot(tmpVec.x, tmpVec.z);
    const seesPlayer = flatDist < settings.enemyViewDistance + (enemy.type === 'boss' ? 8 : 0);

    if (seesPlayer) {
      const desired = tmpVec.clone().setY(0).normalize();
      const strafe = Math.sin(performance.now() * 0.0015 + enemy.strafePhase) * (enemy.type === 'boss' ? 0.2 : 0.65);
      const lateral = new THREE.Vector3(-desired.z, 0, desired.x).multiplyScalar(strafe);
      const movement = desired.multiplyScalar(enemy.speed).add(lateral.multiplyScalar(enemy.type === 'gunner' ? 1 : 0.35));

      if (flatDist > (enemy.type === 'boss' ? 6.5 : enemy.type === 'brute' ? 3.4 : 7.5)) {
        enemy.mesh.position.addScaledVector(movement, delta);
      }

      enemy.mesh.lookAt(playerPos.x, enemy.mesh.position.y + 1.2, playerPos.z);

      if (flatDist < settings.enemyShootDistance + (enemy.type === 'boss' ? 10 : 0) && enemy.shootCooldown <= 0) {
        if ((enemy.type === 'brute' || enemy.type === 'boss') && flatDist < (enemy.type === 'boss' ? 7.5 : 3.5)) {
          damagePlayer(enemy.type === 'boss' ? 22 + Math.random() * 8 : 14 + Math.random() * 6);
          enemy.shootCooldown = enemy.type === 'boss' ? 0.9 : 1.0;
          setMessage(enemy.type === 'boss' ? 'Boss impact.' : 'Heavy impact.');
        } else {
          fireEnemyShot(enemy, playerPos);
          enemy.shootCooldown = enemy.type === 'boss' ? 0.42 : enemy.type === 'gunner' ? 0.78 : 1.1;
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
  }
}

function fireEnemyShot(enemy, playerPos) {
  const emissive = enemy.type === 'boss' ? 0xff5f5f : enemy.type === 'gunner' ? 0xa06cff : 0xff7848;
  const projectile = new THREE.Mesh(
    new THREE.SphereGeometry(enemy.type === 'boss' ? 0.18 : 0.12, 12, 12),
    makeMaterial(0x7aa4ff, 0.25, 0.2, emissive, 3)
  );
  projectile.position.copy(enemy.mesh.position).add(new THREE.Vector3(0, enemy.type === 'boss' ? 2.4 : 1.6, 0));
  scene.add(projectile);

  const direction = playerPos.clone().add(new THREE.Vector3(0, -0.6, 0)).sub(projectile.position).normalize();
  direction.x += (Math.random() - 0.5) * (enemy.type === 'boss' ? 0.03 : 0.05);
  direction.y += (Math.random() - 0.5) * (enemy.type === 'boss' ? 0.03 : 0.05);
  direction.z += (Math.random() - 0.5) * (enemy.type === 'boss' ? 0.03 : 0.05);
  direction.normalize();

  world.enemyProjectiles.push({
    mesh: projectile,
    velocity: direction.multiplyScalar(enemy.type === 'boss' ? 26 : enemy.type === 'gunner' ? 22 : 16),
    life: 4,
    damage: enemy.type === 'boss' ? 16 : enemy.type === 'gunner' ? 10 : 7
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
  if (pickup.type === 'health') {
    player.health = Math.min(100, player.health + 30);
    setMessage('HEALTH acquired.');
  }

  if (pickup.type === 'armor') {
    player.armor = Math.min(100, player.armor + 25);
    setMessage('ARMOR acquired.');
  }

  if (pickup.type === 'ammo') {
    const weaponType = pickup.weaponType || 'rifle';
    const amount = weaponType === 'shotgun' ? 8 : weaponType === 'burst' ? 24 : 30;
    addAmmo(weaponType, amount);
    setMessage(`${weaponDefs[weaponType].name} ammo acquired.`);
  }

  if (pickup.type === 'weapon') {
    giveWeapon(pickup.weaponType);
  }

  updateHUD();
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
    if (dist < 5.4) {
      mission.progress = 1;
      updateMissionUI();
      completeMission();
      world.extractPad.visible = false;
    }
  }
}

function updateWaves(delta) {
  for (const wave of world.waves) {
    if (wave.triggered) continue;
    wave.elapsed += delta;
    if (wave.elapsed >= wave.delay) {
      wave.triggered = true;
      for (const e of wave.enemies) {
        createPortal(e.x, e.y + 1.3, e.z, e.portalColor || 0x79a8ff);
        setTimeout(() => spawnEnemy(e.x, e.y, e.z, e.type), 650);
      }
      setMessage('Hostile reinforcements inbound.');
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

function updateLandingFeed(delta) {
  if (gameStarted) return;
  terminalTimer += delta;
  if (terminalTimer < 1.6) return;
  terminalTimer = 0;
  terminalIndex = (terminalIndex + 1) % terminalLines.length;

  const newLine = document.createElement('div');
  newLine.textContent = terminalLines[terminalIndex];
  ui.terminalFeed.prepend(newLine);
  while (ui.terminalFeed.children.length > 3) ui.terminalFeed.removeChild(ui.terminalFeed.lastChild);
}

function drawMinimap() {
  if (!minimapVisible) return;

  const ctx = minimapCtx;
  const w = ui.minimap.width;
  const h = ui.minimap.height;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#08111a';
  ctx.fillRect(0, 0, w, h);

  const worldMinX = -80;
  const worldMaxX = 80;
  const worldMinZ = -210;
  const worldMaxZ = 90;

  function tx(x) { return ((x - worldMinX) / (worldMaxX - worldMinX)) * w; }
  function ty(z) { return h - ((z - worldMinZ) / (worldMaxZ - worldMinZ)) * h; }

  ctx.strokeStyle = 'rgba(120,170,255,0.15)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 10; i++) {
    const gx = (w / 10) * i;
    const gy = (h / 10) * i;
    ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
  }

  for (const s of world.minimapShapes) {
    if (s.type === 'rect' || s.type === 'platform') {
      ctx.fillStyle = s.type === 'platform' ? 'rgba(120,180,255,0.22)' : 'rgba(80,120,180,0.16)';
      const rx = tx(s.x - s.w / 2);
      const ry = ty(s.z + s.d / 2);
      const rw = tx(s.x + s.w / 2) - tx(s.x - s.w / 2);
      const rh = ty(s.z - s.d / 2) - ty(s.z + s.d / 2);
      ctx.fillRect(rx, ry, rw, rh);
    } else if (s.type === 'jumppad') {
      ctx.fillStyle = '#89c1ff';
      ctx.beginPath();
      ctx.arc(tx(s.x), ty(s.z), 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.type === 'extract') {
      ctx.fillStyle = '#61f7be';
      ctx.beginPath();
      ctx.arc(tx(s.x), ty(s.z), 6, 0, Math.PI * 2);
      ctx.fill();
    } else if (s.type === 'reactor') {
      ctx.fillStyle = '#ff9d9d';
      ctx.beginPath();
      ctx.arc(tx(s.x), ty(s.z), 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const enemy of world.enemies) {
    ctx.fillStyle = enemy.type === 'boss' ? '#ff5f5f' : '#ffb36d';
    ctx.beginPath();
    ctx.arc(tx(enemy.mesh.position.x), ty(enemy.mesh.position.z), enemy.type === 'boss' ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(tx(yawObject.position.x), ty(yawObject.position.z));
  ctx.rotate(-yawObject.rotation.y);
  ctx.fillStyle = '#dbe7ff';
  ctx.beginPath();
  ctx.moveTo(0, -8);
  ctx.lineTo(5, 6);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
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

ui.loadoutBtn.addEventListener('click', () => setMessage('Switch weapons with 1 / 2 / 3.'));
ui.intelBtn.addEventListener('click', () => setMessage('Outside sector requires jump pad traversal.'));
renderer.domElement.addEventListener('click', () => {
  if (gameStarted
