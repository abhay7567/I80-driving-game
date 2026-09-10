import * as THREE from "three";
import "./style.css";

// ============================================================
// I-80 HIGHWAY DRIVING PROTOTYPE
// Three.js browser version
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8db8dc);
scene.fog = new THREE.Fog(0x8db8dc, 90, 420);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.05,
  900
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

document.body.appendChild(renderer.domElement);

// ============================================================
// LIGHTING
// ============================================================

const sun = new THREE.DirectionalLight(0xfff2d5, 3.0);
sun.position.set(-100, 160, 100);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = -180;
sun.shadow.camera.right = 180;
sun.shadow.camera.top = 180;
sun.shadow.camera.bottom = -180;
scene.add(sun);

const ambient = new THREE.HemisphereLight(
  0xbddcff,
  0x4c4237,
  1.7
);
scene.add(ambient);

const fill = new THREE.DirectionalLight(0xffffff, 0.65);
fill.position.set(80, 50, -80);
scene.add(fill);

// ============================================================
// CONSTANTS
// ============================================================

const ROAD_WIDTH = 15.0;
const LANE_WIDTH = 3.75;
const LANES = 4;

const ROAD_HALF = ROAD_WIDTH / 2;

const PLAYER_Z = 0;

const MAX_SPEED = 38;
const ACCELERATION = 10.5;
const BRAKE_FORCE = 25;
const DRAG = 0.42;

const STEERING_RESPONSE = 7.0;

// Faster lane changing.
const LANE_CHANGE_SPEED = 9.5;
const LANE_CHANGE_DISTANCE = 3.55;

const TRAFFIC_COUNT = 32;

const MILE_TO_WORLD = 42;

// ============================================================
// GAME STATE
// ============================================================

let gameOver = false;
let gameTime = 0;
let distance = 0;
let score = 0;

let playerSpeed = 0;

let targetLane = 1;
let playerLaneX = laneToX(targetLane);

let steeringInput = 0;

let speedLimit = 29.0;

let lastTime = performance.now();

const keys: Record<string, boolean> = {};

// ============================================================
// HELPERS
// ============================================================

function laneToX(lane: number): number {
  return -ROAD_HALF + LANE_WIDTH * (lane + 0.5);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function random(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(random(min, max + 1));
}

// ============================================================
// MATERIAL HELPERS
// ============================================================

function mat(
  color: number,
  roughness = 0.7,
  metalness = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

const asphaltMat = mat(0x292b2d, 0.95);
const asphaltDarkMat = mat(0x202224, 1);
const concreteMat = mat(0x858585, 0.9);
const whiteMat = mat(0xf2f2e8, 0.65);
const yellowMat = mat(0xf2c84b, 0.6);
const blackMat = mat(0x101010, 0.85);
const glassMat = new THREE.MeshStandardMaterial({
  color: 0x18384b,
  roughness: 0.12,
  metalness: 0.25,
  transparent: true,
  opacity: 0.72,
});
const chromeMat = mat(0xb8bcc0, 0.18, 0.85);
const rubberMat = mat(0x111111, 1);
const treeMat = mat(0x23572c, 1);
const treeDarkMat = mat(0x153b20, 1);
const trunkMat = mat(0x563d28, 1);

// ============================================================
// ROAD
// ============================================================

const road = new THREE.Mesh(
  new THREE.BoxGeometry(ROAD_WIDTH, 0.12, 900),
  asphaltMat
);

road.position.set(0, -0.08, -300);
road.receiveShadow = true;

scene.add(road);

// Road shoulder left
const leftShoulder = new THREE.Mesh(
  new THREE.BoxGeometry(4, 0.10, 900),
  concreteMat
);

leftShoulder.position.set(-ROAD_HALF - 2, -0.04, -300);
leftShoulder.receiveShadow = true;
scene.add(leftShoulder);

// Road shoulder right
const rightShoulder = new THREE.Mesh(
  new THREE.BoxGeometry(4, 0.10, 900),
  concreteMat
);

rightShoulder.position.set(ROAD_HALF + 2, -0.04, -300);
rightShoulder.receiveShadow = true;
scene.add(rightShoulder);

// ============================================================
// LANE MARKINGS
// ============================================================

const laneMarkers: THREE.Mesh[] = [];

for (let lane = 1; lane < LANES; lane++) {
  const x = -ROAD_HALF + lane * LANE_WIDTH;

  for (let z = 0; z > -900; z -= 12) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.025, 6),
      whiteMat
    );

    marker.position.set(x, 0.015, z);
    scene.add(marker);
    laneMarkers.push(marker);
  }
}

// Yellow left edge line
const yellowLeft = new THREE.Mesh(
  new THREE.BoxGeometry(0.16, 0.025, 900),
  yellowMat
);

yellowLeft.position.set(-ROAD_HALF + 0.2, 0.025, -300);
scene.add(yellowLeft);

// Yellow right-side edge
const yellowRight = new THREE.Mesh(
  new THREE.BoxGeometry(0.16, 0.025, 900),
  yellowMat
);

yellowRight.position.set(ROAD_HALF - 0.2, 0.025, -300);
scene.add(yellowRight);

// ============================================================
// GUARDRAILS
// ============================================================

function createGuardrail(x: number) {
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.8, 900),
    chromeMat
  );

  rail.position.set(x, 0.65, -300);
  rail.castShadow = true;
  scene.add(rail);

  for (let z = 0; z > -900; z -= 8) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.1, 0.12),
      chromeMat
    );

    post.position.set(x, 0.45, z);
    scene.add(post);
  }
}

createGuardrail(-ROAD_HALF - 3.8);
createGuardrail(ROAD_HALF + 3.8);

// ============================================================
// TERRAIN
// ============================================================

const terrain = new THREE.Mesh(
  new THREE.PlaneGeometry(1000, 1000),
  mat(0x526d3c, 1)
);

terrain.rotation.x = -Math.PI / 2;
terrain.position.y = -0.2;
terrain.position.z = -350;

scene.add(terrain);

// ============================================================
// HILLS
// ============================================================

const sceneryObjects: THREE.Object3D[] = [];

function createHill(x: number, z: number, scale: number) {
  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(35, 16, 12),
    mat(randomInt(0x3d633c, 0x597b47), 1)
  );

  hill.scale.set(scale * 1.7, scale, scale * 2.5);
  hill.position.set(x, scale * 12, z);

  scene.add(hill);
  sceneryObjects.push(hill);
}

for (let i = 0; i < 35; i++) {
  createHill(
    random(-130, 130),
    random(-850, 0),
    random(0.8, 2.2)
  );
}

// ============================================================
// TREES
// ============================================================

function createTree(x: number, z: number) {
  const group = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.4, 3.2, 8),
    trunkMat
  );

  trunk.position.y = 1.6;
  group.add(trunk);

  for (let i = 0; i < 3; i++) {
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(
        2.2 - i * 0.35,
        3.5,
        8
      ),
      i % 2 === 0 ? treeMat : treeDarkMat
    );

    crown.position.y = 3.4 + i * 1.45;
    crown.scale.set(1, 1, 1);
    group.add(crown);
  }

  group.position.set(x, 0, z);
  group.scale.setScalar(random(0.75, 1.5));

  scene.add(group);
  sceneryObjects.push(group);
}

for (let i = 0; i < 180; i++) {
  const side = Math.random() < 0.5 ? -1 : 1;

  createTree(
    side * random(13, 80),
    random(-900, 0)
  );
}

// ============================================================
// UTILITY POLES
// ============================================================

function createUtilityPole(x: number, z: number) {
  const group = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.16, 8, 8),
    trunkMat
  );

  pole.position.y = 4;
  group.add(pole);

  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.15, 0.15),
    trunkMat
  );

  crossbar.position.y = 7.5;
  group.add(crossbar);

  for (const side of [-1, 0, 1]) {
    const wire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 2.5, 5),
      blackMat
    );

    wire.rotation.z = Math.PI / 2;
    wire.position.set(side * 1.1, 7.25, 0);
    group.add(wire);
  }

  group.position.set(x, 0, z);

  scene.add(group);
  sceneryObjects.push(group);
}

for (let i = 0; i < 35; i++) {
  createUtilityPole(
    random(25, 75) * (Math.random() > 0.5 ? 1 : -1),
    -i * 28 - random(0, 20)
  );
}

// ============================================================
// OVERPASSES
// ============================================================

function createOverpass(z: number) {
  const group = new THREE.Group();

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(45, 1.8, 5),
    concreteMat
  );

  deck.position.y = 7;
  group.add(deck);

  for (const x of [-15, 15]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(2, 7, 2),
      concreteMat
    );

    pillar.position.set(x, 3.5, 0);
    group.add(pillar);
  }

  group.position.z = z;

  scene.add(group);
  sceneryObjects.push(group);
}

for (let z = -180; z > -900; z -= random(160, 280)) {
  createOverpass(z);
}

// ============================================================
// PLAYER ESCALADE-STYLE SUV
// ============================================================

const player = new THREE.Group();
player.position.set(laneToX(1), 0.42, 0);
scene.add(player);

function createWheel(
  parent: THREE.Object3D,
  x: number,
  z: number
): THREE.Group {
  const wheelGroup = new THREE.Group();

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(0.43, 0.43, 0.30, 20),
    rubberMat
  );

  tire.rotation.z = Math.PI / 2;
  wheelGroup.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.32, 16),
    chromeMat
  );

  rim.rotation.z = Math.PI / 2;
  wheelGroup.add(rim);

  wheelGroup.position.set(x, 0.0, z);

  parent.add(wheelGroup);

  return wheelGroup;
}

// Main body
const body = new THREE.Mesh(
  new THREE.BoxGeometry(3.05, 1.35, 6.0),
  mat(0x151a20, 0.48, 0.25)
);

body.position.y = 0.85;
body.castShadow = true;
player.add(body);

// Hood
const hood = new THREE.Mesh(
  new THREE.BoxGeometry(2.85, 0.32, 1.65),
  mat(0x171c22, 0.45, 0.3)
);

hood.position.set(0, 1.42, -2.25);
hood.castShadow = true;
player.add(hood);

// Roof
const roof = new THREE.Mesh(
  new THREE.BoxGeometry(2.75, 0.38, 3.3),
  mat(0x14191f, 0.45, 0.25)
);

roof.position.set(0, 1.72, 0.25);
player.add(roof);

// Windshield
const windshield = new THREE.Mesh(
  new THREE.BoxGeometry(2.55, 1.15, 0.08),
  glassMat
);

windshield.position.set(0, 1.58, -1.25);
windshield.rotation.x = -0.16;
player.add(windshield);

// Rear glass
const rearGlass = new THREE.Mesh(
  new THREE.BoxGeometry(2.5, 1.0, 0.08),
  glassMat
);

rearGlass.position.set(0, 1.57, 1.9);
rearGlass.rotation.x = 0.12;
player.add(rearGlass);

// Side mirrors
for (const side of [-1, 1]) {
  const mirror = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.35, 0.5),
    chromeMat
  );

  mirror.position.set(side * 1.65, 1.35, -1.05);
  player.add(mirror);
}

// Front bumper
const bumper = new THREE.Mesh(
  new THREE.BoxGeometry(3.1, 0.35, 0.25),
  chromeMat
);

bumper.position.set(0, 0.42, -3.05);
player.add(bumper);

// Rear bumper
const rearBumper = bumper.clone();
rearBumper.position.z = 3.05;
player.add(rearBumper);

// Headlights
for (const side of [-1, 1]) {
  const light = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.25, 0.08),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 1.5,
    })
  );

  light.position.set(side * 0.9, 1.25, -3.04);
  player.add(light);
}

// Wheels
const frontLeftWheel = createWheel(player, -1.55, -1.9);
const frontRightWheel = createWheel(player, 1.55, -1.9);
const rearLeftWheel = createWheel(player, -1.55, 1.9);
const rearRightWheel = createWheel(player, 1.55, 1.9);

// ============================================================
// INTERIOR
// ============================================================

const interior = new THREE.Group();

const dashboard = new THREE.Mesh(
  new THREE.BoxGeometry(2.8, 0.55, 0.95),
  mat(0x171717, 0.85)
);

dashboard.position.set(0, 1.08, -0.75);
interior.add(dashboard);

// Dashboard trim
const dashTrim = new THREE.Mesh(
  new THREE.BoxGeometry(2.4, 0.06, 0.05),
  chromeMat
);

dashTrim.position.set(0, 1.38, -1.2);
interior.add(dashTrim);

// Steering column
const steeringColumn = new THREE.Group();
steeringColumn.position.set(-0.92, 1.34, -0.55);

const steeringWheel = new THREE.Mesh(
  new THREE.TorusGeometry(0.48, 0.075, 10, 32),
  rubberMat
);

steeringWheel.rotation.x = Math.PI / 2;
steeringColumn.add(steeringWheel);

const steeringCenter = new THREE.Mesh(
  new THREE.BoxGeometry(0.32, 0.18, 0.32),
  mat(0x1d1d1d, 0.6)
);

steeringCenter.position.y = -0.02;
steeringColumn.add(steeringCenter);

interior.add(steeringColumn);

// Instrument cluster
const cluster = new THREE.Mesh(
  new THREE.BoxGeometry(1.15, 0.4, 0.08),
  blackMat
);

cluster.position.set(-0.82, 1.42, -1.18);
interior.add(cluster);

// A-pillars
for (const side of [-1, 1]) {
  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 1.8, 0.22),
    blackMat
  );

  pillar.position.set(side * 1.27, 1.65, -1.18);
  pillar.rotation.z = side * 0.08;

  interior.add(pillar);
}

player.add(interior);

// ============================================================
// CAMERA
// ============================================================

// Camera stays rigidly INSIDE the vehicle.
// It follows the vehicle body rather than panning independently.

camera.position.set(0, 2.08, -0.25);
player.add(camera);

camera.rotation.set(0, 0, 0);

// ============================================================
// TRAFFIC VEHICLES
// ============================================================

type TrafficType =
  | "sedan"
  | "suv"
  | "pickup"
  | "van"
  | "semi"
  | "chp";

interface TrafficVehicle {
  group: THREE.Group;
  type: TrafficType;
  lane: number;
  targetLane: number;
  speed: number;
  desiredSpeed: number;
  acceleration: number;
  braking: number;
  laneCooldown: number;
  changeProgress: number;
  targetX: number;
  active: boolean;
}

const traffic: TrafficVehicle[] = [];

const vehicleColors = [
  0xffffff,
  0x101010,
  0x171b21,
  0x444a50,
  0x73777a,
  0xaeb3b5,
  0x263a55,
  0x4b2727,
  0x314d39,
  0x85734f,
  0x6c6c72,
  0xb8b8b8,
  0x8a3030,
  0x253a68,
];

function createTrafficCar(type: TrafficType): THREE.Group {
  const group = new THREE.Group();

  let width = 1.75;
  let height = 1.35;
  let length = 4.1;

  if (type === "suv") {
    width = 1.95;
    height = 1.65;
    length = 4.7;
  }

  if (type === "pickup") {
    width = 1.9;
    height = 1.6;
    length = 5.2;
  }

  if (type === "van") {
    width = 2.0;
    height = 1.9;
    length = 5.0;
  }

  if (type === "semi") {
    width = 2.45;
    height = 3.5;
    length = 12;
  }

  if (type === "chp") {
    width = 1.85;
    height = 1.4;
    length = 4.7;
  }

  const color =
    type === "chp"
      ? 0xffffff
      : vehicleColors[randomInt(0, vehicleColors.length - 1)];

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, length),
    mat(color, 0.5, 0.15)
  );

  body.position.y = height / 2 + 0.25;
  body.castShadow = true;
  group.add(body);

  if (type !== "semi") {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.88, height * 0.42, length * 0.55),
      mat(color, 0.48, 0.15)
    );

    roof.position.set(0, height + 0.35, 0.15);
    group.add(roof);

    const windows = new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.82,
        height * 0.28,
        length * 0.38
      ),
      glassMat
    );

    windows.position.set(0, height + 0.36, -0.1);
    group.add(windows);
  } else {
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(width, 3.0, 3.2),
      mat(0xe1e1e1, 0.55)
    );

    cab.position.set(0, 1.8, -3.5);
    group.add(cab);

    const trailer = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.98, 3.5, 8),
      mat(0xe4e4e0, 0.8)
    );

    trailer.position.set(0, 1.95, 2.1);
    group.add(trailer);

    const trailerStripe = new THREE.Mesh(
      new THREE.BoxGeometry(width * 1.01, 0.12, 7.8),
      mat(0x1b3553)
    );

    trailerStripe.position.set(0, 1.5, 2.1);
    group.add(trailerStripe);
  }

  // Wheels
  const wheelPositions = [-width / 2, width / 2];

  const zPositions =
    type === "semi"
      ? [-4.0, 0.0, 3.8]
      : [-length * 0.32, length * 0.32];

  for (const x of wheelPositions) {
    for (const z of zPositions) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(
          type === "semi" ? 0.55 : 0.38,
          type === "semi" ? 0.55 : 0.38,
          0.28,
          12
        ),
        rubberMat
      );

      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.45, z);
      group.add(wheel);
    }
  }

  // Headlights
  for (const side of [-1, 1]) {
    const headlight = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.16, 0.06),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 1.2,
      })
    );

    headlight.position.set(
      side * width * 0.3,
      0.95,
      -length / 2 - 0.03
    );

    group.add(headlight);
  }

  // CHP light bar
  if (type === "chp") {
    const lightBar = new THREE.Group();

    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.45),
      new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff0000,
        emissiveIntensity: 2,
      })
    );

    red.position.x = -0.25;

    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 0.12, 0.45),
      new THREE.MeshStandardMaterial({
        color: 0x0066ff,
        emissive: 0x0066ff,
        emissiveIntensity: 2,
      })
    );

    blue.position.x = 0.25;

    lightBar.add(red, blue);
    lightBar.position.y = 2.1;

    group.add(lightBar);
  }

  return group;
}

// ============================================================
// CREATE TRAFFIC
// ============================================================

function spawnTraffic(
  vehicle: TrafficVehicle,
  z: number
) {
  vehicle.group.position.set(
    laneToX(vehicle.lane),
    0,
    z
  );

  vehicle.targetX = laneToX(vehicle.lane);
  vehicle.changeProgress = 1;

  vehicle.group.rotation.y = 0;
}

for (let i = 0; i < TRAFFIC_COUNT; i++) {
  const roll = Math.random();

  let type: TrafficType;

  if (roll < 0.45) type = "sedan";
  else if (roll < 0.65) type = "suv";
  else if (roll < 0.8) type = "pickup";
  else if (roll < 0.9) type = "van";
  else type = "semi";

  const lane = randomInt(0, LANES - 1);

  const vehicle: TrafficVehicle = {
    group: createTrafficCar(type),
    type,
    lane,
    targetLane: lane,
    speed:
      type === "semi"
        ? random(17, 25)
        : random(21, 34),
    desiredSpeed:
      type === "semi"
        ? random(20, 25)
        : random(25, 34),
    acceleration:
      type === "semi"
        ? 2.2
        : random(3.0, 5.0),
    braking:
      type === "semi"
        ? 7
        : random(8, 12),
    laneCooldown: random(1, 5),
    changeProgress: 1,
    targetX: laneToX(lane),
    active: true,
  };

  spawnTraffic(vehicle, -random(80, 650));

  scene.add(vehicle.group);
  traffic.push(vehicle);
}

// ============================================================
// TRAFFIC AI
// ============================================================

function getVehicleAhead(
  vehicle: TrafficVehicle
): TrafficVehicle | null {
  let closest: TrafficVehicle | null = null;
  let closestDistance = Infinity;

  for (const other of traffic) {
    if (other === vehicle || !other.active) continue;

    if (
      Math.abs(other.group.position.x - vehicle.group.position.x) <
      LANE_WIDTH * 0.65
    ) {
      const dz =
        other.group.position.z -
        vehicle.group.position.z;

      if (dz < 0 && Math.abs(dz) < closestDistance) {
        closest = other;
        closestDistance = Math.abs(dz);
      }
    }
  }

  return closest;
}

function laneIsSafe(
  vehicle: TrafficVehicle,
  lane: number
): boolean {
  if (lane < 0 || lane >= LANES) return false;

  const desiredX = laneToX(lane);

  for (const other of traffic) {
    if (other === vehicle) continue;

    if (
      Math.abs(other.group.position.x - desiredX) <
      LANE_WIDTH * 0.65
    ) {
      if (
        Math.abs(
          other.group.position.z -
            vehicle.group.position.z
        ) < 22
      ) {
        return false;
      }
    }
  }

  return true;
}

function updateTraffic(
  vehicle: TrafficVehicle,
  dt: number
) {
  const ahead = getVehicleAhead(vehicle);

  let desired = vehicle.desiredSpeed;

  if (ahead) {
    const gap =
      Math.abs(
        ahead.group.position.z -
          vehicle.group.position.z
      );

    if (gap < 30) {
      desired = Math.min(
        desired,
        Math.max(
          5,
          ahead.speed - 2
        )
      );

      if (
        gap < 17 &&
        vehicle.laneCooldown <= 0
      ) {
        const directions = Math.random() < 0.5
          ? [-1, 1]
          : [1, -1];

        for (const direction of directions) {
          const candidate =
            vehicle.lane + direction;

          if (laneIsSafe(vehicle, candidate)) {
            vehicle.targetLane = candidate;
            vehicle.targetX = laneToX(candidate);
            vehicle.changeProgress = 0;
            vehicle.laneCooldown = random(3, 7);
            break;
          }
        }
      }
    }
  }

  vehicle.laneCooldown -= dt;

  if (vehicle.speed < desired) {
    vehicle.speed +=
      vehicle.acceleration * dt;
  } else {
    vehicle.speed -=
      vehicle.braking * 0.3 * dt;
  }

  vehicle.speed = clamp(
    vehicle.speed,
    5,
    vehicle.desiredSpeed + 3
  );

  // Smooth lane transition
  if (vehicle.changeProgress < 1) {
    vehicle.changeProgress +=
      dt * LANE_CHANGE_SPEED / LANE_CHANGE_DISTANCE;

    vehicle.changeProgress =
      clamp(vehicle.changeProgress, 0, 1);

    const startX = laneToX(vehicle.lane);
    const endX = laneToX(vehicle.targetLane);

    const t =
      vehicle.changeProgress *
      vehicle.changeProgress *
      (3 - 2 * vehicle.changeProgress);

    vehicle.group.position.x =
      THREE.MathUtils.lerp(
        startX,
        endX,
        t
      );

    if (vehicle.changeProgress >= 1) {
      vehicle.lane = vehicle.targetLane;
    }
  }

  vehicle.group.position.z +=
    vehicle.speed * dt;

  // Recycle vehicles that pass the player.
  if (vehicle.group.position.z > 80) {
    vehicle.lane = randomInt(0, LANES - 1);
    vehicle.targetLane = vehicle.lane;
    vehicle.speed =
      vehicle.type === "semi"
        ? random(17, 25)
        : random(22, 34);

    vehicle.desiredSpeed =
      vehicle.type === "semi"
        ? random(20, 25)
        : random(25, 34);

    spawnTraffic(
      vehicle,
      -random(450, 750)
    );
  }
}

// ============================================================
// PLAYER INPUT
// ============================================================

window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;

  if (
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "]
      .includes(event.key)
  ) {
    event.preventDefault();
  }

  if (
    gameOver &&
    event.key.toLowerCase() === "r"
  ) {
    restartGame();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

// ============================================================
// STEERING
// ============================================================

function updateSteering(dt: number) {
  let input = 0;

  if (keys["a"] || keys["arrowleft"]) {
    input -= 1;
  }

  if (keys["d"] || keys["arrowright"]) {
    input += 1;
  }

  steeringInput = THREE.MathUtils.damp(
    steeringInput,
    input,
    STEERING_RESPONSE,
    dt
  );

  // Steering directly selects lanes at high responsiveness.
  if (
    Math.abs(steeringInput) > 0.65 &&
    playerSpeed > 2
  ) {
    const direction =
      steeringInput > 0 ? 1 : -1;

    if (
      direction > 0 &&
      targetLane < LANES - 1
    ) {
      targetLane++;
    }

    if (
      direction < 0 &&
      targetLane > 0
    ) {
      targetLane--;
    }

    // Prevent repeating lane changes every frame.
    steeringInput *= 0.15;
  }

  const desiredX = laneToX(targetLane);

  playerLaneX = THREE.MathUtils.damp(
    playerLaneX,
    desiredX,
    LANE_CHANGE_SPEED,
    dt
  );

  player.position.x = playerLaneX;

  // Vehicle body roll.
  player.rotation.z =
    -steeringInput *
    Math.min(
      0.065,
      playerSpeed / MAX_SPEED * 0.09
    );

  // Wheels visually steer.
  const wheelAngle =
    steeringInput * 0.42;

  frontLeftWheel.rotation.y =
    wheelAngle;

  frontRightWheel.rotation.y =
    wheelAngle;

  // Steering wheel rotates.
  steeringWheel.rotation.z =
    -steeringInput * 0.9;
}

// ============================================================
// PLAYER PHYSICS
// ============================================================

function updatePlayerPhysics(dt: number) {
  const accelerating =
    keys["w"] ||
    keys["arrowup"];

  const braking =
    keys["s"] ||
    keys["arrowdown"];

  if (accelerating) {
    playerSpeed +=
      ACCELERATION * dt;
  }

  if (braking) {
    playerSpeed -=
      BRAKE_FORCE * dt;
  }

  if (!accelerating && !braking) {
    playerSpeed -=
      DRAG * dt;
  }

  playerSpeed =
    clamp(playerSpeed, 0, MAX_SPEED);

  // Speed-dependent steering.
  const steeringEffect =
    steeringInput *
    (0.015 +
      playerSpeed / MAX_SPEED * 0.03);

  player.rotation.y =
    THREE.MathUtils.damp(
      player.rotation.y,
      steeringEffect,
      5,
      dt
    );

  // Suspension movement.
  const suspension =
    Math.sin(gameTime * 11) *
    playerSpeed /
    MAX_SPEED *
    0.012;

  player.position.y =
    0.42 + suspension;
}

// ============================================================
// COLLISIONS
// ============================================================

function checkCollisions() {
  const playerBox = new THREE.Box3().setFromObject(
    player
  );

  playerBox.expandByScalar(-0.25);

  for (const vehicle of traffic) {
    const trafficBox =
      new THREE.Box3().setFromObject(
        vehicle.group
      );

    trafficBox.expandByScalar(-0.15);

    if (
      playerBox.intersectsBox(trafficBox)
    ) {
      endGame(
        playerSpeed > 28
          ? "SEVERE CRASH"
          : "COLLISION"
      );

      return;
    }
  }
}

// ============================================================
// CAMERA EFFECTS
// ============================================================

function updateCamera(dt: number) {
  // Camera remains attached to player.
  // Only tiny suspension movement is allowed.

  const speedFactor =
    playerSpeed / MAX_SPEED;

  const vibration =
    Math.sin(gameTime * 31) *
    0.0025 *
    speedFactor;

  camera.position.x =
    vibration;

  camera.position.y =
    2.08 +
    Math.sin(gameTime * 8) *
      0.004 *
      speedFactor;

  // Never allow steering to rotate the camera.
  camera.rotation.x = 0;
  camera.rotation.y = 0;
  camera.rotation.z = 0;
}

// ============================================================
// DISTANCE / SCORE
// ============================================================

function updateScore(dt: number) {
  distance +=
    playerSpeed *
    dt /
    MILE_TO_WORLD;

  const mph =
    playerSpeed * 2.237;

  const speedReward =
    Math.max(
      0,
      mph - 45
    );

  const speedBonus =
    speedReward * 0.65;

  const safeDrivingBonus =
    playerSpeed >= 20 &&
    playerSpeed <= 34
      ? 2
      : 0;

  score +=
    dt *
    (
      8 +
      speedBonus +
      safeDrivingBonus
    );
}

// ============================================================
// HIGHWAY MOTION
// ============================================================

function updateWorldMotion(dt: number) {
  const worldSpeed = playerSpeed;

  // Lane markers move toward the player.
  for (const marker of laneMarkers) {
    marker.position.z +=
      worldSpeed * dt;

    if (marker.position.z > 20) {
      marker.position.z -= 900;
    }
  }

  // Terrain illusion.
  // Scenery objects recycle toward the horizon.
  for (const object of sceneryObjects) {
    object.position.z +=
      worldSpeed * dt;

    if (object.position.z > 80) {
      object.position.z -= random(650, 900);
    }
  }

  // Long road pieces remain visually continuous.
  road.position.z +=
    worldSpeed * dt;

  if (road.position.z > 0) {
    road.position.z -= 900;
  }

  leftShoulder.position.z +=
    worldSpeed * dt;

  rightShoulder.position.z +=
    worldSpeed * dt;

  yellowLeft.position.z +=
    worldSpeed * dt;

  yellowRight.position.z +=
    worldSpeed * dt;

  if (leftShoulder.position.z > 0) {
    leftShoulder.position.z -= 900;
    rightShoulder.position.z -= 900;
    yellowLeft.position.z -= 900;
    yellowRight.position.z -= 900;
  }

  // Traffic moves relative to the player's motion.
  for (const vehicle of traffic) {
    vehicle.group.position.z +=
      (vehicle.speed - worldSpeed) *
      dt;

    updateTrafficRelative(vehicle, dt);
  }
}

// ============================================================
// TRAFFIC RELATIVE MOTION
// ============================================================

function updateTrafficRelative(
  vehicle: TrafficVehicle,
  dt: number
) {
  const ahead = getVehicleAhead(vehicle);

  let desired =
    vehicle.desiredSpeed;

  if (ahead) {
    const gap =
      Math.abs(
        ahead.group.position.z -
          vehicle.group.position.z
      );

    if (gap < 20) {
      desired =
        Math.min(
          desired,
          ahead.speed
        );
    }
  }

  if (vehicle.speed < desired) {
    vehicle.speed +=
      vehicle.acceleration *
      dt;
  } else {
    vehicle.speed -=
      vehicle.braking *
      0.25 *
      dt;
  }

  vehicle.speed =
    clamp(
      vehicle.speed,
      5,
      vehicle.desiredSpeed + 2
    );

  vehicle.laneCooldown -= dt;

  if (
    vehicle.laneCooldown <= 0 &&
    Math.random() < 0.004
  ) {
    const direction =
      Math.random() < 0.5
        ? -1
        : 1;

    const candidate =
      vehicle.lane + direction;

    if (
      laneIsSafe(
        vehicle,
        candidate
      )
    ) {
      vehicle.targetLane =
        candidate;

      vehicle.targetX =
        laneToX(candidate);

      vehicle.changeProgress = 0;

      vehicle.laneCooldown =
        random(4, 8);
    }
  }

  if (
    vehicle.changeProgress < 1
  ) {
    vehicle.changeProgress +=
      dt *
      LANE_CHANGE_SPEED /
      LANE_CHANGE_DISTANCE;

    const start =
      laneToX(vehicle.lane);

    const end =
      laneToX(vehicle.targetLane);

    const t =
      vehicle.changeProgress;

    const smooth =
      t * t * (3 - 2 * t);

    vehicle.group.position.x =
      THREE.MathUtils.lerp(
        start,
        end,
        smooth
      );

    if (
      vehicle.changeProgress >= 1
    ) {
      vehicle.lane =
        vehicle.targetLane;
    }
  }

  // Recycle traffic far behind.
  if (
    vehicle.group.position.z >
    70
  ) {
    vehicle.lane =
      randomInt(0, LANES - 1);

    vehicle.targetLane =
      vehicle.lane;

    vehicle.group.position.x =
      laneToX(vehicle.lane);

    vehicle.group.position.z =
      -random(400, 750);

    vehicle.speed =
      vehicle.type === "semi"
        ? random(17, 25)
        : random(22, 34);
  }
}

// ============================================================
// HUD
// ============================================================

let speedText: HTMLElement;
let distanceText: HTMLElement;
let timeText: HTMLElement;
let scoreText: HTMLElement;
let limitText: HTMLElement;
let chpText: HTMLElement;
let gameOverPanel: HTMLElement;

function createHUD() {
  const hud = document.createElement("div");

  hud.style.position = "fixed";
  hud.style.top = "20px";
  hud.style.left = "20px";
  hud.style.color = "white";
  hud.style.fontFamily =
    "Arial, Helvetica, sans-serif";
  hud.style.fontWeight = "700";
  hud.style.textShadow =
    "0 2px 5px #000";
  hud.style.zIndex = "20";
  hud.style.pointerEvents = "none";

  hud.innerHTML = `
    <div style="font-size:13px;color:#bbb">SPEED</div>
    <div id="speed" style="font-size:28px">0 MPH</div>

    <div style="margin-top:8px;font-size:13px;color:#bbb">LIMIT</div>
    <div id="limit" style="font-size:20px">65</div>

    <div style="margin-top:8px;font-size:13px;color:#bbb">DISTANCE</div>
    <div id="distance" style="font-size:20px">0.00 MI</div>

    <div style="margin-top:8px;font-size:13px;color:#bbb">TIME</div>
    <div id="time" style="font-size:20px">00:00</div>

    <div style="margin-top:8px;font-size:13px;color:#bbb">SCORE</div>
    <div id="score" style="font-size:20px">0</div>

    <div style="margin-top:8px;font-size:13px;color:#bbb">CHP</div>
    <div id="chp" style="font-size:20px;color:#77dd77">NORMAL</div>
  `;

  document.body.appendChild(hud);

  speedText =
    document.getElementById("speed")!;

  limitText =
    document.getElementById("limit")!;

  distanceText =
    document.getElementById("distance")!;

  timeText =
    document.getElementById("time")!;

  scoreText =
    document.getElementById("score")!;

  chpText =
    document.getElementById("chp")!;
}

function updateHUD() {
  const mph =
    Math.round(playerSpeed * 2.237);

  speedText.textContent =
    `${mph} MPH`;

  limitText.textContent =
    "65";

  distanceText.textContent =
    `${distance.toFixed(2)} MI`;

  const minutes =
    Math.floor(gameTime / 60);

  const seconds =
    Math.floor(gameTime % 60);

  timeText.textContent =
    `${String(minutes).padStart(2, "0")}:${String(
      seconds
    ).padStart(2, "0")}`;

  scoreText.textContent =
    Math.floor(score).toLocaleString();
}

// ============================================================
// GAME OVER
// ============================================================

function endGame(reason: string) {
  if (gameOver) return;

  gameOver = true;

  gameOverPanel.style.display =
    "flex";

  gameOverPanel.innerHTML = `
    <div style="
      background:rgba(5,8,12,.94);
      border:1px solid #555;
      border-radius:14px;
      padding:34px;
      width:min(420px,85vw);
      text-align:center;
      color:white;
      font-family:Arial,Helvetica,sans-serif;
      box-shadow:0 20px 80px rgba(0,0,0,.6);
    ">
      <div style="
        font-size:13px;
        letter-spacing:3px;
        color:#aaa;
        margin-bottom:10px;
      ">
        RUN ENDED
      </div>

      <div style="
        font-size:32px;
        font-weight:800;
        color:#ff5a5a;
        margin-bottom:24px;
      ">
        ${reason}
      </div>

      <div style="margin:8px">
        Distance: ${distance.toFixed(2)} mi
      </div>

      <div style="margin:8px">
        Survival: ${Math.floor(gameTime)} sec
      </div>

      <div style="margin:8px">
        Score: ${Math.floor(score).toLocaleString()}
      </div>

      <button id="restartButton" style="
        margin-top:24px;
        width:100%;
        padding:14px;
        border:none;
        border-radius:8px;
        background:#e9e9e9;
        color:#111;
        font-size:16px;
        font-weight:700;
        cursor:pointer;
      ">
        RESTART
      </button>

      <div style="
        margin-top:12px;
        color:#888;
        font-size:12px;
      ">
        Press R to restart
      </div>
    </div>
  `;

  document
    .getElementById("restartButton")
    ?.addEventListener(
      "click",
      restartGame
    );
}

// ============================================================
// RESTART
// ============================================================

function restartGame() {
  gameOver = false;
  gameTime = 0;
  distance = 0;
  score = 0;

  playerSpeed = 0;

  targetLane = 1;
  playerLaneX =
    laneToX(targetLane);

  player.position.set(
    playerLaneX,
    0.42,
    0
  );

  player.rotation.set(
    0,
    0,
    0
  );

  for (const vehicle of traffic) {
    vehicle.lane =
      randomInt(0, LANES - 1);

    vehicle.targetLane =
      vehicle.lane;

    vehicle.changeProgress = 1;

    vehicle.group.position.x =
      laneToX(vehicle.lane);

    vehicle.group.position.z =
      -random(100, 700);

    vehicle.speed =
      vehicle.type === "semi"
        ? random(17, 25)
        : random(22, 34);
  }

  gameOverPanel.style.display =
    "none";

  updateHUD();
}

// ============================================================
// GAME OVER PANEL
// ============================================================

gameOverPanel =
  document.createElement("div");

gameOverPanel.style.position =
  "fixed";

gameOverPanel.style.inset = "0";

gameOverPanel.style.display =
  "none";

gameOverPanel.style.alignItems =
  "center";

gameOverPanel.style.justifyContent =
  "center";

gameOverPanel.style.background =
  "rgba(0,0,0,.35)";

gameOverPanel.style.zIndex =
  "100";

document.body.appendChild(
  gameOverPanel
);

createHUD();

// ============================================================
// MAIN LOOP
// ============================================================

function animate(now: number) {
  requestAnimationFrame(animate);

  let dt =
    (now - lastTime) / 1000;

  lastTime = now;

  dt =
    Math.min(dt, 0.05);

  if (!gameOver) {
    gameTime += dt;

    updatePlayerPhysics(dt);
    updateSteering(dt);

    // Move the entire highway environment
    // toward the player to create forward motion.
    updateWorldMotion(dt);

    // Update traffic AI.
    for (const vehicle of traffic) {
      updateTraffic(vehicle, dt);
    }

    checkCollisions();

    updateScore(dt);
    updateHUD();
  }

  updateCamera(dt);

  renderer.render(
    scene,
    camera
  );
}

requestAnimationFrame(animate);

// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
  "resize",
  () => {
    camera.aspect =
      window.innerWidth /
      window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(
      window.innerWidth,
      window.innerHeight
    );

    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio,
        2
      )
    );
  }
);
