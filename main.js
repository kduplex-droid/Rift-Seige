import * as THREE from 'three';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070a);
scene.fog = new THREE.FogExp2(0x0b1018, 0.03);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

const pitchObject = new THREE.Object3D();
pitchObject.add(camera);
const yawObject = new THREE.Object3D();
yawObject.position.set(0, 2.2, 0);
yawObject.add(pitchObject);
scene.add(yawObject);

const clock = new THREE.Clock();
const world = {
  walls: [],
  pickups: [],
  enemies: [],
  projectiles: [],
  enemyProjectiles: [],
  decor: []
};

const ui = {
  overlay: document.getElementById('overlay'),
  startBtn: document.getElementById('startBtn'),
  hud: document.getElementById('hud'),
  health: document.getElementById('health'),
  armor: document.getElementById('armor'),
  ammo: document.getElementById('ammo'),
  enemyCount: document.getElementById('enemyCount'),
  message: document.getElementById('message'),
  damageFlash: document.getElementById('damageFlash')
};

const player = {
  velocity: new THREE.Vector3(),
  direction: new THREE.Vector3(),
  radius: 0.5,
  height: 2.2,
  health: 100,
  armor: 25,
  ammo: 30,
  reserveAmmo: 120,
  maxAmmo: 30,
  canJump: false,
  isGrounded: false,
  fireCooldown: 0,
  reloadTimer: 0,
  bobTime: 0,
  dead: false,
  weaponKick: 0
};

const input = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
  crouch: false,
  shoot: false
};

const settings = {
  gravity: 32,
  walkSpeed: 7,
  sprintSpeed: 11,
  crouchSpeed: 4.2,
  jumpForce: 12,
  friction: 10,
  mouseSensitivity: 0.002,
  enemyViewDistance: 22,
  enemyShootDistance: 12
};

const raycaster = new THREE.Raycaster();
const tmpBox = new THREE.Box3();
const tmpBox2 = new THREE.Box3();
const tmpVec = new THREE.Vector3();
const tmpVec2 = new THREE.Vector3();

const hemiLight = new THREE.HemisphereLight(0x7aa0ff, 0x0f1118, 0.45);
scene.add(hemiLight);

const dirLight = new THREE.DirectionalLight(0xd5e4ff, 1.0);
dirLight.position.set(14, 24, 8);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 80;
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
scene.add(dirLight);

const ambientGlow = new THREE.PointLight(0x446dff, 4, 8, 2);
ambientGlow.position.set(0, 2, 0);
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

function createWorld() {
  const floorGeo = new THREE.BoxGeometry(64, 1, 64);
  const floorMat = makeMaterial(0x1b222b, 0.55, 0.75);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.receiveShadow = true;
  floor.position.y = -0.5;
  scene.add(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(64, 1, 64), makeMaterial(0x11161d, 0.75, 0.45));
  ceiling.position.y = 10;
  scene.add(ceiling);

  const borderThickness = 2;
  addWall(0, 2.5, -31, 64, 6, borderThickness);
  addWall(0, 2.5, 31, 64, 6, borderThickness);
  addWall(-31, 2.5, 0, borderThickness, 6, 64);
  addWall(31, 2.5, 0, borderThickness, 6, 64);

  addWall(0, 2.5, -8, 18, 6, 2);
  addWall(-14, 2.5, 8, 2, 6, 16);
  addWall(12, 2.5, 10, 2, 6, 20);
  addWall(0, 2.5, 20, 24, 6, 2);
  addWall(-20, 2.5, -18, 2, 6, 18);
  addWall(18, 2.5, -18, 2, 6, 18);
  addWall(-10, 1.25, 0, 6, 2.5, 6);
  addWall(18, 1.5, 18, 8, 3, 8);
  addWall(-22, 1.5, 18, 8, 3, 8);

  createCatwalk(0, 3.2, -19, 16, 1, 4);
  createCatwalk(18, 3.2, 0, 4, 1, 16);
  createCatwalk(-18, 3.2, 0, 4, 1, 16);

  for (let i = -24; i <= 24; i += 12) {
    addColumn(i, 2.5, -24);
    addColumn(i, 2.5, 24);
  }
  for (let i = -12; i <= 12; i += 12) {
    addColumn(-24, 2.5, i);
    addColumn(24, 2.5, i);
  }

  addPickup('health', -22, 1, -22);
  addPickup('ammo', 22, 1, -22);
  addPickup('armor', 0, 1, 22);
  addPickup('ammo', -23, 4.4, 0);
  addPickup('health', 23, 4.4, 0);

  spawnEnemy(-16, 1, -10, 'stalker');
  spawnEnemy(15, 1, -13, 'stalker');
  spawnEnemy(-18, 4.2, 0, 'gunner');
  spawnEnemy(18, 4.2, 0, 'gunner');
  spawnEnemy(0, 1, 15, 'brute');

  for (let i = 0; i < 26; i++) {
    createPipe((Math.random() - 0.5) * 52, 2 + Math.random() * 5, (Math.random() - 0.5) * 52);
  }

  const coreGeo = new THREE.CylinderGeometry(1.4, 1.4, 4.4, 10);
  const coreMat = makeMaterial(0x0d1630, 0.7, 0.18, 0x4f88ff, 2.0);
  const reactor = new THREE.Mesh(coreGeo, coreMat);
  reactor.position.set(0, 2.2, 0);
  reactor.castShadow = true;
  reactor.receiveShadow = true;
  scene.add(reactor);

  const reactorLight = new THREE.PointLight(0x5d8eff, 18, 22, 2);
  reactorLight.position.set(0, 3, 0);
  scene.add(reactorLight);
}

function addWall(x, y, z, w, h, d) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeMaterial(0x2b3642, 0.78, 0.28)
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  mesh.userData.solid = true;
  world.walls.push(mesh);

  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, 0.18, d + 0.2),
    makeMaterial(0x6a96ff, 0.5, 0.35, 0x2b55d1, 0.8)
  );
  trim.position.set(x, y + h / 2 - 0.22, z);
  scene.add(trim);
}

function createCatwalk(x, y, z, w, h, d) {
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    makeMaterial(0x343f4c, 0.62, 0.5)
  );
  platform.position.set(x, y, z);
  platform.castShadow = true;
  platform.receiveShadow = true;
  scene.add(platform);
  world.walls.push(platform);

  addWall(x - w / 2 + 0.1, y + 0.85, z, 0.2, 1.5, d);
  addWall(x + w / 2 - 0.1, y + 0.85, z, 0.2, 1.5, d);
}

function addColumn(x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 6, 2.4),
    makeMaterial(0x222b34, 0.76, 0.34)
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  world.walls.push(mesh);

  const light = new THREE.PointLight(0x7ba0ff, 4, 10, 2);
  light.position.set(x, 4.5, z);
  scene.add(light);
}

function createPipe(x, y, z) {
  const pipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.2, 2 + Math.random() * 6, 8),
    makeMaterial(0x475565, 0.75, 0.25)
  );
  pipe.rotation.z = Math.random() > 0.5 ? Math.PI / 2 : 0;
  pipe.rotation.x = Math.random() > 0.75 ? Math.PI / 2 : 0;
  pipe.position.set(x, y, z);
  pipe.castShadow = true;
  scene.add(pipe);
  world.decor.push(pipe);
}

function createWeapon() {
  const gun = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.18, 0.85),
    makeMaterial(0x202833, 0.82, 0.25)
  );
  body.position.set(0.28, -0.28, -0.65);
  body.castShadow = true;

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

  gun.add(body, barrel, glow);
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

function spawnEnemy(x, y, z, type) {
  const group = new THREE.Group();
  const color = type === 'brute' ? 0xc63d48 : type === 'gunner' ? 0x7e4bff : 0xff7b5a;
  const height = type === 'brute' ? 2.8 : 2.2;
  const speed = type === 'brute' ? 2.1 : type === 'gunner' ? 2.8 : 3.8;
  const health = type === 'brute' ? 140 : type === 'gunner' ? 80 : 60;

  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 1.3, 0.7),
    makeMaterial(0x291d23, 0.35, 0.55, color, 0.22)
  );
  torso.position.y = 1.35;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.36, 16, 16),
    makeMaterial(0x171217, 0.25, 0.7, color, 0.4)
  );
  head.position.y = 2.22;

  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), makeMaterial(0xffffff, 0.1, 0.2, color, 3));
  eyeL.position.set(-0.1, 2.22, 0.28);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.1;

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.1, 0.24), makeMaterial(0x1d2026, 0.5, 0.6));
  legL.position.set(-0.24, 0.55, 0);
  const legR = legL.clone();
  legR.position.x = 0.24;

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1, 0.22), makeMaterial(0x1f2328, 0.5, 0.6));
  armL.position.set(-0.74, 1.45, 0);
  const armR = armL.clone();
  armR.position.x = 0.74;

  group.add(torso, head, eyeL, eyeR, legL, legR, armL, armR);
  group.position.set(x, y, z);
  group.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
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
    yVelocity: 0,
    hitFlash: 0,
    strafePhase: Math.random() * Math.PI * 2
  });
  updateEnemyCount();
}

function updateEnemyCount() {
  ui.enemyCount.textContent = world.enemies.length.toString();
}

function setMessage(text) {
  ui.message.textContent = text;
}

function updateHUD() {
  ui.health.textContent = Math.max(0, Math.ceil(player.health)).toString();
  ui.armor.textContent = Math.max(0, Math.ceil(player.armor)).toString();
  ui.ammo.textContent = `${player.ammo} / ${player.reserveAmmo}`;
}

function requestLock() {
  renderer.domElement.requestPointerLock();
}

function onLockChange() {
  const locked = document.pointerLockElement === renderer.domElement;
  ui.overlay.style.display = locked ? 'none' : 'grid';
  ui.hud.style.display = locked ? 'block' : 'none';
}

document.addEventListener('pointerlockchange', onLockChange);
ui.startBtn.addEventListener('click', requestLock);
renderer.domElement.addEventListener('click', () => {
  if (document.pointerLockElement !== renderer.domElement) requestLock();
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || player.dead) return;
  yawObject.rotation.y -= e.movementX * settings.mouseSensitivity;
  pitchObject.rotation.x -= e.movementY * settings.mouseSensitivity;
  pitchObject.rotation.x = Math.max(-1.35, Math.min(1.35, pitchObject.rotation.x));
});

document.addEventListener('keydown', (e) => {
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
  if (e.code === 'KeyW') input.forward = false;
  if (e.code === 'KeyS') input.backward = false;
  if (e.code === 'KeyA') input.left = false;
  if (e.code === 'KeyD') input.right = false;
  if (e.code === 'ShiftLeft') input.sprint = false;
  if (e.code === 'ControlLeft') input.crouch = false;
});

document.addEventListener('mousedown', (e) => {
  if (e.button === 0) input.shoot = true;
});
document.addEventListener('mouseup', (e) => {
  if (e.button === 0) input.shoot = false;
});

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
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

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
  camera.position.y = Math.sin(player.bobTime) * 0.04 * bobStrength + crouchOffset;
  camera.position.x = Math.cos(player.bobTime * 0.5) * 0.03 * bobStrength;

  player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  player.reloadTimer = Math.max(0, player.reloadTimer - delta);
  if (player.reloadTimer === 0 && player.ammo === 0 && player.reserveAmmo > 0) finishReload();

  player.weaponKick = Math.max(0, player.weaponKick - delta * 8);
  weapon.position.z = -player.weaponKick * 0.18;
  muzzleFlash.intensity = Math.max(0, muzzleFlash.intensity - delta * 28);

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
  if (player.reloadTimer > 0) return;
  const needed = player.maxAmmo - player.ammo;
  const amount = Math.min(needed, player.reserveAmmo);
  player.ammo += amount;
  player.reserveAmmo -= amount;
  updateHUD();
  setMessage('Weapon ready.');
}

function shoot() {
  if (player.fireCooldown > 0 || player.reloadTimer > 0) return;
  if (player.ammo <= 0) {
    startReload();
    return;
  }

  player.fireCooldown = 0.11;
  player.ammo--;
  player.weaponKick = 1;
  muzzleFlash.intensity = 6;
  updateHUD();

  const origin = camera.getWorldPosition(new THREE.Vector3());
  const direction = camera.getWorldDirection(new THREE.Vector3());
  const spread = input.sprint ? 0.03 : input.crouch ? 0.006 : 0.014;
  direction.x += (Math.random() - 0.5) * spread;
  direction.y += (Math.random() - 0.5) * spread;
  direction.z += (Math.random() - 0.5) * spread;
  direction.normalize();

  raycaster.set(origin, direction);
  raycaster.far = 60;

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
    updateEnemyCount();
    setMessage(world.enemies.length === 0 ? 'Sector clear.' : 'Hostile neutralized.');
    if (Math.random() > 0.55) addPickup('ammo', point.x, 0.9, point.z);
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

      if (flatDist > (enemy.type === 'brute' ? 2.8 : 6.5)) {
        enemy.mesh.position.addScaledVector(movement, delta);
      }

      enemy.mesh.lookAt(playerPos.x, enemy.mesh.position.y + 1.2, playerPos.z);

      if (flatDist < settings.enemyShootDistance && enemy.shootCooldown <= 0) {
        if (enemy.type === 'brute' && flatDist < 3.2) {
          damagePlayer(14 + Math.random() * 6);
          enemy.shootCooldown = 1.0;
          setMessage('Heavy impact.');
        } else {
          fireEnemyShot(enemy, playerPos);
          enemy.shootCooldown = enemy.type === 'gunner' ? 0.8 : 1.15;
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
    velocity: direction.multiplyScalar(enemy.type === 'gunner' ? 18 : 14),
    life: 3,
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
  if (pickup.type === 'ammo') player.reserveAmmo = Math.min(240, player.reserveAmmo + 30);
  if (pickup.type === 'armor') player.armor = Math.min(100, player.armor + 25);

  updateHUD();
  setMessage(`${pickup.type.toUpperCase()} acquired.`);
  scene.remove(pickup.mesh);
  const index = world.pickups.indexOf(pickup);
  if (index >= 0) world.pickups.splice(index, 1);
}

function animateDecor(elapsed) {
  ambientGlow.position.copy(yawObject.position).add(new THREE.Vector3(0, 1, 0));
  for (let i = 0; i < world.decor.length; i++) {
    const piece = world.decor[i];
    piece.rotation.y += 0.001;
    if (i % 5 === 0) piece.position.y += Math.sin(elapsed + i) * 0.0008;
  }
}

function checkWinCondition() {
  if (world.enemies.length === 0 && !player.dead) {
    setMessage('Reactor secured. Sector dominated.');
  }
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onResize);

createWorld();
updateHUD();
setMessage('Secure the reactor core.');

function loop() {
  const delta = Math.min(clock.getDelta(), 0.033);
  const elapsed = clock.elapsedTime;

  updatePlayer(delta);
  updateEnemies(delta);
  updateEnemyProjectiles(delta);
  updatePickups(delta, elapsed);
  animateDecor(elapsed);
  checkWinCondition();

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

loop();
