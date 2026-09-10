import * as THREE from "three";
import "./style.css";

/*
 I-80 HIGHWAY DRIVING PROTOTYPE
 --------------------------------
 Browser game using:
 - Three.js
 - TypeScript
 - Vite
 - No external 3D vehicle assets
 - No Rapier dependency

 The player remains seated inside the vehicle.
 The world moves around the player to create a convincing
 highway-speed sensation.

 This is intentionally procedural so the project can later
 replace individual procedural vehicles/environment objects
 with properly licensed models.
*/

// ============================================================
// TYPES
// ============================================================

type TrafficKind =
  | "sedan"
  | "suv"
  | "pickup"
  | "van"
  | "minivan"
  | "boxTruck"
  | "semi"
  | "bus"
  | "chp";

type GameState = "playing" | "stopped" | "gameover";

interface TrafficVehicle {
  group: THREE.Group;
  kind: TrafficKind;

  lane: number;
  targetLane: number;

  speed: number;
  desiredSpeed: number;

  length: number;
  width: number;
  height: number;

  laneChangeTimer: number;
  signalTimer: number;
  signalDirection: number;

  color: number;

  active: boolean;
  oncoming: boolean;

  wheels: THREE.Mesh[];
}

interface WorldObject {
  object: THREE.Object3D;
  z: number;
  type: string;
}

interface Segment {
  group: THREE.Group;
  z: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const ROAD_WIDTH = 15.2;
const LANE_WIDTH = ROAD_WIDTH / 4;

const LANES = 4;

const PLAYER_LENGTH = 5.3;
const PLAYER_WIDTH = 2.05;

const INITIAL_SPEED_MPH = 65;

const MPH_TO_MS = 0.44704;
const MS_TO_MPH = 2.236936;

const WORLD_SCALE = 1.0;

const PLAYER_MAX_SPEED = 125;

const ROAD_LENGTH = 120;

const SEGMENT_COUNT = 12;

const TRAFFIC_COUNT = 42;

const WORLD_OBJECT_COUNT = 110;

const MAX_Z = 430;
const MIN_Z = -65;

const SHOULDER_WIDTH = 3.2;

// ============================================================
// RENDERER / SCENE
// ============================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x8db9dc);

scene.fog = new THREE.Fog(
  0x8db9dc,
  130,
  560
);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.03,
  900
);

camera.position.set(
  0,
  1.42,
  0.35
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance"
});

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 1.75)
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

renderer.outputColorSpace = THREE.SRGBColorSpace;

document.body.appendChild(renderer.domElement);

// ============================================================
// LIGHTING
// ============================================================

const hemisphereLight = new THREE.HemisphereLight(
  0xd9edff,
  0x59634d,
  2.0
);

scene.add(hemisphereLight);

const sun = new THREE.DirectionalLight(
  0xfff2d1,
  3.2
);

sun.position.set(
  -80,
  130,
  80
);

sun.castShadow = true;

sun.shadow.mapSize.width = 1024;
sun.shadow.mapSize.height = 1024;

sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;

scene.add(sun);

// ============================================================
// MATERIAL HELPERS
// ============================================================

function material(
  color: number,
  roughness = 0.8,
  metalness = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness
  });
}

const roadMaterial = material(
  0x35383b,
  0.96
);

const shoulderMaterial = material(
  0x777873,
  1
);

const grassMaterial = material(
  0x536b45,
  1
);

const hillMaterial = material(
  0x64734e,
  1
);

const concreteMaterial = material(
  0x8d9190,
  0.9
);

const whiteMaterial = material(
  0xf2f0df,
  0.7
);

const yellowMaterial = material(
  0xe5c438,
  0.75
);

const blackMaterial = material(
  0x080909,
  0.9
);

const glassMaterial = new THREE.MeshStandardMaterial({
  color: 0x101b25,
  roughness: 0.1,
  metalness: 0.05,
  transparent: true,
  opacity: 0.65
});

const chromeMaterial = material(
  0xaeb5b7,
  0.25,
  0.85
);

// ============================================================
// GAME STATE
// ============================================================

let gameState: GameState = "playing";

let speed = INITIAL_SPEED_MPH;

let playerX = 0;

let playerHeading = 0;

let steering = 0;

let targetSteering = 0;

let throttle = 0;

let brake = 0;

let distanceMiles = 0;

let survivalTime = 0;

let score = 0;

let chpAttention = 0;

let speedLimit = 65;

let crashReason = "";

let stopTimer = 0;

let cameraRoll = 0;

let cameraBob = 0;

let worldDistance = 0;

// ============================================================
// INPUT
// ============================================================

const keys = new Set<string>();

let leftSignal = false;
let rightSignal = false;

window.addEventListener(
  "keydown",
  (event) => {
    keys.add(event.key.toLowerCase());

    if (
      [
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " "
      ].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
    }

    if (event.key.toLowerCase() === "q") {
      leftSignal = !leftSignal;
      rightSignal = false;
    }

    if (event.key.toLowerCase() === "e") {
      rightSignal = !rightSignal;
      leftSignal = false;
    }

    if (
      event.key.toLowerCase() === "r" &&
      gameState === "gameover"
    ) {
      restartGame();
    }

    if (
      event.key === "Escape" &&
      gameState === "playing"
    ) {
      gameState = "stopped";
    } else if (
      event.key === "Escape" &&
      gameState === "stopped"
    ) {
      gameState = "playing";
    }
  }
);

window.addEventListener(
  "keyup",
  (event) => {
    keys.delete(event.key.toLowerCase());
  }
);

function keyDown(...names: string[]): boolean {
  return names.some((name) =>
    keys.has(name.toLowerCase())
  );
}

// ============================================================
// PLAYER VEHICLE
// ============================================================

const playerVehicle = new THREE.Group();

playerVehicle.position.set(
  0,
  0,
  0
);

scene.add(playerVehicle);

const playerVisual = new THREE.Group();

playerVehicle.add(playerVisual);

// ------------------------------------------------------------
// Player exterior hood
// ------------------------------------------------------------

const hood = new THREE.Mesh(
  new THREE.BoxGeometry(
    2.0,
    0.32,
    1.7
  ),
  material(0x18242b, 0.35, 0.45)
);

hood.position.set(
  0,
  0.96,
  -1.45
);

hood.castShadow = true;

playerVisual.add(hood);

// ------------------------------------------------------------
// Hood center crease
// ------------------------------------------------------------

const hoodCrease = new THREE.Mesh(
  new THREE.BoxGeometry(
    0.035,
    0.025,
    1.5
  ),
  chromeMaterial
);

hoodCrease.position.set(
  0,
  1.13,
  -1.45
);

playerVisual.add(hoodCrease);

// ------------------------------------------------------------
// Dashboard
// ------------------------------------------------------------

const dashboard = new THREE.Mesh(
  new THREE.BoxGeometry(
    2.15,
    0.32,
    0.75
  ),
  material(0x151719, 0.82)
);

dashboard.position.set(
  0,
  1.12,
  0.12
);

playerVisual.add(dashboard);

// ------------------------------------------------------------
// Dashboard upper trim
// ------------------------------------------------------------

const dashboardTrim = new THREE.Mesh(
  new THREE.BoxGeometry(
    2.0,
    0.07,
    0.05
  ),
  chromeMaterial
);

dashboardTrim.position.set(
  0,
  1.30,
  -0.08
);

playerVisual.add(dashboardTrim);

// ------------------------------------------------------------
// Windshield
// ------------------------------------------------------------

const windshield = new THREE.Mesh(
  new THREE.BoxGeometry(
    2.1,
    1.12,
    0.045
  ),
  glassMaterial
);

windshield.position.set(
  0,
  1.63,
  -0.58
);

windshield.rotation.x = -0.13;

playerVisual.add(windshield);

// ------------------------------------------------------------
// A-pillars
// ------------------------------------------------------------

const leftPillar = new THREE.Mesh(
  new THREE.BoxGeometry(
    0.09,
    1.35,
    0.09
  ),
  blackMaterial
);

leftPillar.position.set(
  -1.02,
  1.58,
  -0.57
);

leftPillar.rotation.z = -0.14;

playerVisual.add(leftPillar);

const rightPillar = leftPillar.clone();

rightPillar.position.x = 1.02;
rightPillar.rotation.z = 0.14;

playerVisual.add(rightPillar);

// ------------------------------------------------------------
// Roof
// ------------------------------------------------------------

const roof = new THREE.Mesh(
  new THREE.BoxGeometry(
    2.05,
    0.12,
    1.45
  ),
  material(0x121517, 0.75)
);

roof.position.set(
  0,
  2.35,
  0.0
);

playerVisual.add(roof);

// ------------------------------------------------------------
// Steering wheel
// ------------------------------------------------------------

const steeringWheel = new THREE.Mesh(
  new THREE.TorusGeometry(
    0.24,
    0.045,
    12,
    32
  ),
  blackMaterial
);

steeringWheel.position.set(
  -0.45,
  1.20,
  -0.02
);

steeringWheel.rotation.x =
  Math.PI / 2;

playerVisual.add(steeringWheel);

const steeringHub = new THREE.Mesh(
  new THREE.CylinderGeometry(
    0.09,
    0.09,
    0.05,
    16
  ),
  chromeMaterial
);

steeringHub.rotation.z =
  Math.PI / 2;

steeringHub.position.copy(
  steeringWheel.position
);

playerVisual.add(steeringHub);

// ------------------------------------------------------------
// Instrument cluster
// ------------------------------------------------------------

const instrumentPanel = new THREE.Mesh(
  new THREE.BoxGeometry(
    0.62,
    0.28,
    0.05
  ),
  blackMaterial
);

instrumentPanel.position.set(
  -0.44,
  1.38,
  -0.12
);

playerVisual.add(instrumentPanel);

// ------------------------------------------------------------
// Seats
// ------------------------------------------------------------

function createSeat(
  x: number
): THREE.Group {
  const seat = new THREE.Group();

  const cushion = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.72,
      0.22,
      0.72
    ),
    material(0x25282a, 0.95)
  );

  cushion.position.y = 0.72;

  seat.add(cushion);

  const back = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.72,
      0.9,
      0.22
    ),
    material(0x202325, 0.95)
  );

  back.position.set(
    0,
    1.05,
    0.30
  );

  seat.add(back);

  seat.position.x = x;

  return seat;
}

playerVisual.add(
  createSeat(-0.55)
);

playerVisual.add(
  createSeat(0.55)
);

// ------------------------------------------------------------
// Side mirror housings
// ------------------------------------------------------------

function createMirror(x: number): THREE.Group {
  const mirror = new THREE.Group();

  const stalk = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.08,
      0.08,
      0.4
    ),
    blackMaterial
  );

  stalk.position.z = -0.3;

  mirror.add(stalk);

  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.34,
      0.22,
      0.07
    ),
    glassMaterial
  );

  glass.position.set(
    0,
    0.02,
    -0.52
  );

  mirror.add(glass);

  mirror.position.set(
    x,
    1.35,
    0.02
  );

  return mirror;
}

playerVisual.add(
  createMirror(-1.18)
);

playerVisual.add(
  createMirror(1.18)
);

// ============================================================
// HIGHWAY
// ============================================================

const highway = new THREE.Group();

scene.add(highway);

const roadSegments: Segment[] = [];

function createRoadSegment(
  index: number
): Segment {
  const group = new THREE.Group();

  const z =
    20 -
    index * ROAD_LENGTH;

  group.position.z = z;

  // Main road
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(
      ROAD_WIDTH,
      ROAD_LENGTH
    ),
    roadMaterial
  );

  road.rotation.x = -Math.PI / 2;

  road.position.y = 0;

  road.receiveShadow = true;

  group.add(road);

  // Left shoulder
  const leftShoulder = new THREE.Mesh(
    new THREE.PlaneGeometry(
      SHOULDER_WIDTH,
      ROAD_LENGTH
    ),
    shoulderMaterial
  );

  leftShoulder.rotation.x =
    -Math.PI / 2;

  leftShoulder.position.set(
    -(ROAD_WIDTH / 2) -
      SHOULDER_WIDTH / 2,
    0.005,
    0
  );

  group.add(leftShoulder);

  // Right shoulder
  const rightShoulder =
    leftShoulder.clone();

  rightShoulder.position.x =
    ROAD_WIDTH / 2 +
    SHOULDER_WIDTH / 2;

  group.add(rightShoulder);

  // Grass
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(
      75,
      ROAD_LENGTH
    ),
    grassMaterial
  );

  grass.rotation.x =
    -Math.PI / 2;

  grass.position.y = -0.015;

  group.add(grass);

  // Lane markings
  for (
    let lane = 1;
    lane < LANES;
    lane++
  ) {
    const x =
      -ROAD_WIDTH / 2 +
      lane * LANE_WIDTH;

    for (
      let mark = -50;
      mark < 60;
      mark += 11
    ) {
      const marking = new THREE.Mesh(
        new THREE.BoxGeometry(
          0.12,
          0.025,
          5.0
        ),
        whiteMaterial
      );

      marking.position.set(
        x,
        0.025,
        mark
      );

      group.add(marking);
    }
  }

  // Yellow left edge
  const yellowLeft = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.13,
      0.025,
      ROAD_LENGTH
    ),
    yellowMaterial
  );

  yellowLeft.position.set(
    -ROAD_WIDTH / 2 + 0.18,
    0.03,
    0
  );

  group.add(yellowLeft);

  // White right edge
  const whiteRight = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.13,
      0.025,
      ROAD_LENGTH
    ),
    whiteMaterial
  );

  whiteRight.position.set(
    ROAD_WIDTH / 2 - 0.18,
    0.03,
    0
  );

  group.add(whiteRight);

  // Concrete barrier
  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.42,
      0.85,
      ROAD_LENGTH
    ),
    concreteMaterial
  );

  barrier.position.set(
    -ROAD_WIDTH / 2 -
      SHOULDER_WIDTH -
      0.25,
    0.42,
    0
  );

  group.add(barrier);

  // Right guardrail
  const guardrail = createGuardrail();

  guardrail.position.x =
    ROAD_WIDTH / 2 +
    SHOULDER_WIDTH -
    0.15;

  group.add(guardrail);

  highway.add(group);

  return {
    group,
    z
  };
}

function createGuardrail(): THREE.Group {
  const rail = new THREE.Group();

  const horizontal = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.12,
      0.14,
      ROAD_LENGTH
    ),
    chromeMaterial
  );

  horizontal.position.y = 0.62;

  rail.add(horizontal);

  const horizontal2 =
    horizontal.clone();

  horizontal2.position.y = 0.35;

  rail.add(horizontal2);

  for (
    let z = -55;
    z < 60;
    z += 8
  ) {
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.10,
        0.75,
        0.10
      ),
      chromeMaterial
    );

    post.position.set(
      0,
      0.35,
      z
    );

    rail.add(post);
  }

  return rail;
}

for (
  let i = 0;
  i < SEGMENT_COUNT;
  i++
) {
  roadSegments.push(
    createRoadSegment(i)
  );
}

// ============================================================
// PROCEDURAL ENVIRONMENT
// ============================================================

const environmentObjects: WorldObject[] = [];

function randomRange(
  min: number,
  max: number
): number {
  return (
    min +
    Math.random() *
      (max - min)
  );
}

function createTree(): THREE.Group {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.10,
      0.18,
      2.0,
      7
    ),
    material(0x55402b, 1)
  );

  trunk.position.y = 1;

  tree.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(
      randomRange(1.0, 1.6),
      randomRange(3.0, 4.6),
      8
    ),
    material(
      Math.random() > 0.5
        ? 0x31573a
        : 0x416744,
      1
    )
  );

  foliage.position.y =
    randomRange(3.0, 3.7);

  tree.add(foliage);

  return tree;
}

function createBush(): THREE.Group {
  const bush = new THREE.Group();

  for (
    let i = 0;
    i < 5;
    i++
  ) {
    const blob = new THREE.Mesh(
      new THREE.SphereGeometry(
        randomRange(
          0.35,
          0.75
        ),
        7,
        6
      ),
      material(0x38593c, 1)
    );

    blob.position.set(
      randomRange(-0.6, 0.6),
      randomRange(0.3, 0.7),
      randomRange(-0.4, 0.4)
    );

    bush.add(blob);
  }

  return bush;
}

function createUtilityPole(): THREE.Group {
  const pole = new THREE.Group();

  const post = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.09,
      0.13,
      8,
      7
    ),
    material(0x4d4438, 1)
  );

  post.position.y = 4;

  pole.add(post);

  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(
      2.5,
      0.09,
      0.09
    ),
    material(0x443b31, 1)
  );

  crossbar.position.y = 7.4;

  pole.add(crossbar);

  for (
    let x = -1;
    x <= 1;
    x++
  ) {
    const insulator =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.06,
          0.06,
          0.22,
          6
        ),
        whiteMaterial
      );

    insulator.position.set(
      x,
      7.55,
      0
    );

    pole.add(insulator);
  }

  return pole;
}

function createBuilding(): THREE.Group {
  const building = new THREE.Group();

  const width =
    randomRange(4, 12);

  const height =
    randomRange(4, 13);

  const depth =
    randomRange(5, 15);

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      width,
      height,
      depth
    ),
    material(
      Math.random() > 0.5
        ? 0x8a8071
        : 0x6e7779,
      0.95
    )
  );

  body.position.y =
    height / 2;

  building.add(body);

  // Windows
  const rows =
    Math.max(
      1,
      Math.floor(height / 2)
    );

  const columns =
    Math.max(
      1,
      Math.floor(width / 2)
    );

  for (
    let row = 0;
    row < rows;
    row++
  ) {
    for (
      let col = 0;
      col < columns;
      col++
    ) {
      const windowMesh =
        new THREE.Mesh(
          new THREE.BoxGeometry(
            0.28,
            0.42,
            0.03
          ),
          new THREE.MeshStandardMaterial({
            color:
              Math.random() > 0.25
                ? 0x8eb3bd
                : 0x3e4749,
            roughness: 0.3,
            metalness: 0.1
          })
        );

      windowMesh.position.set(
        -width / 2 +
          0.8 +
          col * 1.7,
        1.0 +
          row * 1.6,
        -depth / 2 -
          0.02
      );

      building.add(
        windowMesh
      );
    }
  }

  return building;
}

function createHill(): THREE.Group {
  const hill = new THREE.Group();

  const size =
    randomRange(22, 48);

  const height =
    randomRange(12, 34);

  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(
      size,
      height,
      12
    ),
    hillMaterial
  );

  mesh.position.y =
    height / 2 -
    1;

  hill.add(mesh);

  return hill;
}

function createHighwaySign(): THREE.Group {
  const sign = new THREE.Group();

  const post1 = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.13,
      4.5,
      0.13
    ),
    chromeMaterial
  );

  post1.position.set(
    -2.5,
    2.25,
    0
  );

  sign.add(post1);

  const post2 = post1.clone();

  post2.position.x = 2.5;

  sign.add(post2);

  const panel = new THREE.Mesh(
    new THREE.BoxGeometry(
      5.3,
      1.9,
      0.08
    ),
    material(
      Math.random() > 0.5
        ? 0x165d34
        : 0x17613a,
      0.65
    )
  );

  panel.position.y = 4.1;

  sign.add(panel);

  // White route-shield-like shape
  const shield = new THREE.Mesh(
    new THREE.BoxGeometry(
      0.85,
      0.65,
      0.10
    ),
    whiteMaterial
  );

  shield.position.set(
    -1.55,
    4.1,
    -0.06
  );

  sign.add(shield);

  return sign;
}

function createOverpass(): THREE.Group {
  const overpass = new THREE.Group();

  const deck = new THREE.Mesh(
    new THREE.BoxGeometry(
      35,
      0.7,
      4.8
    ),
    concreteMaterial
  );

  deck.position.y = 7.2;

  overpass.add(deck);

  for (
    let x = -13;
    x <= 13;
    x += 8
  ) {
    const support =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.75,
          7,
          0.75
        ),
        concreteMaterial
      );

    support.position.set(
      x,
      3.5,
      0
    );

    overpass.add(support);
  }

  return overpass;
}

function spawnEnvironmentObject(
  z: number
): void {
  const side =
    Math.random() > 0.5
      ? 1
      : -1;

  const roll = Math.random();

  let object:
    | THREE.Group
    | undefined;

  let x =
    side *
    randomRange(
      ROAD_WIDTH / 2 +
        SHOULDER_WIDTH +
        4,
      48
    );

  if (roll < 0.46) {
    object = createTree();
  } else if (roll < 0.62) {
    object = createBush();
  } else if (roll < 0.72) {
    object =
      createUtilityPole();
    x =
      side *
      randomRange(
        ROAD_WIDTH / 2 +
          10,
        42
      );
  } else if (roll < 0.82) {
    object =
      createBuilding();
    x =
      side *
      randomRange(
        ROAD_WIDTH / 2 +
          12,
        44
      );
  } else if (roll < 0.92) {
    object = createHill();
    x =
      side *
      randomRange(
        ROAD_WIDTH / 2 +
          18,
        60
      );
  } else {
    object =
      createHighwaySign();

    x =
      side *
      (
        ROAD_WIDTH / 2 +
        randomRange(2.0, 4.0)
      );
  }

  object.position.set(
    x,
    0,
    z
  );

  object.rotation.y =
    randomRange(
      -0.2,
      0.2
    );

  scene.add(object);

  environmentObjects.push({
    object,
    z,
    type: "environment"
  });
}

for (
  let i = 0;
  i < WORLD_OBJECT_COUNT;
  i++
) {
  spawnEnvironmentObject(
    randomRange(
      MIN_Z,
      MAX_Z
    )
  );
}

// ============================================================
// TRAFFIC VEHICLE CREATION
// ============================================================

const trafficVehicles: TrafficVehicle[] = [];

const vehicleColors = [
  0xffffff,
  0x15191c,
  0x283b58,
  0x5c6062,
  0x9b9b96,
  0x7d2522,
  0x354f39,
  0x8b7254,
  0xeeeeea,
  0x2b2b2c,
  0x334e6f,
  0x6d6d6d,
  0x5a2425,
  0x3f4444,
  0x777064
];

function randomTrafficKind():
  TrafficKind {
  const r = Math.random();

  if (r < 0.31)
    return "sedan";

  if (r < 0.49)
    return "suv";

  if (r < 0.62)
    return "pickup";

  if (r < 0.70)
    return "minivan";

  if (r < 0.77)
    return "van";

  if (r < 0.87)
    return "semi";

  if (r < 0.93)
    return "boxTruck";

  if (r < 0.97)
    return "bus";

  return "chp";
}

function createTrafficVehicle(
  kind: TrafficKind,
  oncoming: boolean
): TrafficVehicle {
  const group =
    new THREE.Group();

  const color =
    vehicleColors[
      Math.floor(
        Math.random() *
          vehicleColors.length
      )
    ];

  let width = 1.85;
  let height = 1.45;
  let length = 4.5;

  if (kind === "suv") {
    width = 1.95;
    height = 1.72;
    length = 4.9;
  }

  if (kind === "pickup") {
    width = 1.98;
    height = 1.75;
    length = 5.5;
  }

  if (kind === "van") {
    width = 2.0;
    height = 2.05;
    length = 5.5;
  }

  if (kind === "minivan") {
    width = 1.94;
    height = 1.72;
    length = 4.95;
  }

  if (kind === "boxTruck") {
    width = 2.35;
    height = 3.0;
    length = 8.5;
  }

  if (kind === "semi") {
    width = 2.48;
    height = 3.9;
    length = 15;
  }

  if (kind === "bus") {
    width = 2.45;
    height = 3.2;
    length = 11;
  }

  if (kind === "chp") {
    width = 1.90;
    height = 1.48;
    length = 4.8;
  }

  const bodyMaterial =
    material(
      kind === "chp"
        ? 0xf4f4ee
        : color,
      0.38,
      0.35
    );

  // Main body
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(
      width,
      height * 0.55,
      length * 0.72
    ),
    bodyMaterial
  );

  body.position.y =
    height * 0.47;

  body.castShadow = true;

  group.add(body);

  // Cabin
  const cabinWidth =
    width * 0.88;

  const cabinHeight =
    height * 0.48;

  const cabinLength =
    length * 0.43;

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(
      cabinWidth,
      cabinHeight,
      cabinLength
    ),
    bodyMaterial
  );

  cabin.position.set(
    0,
    height * 0.86,
    -length * 0.02
  );

  cabin.castShadow = true;

  group.add(cabin);

  // Windows
  const frontWindow =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        cabinWidth * 0.87,
        cabinHeight * 0.48,
        0.045
      ),
      glassMaterial
    );

  frontWindow.position.set(
    0,
    height * 0.90,
    -length * 0.235
  );

  group.add(frontWindow);

  const rearWindow =
    frontWindow.clone();

  rearWindow.position.z =
    length * 0.19;

  group.add(rearWindow);

  // Side windows
  for (
    const side of [-1, 1]
  ) {
    const sideWindow =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.035,
          cabinHeight * 0.48,
          cabinLength * 0.76
        ),
        glassMaterial
      );

    sideWindow.position.set(
      side *
        cabinWidth *
        0.51,
      height * 0.90,
      -length * 0.02
    );

    group.add(sideWindow);
  }

  // Grille
  const grille = new THREE.Mesh(
    new THREE.BoxGeometry(
      width * 0.48,
      height * 0.25,
      0.06
    ),
    chromeMaterial
  );

  grille.position.set(
    0,
    height * 0.49,
    -length * 0.37
  );

  group.add(grille);

  // Headlights
  const headlightMaterial =
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffee,
      emissiveIntensity:
        1.6
    });

  for (
    const side of [-1, 1]
  ) {
    const light =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.34,
          0.18,
          0.07
        ),
        headlightMaterial
      );

    light.position.set(
      side *
        width *
        0.30,
      height * 0.57,
      -length * 0.40
    );

    group.add(light);
  }

  // Tail lights
  const tailMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x770d0d,
      emissive: 0xff0909,
      emissiveIntensity: 0.65
    });

  for (
    const side of [-1, 1]
  ) {
    const light =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.26,
          0.22,
          0.07
        ),
        tailMaterial
      );

    light.position.set(
      side *
        width *
        0.33,
      height * 0.55,
      length * 0.40
    );

    group.add(light);
  }

  // Wheels
  const wheels:
    THREE.Mesh[] = [];

  const wheelRadius =
    kind === "semi"
      ? 0.48
      : 0.34;

  const wheelWidth =
    kind === "semi"
      ? 0.30
      : 0.20;

  const wheelMaterial =
    material(
      0x101112,
      0.95
    );

  const wheelPositions = [
    [-width / 2, 0.35, -length * 0.28],
    [width / 2, 0.35, -length * 0.28],
    [-width / 2, 0.35, length * 0.28],
    [width / 2, 0.35, length * 0.28]
  ];

  for (
    const position of wheelPositions
  ) {
    const wheel =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          wheelRadius,
          wheelRadius,
          wheelWidth,
          12
        ),
        wheelMaterial
      );

    wheel.rotation.z =
      Math.PI / 2;

    wheel.position.set(
      position[0],
      position[1],
      position[2]
    );

    group.add(wheel);

    wheels.push(wheel);
  }

  // Semi trailer
  if (kind === "semi") {
    const trailer =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width * 0.96,
          height * 0.78,
          length * 0.63
        ),
        material(
          color,
          0.62
        )
      );

    trailer.position.set(
      0,
      height * 0.92,
      length * 0.13
    );

    group.add(trailer);

    const trailerRear =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width * 0.88,
          height * 0.55,
          0.05
        ),
        whiteMaterial
      );

    trailerRear.position.set(
      0,
      height * 0.94,
      length * 0.45
    );

    group.add(trailerRear);
  }

  // CHP lightbar
  if (kind === "chp") {
    const lightbar =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.75,
          0.13,
          0.20
        ),
        material(
          0x222222,
          0.3
        )
      );

    lightbar.position.y =
      height * 1.38;

    group.add(lightbar);

    const redLight =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.32,
          0.08,
          0.14
        ),
        new THREE.MeshStandardMaterial({
          color: 0xff0000,
          emissive: 0xff0000,
          emissiveIntensity: 2
        })
      );

    redLight.position.set(
      -0.18,
      height * 1.39,
      -0.01
    );

    group.add(redLight);

    const blueLight =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.32,
          0.08,
          0.14
        ),
        new THREE.MeshStandardMaterial({
          color: 0x0055ff,
          emissive: 0x0055ff,
          emissiveIntensity: 2
        })
      );

    blueLight.position.set(
      0.18,
      height * 1.39,
      -0.01
    );

    group.add(blueLight);
  }

  group.rotation.y =
    oncoming
      ? Math.PI
      : 0;

  scene.add(group);

  const vehicle: TrafficVehicle = {
    group,
    kind,

    lane: 0,
    targetLane: 0,

    speed: 55,
    desiredSpeed: 65,

    length,
    width,
    height,

    laneChangeTimer:
      randomRange(3, 12),

    signalTimer: 0,
    signalDirection: 0,

    color,

    active: true,

    oncoming,

    wheels
  };

  return vehicle;
}

// ============================================================
// TRAFFIC SPAWNING
// ============================================================

function laneX(
  lane: number
): number {
  return (
    -ROAD_WIDTH / 2 +
    LANE_WIDTH *
      (lane + 0.5)
  );
}

function spawnTraffic(
  vehicle: TrafficVehicle
): void {
  let lane: number;

  if (vehicle.oncoming) {
    // Opposing traffic uses the left half
    lane =
      Math.floor(
        Math.random() * 2
      );
  } else {
    // Player direction uses right half
    lane =
      2 +
      Math.floor(
        Math.random() * 2
      );
  }

  vehicle.lane = lane;
  vehicle.targetLane = lane;

  vehicle.group.position.set(
    laneX(lane),
    0,
    randomRange(
      80,
      410
    )
  );

  if (vehicle.oncoming) {
    vehicle.speed =
      randomRange(
        50,
        vehicle.kind === "semi"
          ? 65
          : 78
      );
  } else {
    vehicle.speed =
      randomRange(
        52,
        vehicle.kind === "semi"
          ? 67
          : 82
      );
  }

  if (vehicle.kind === "semi") {
    vehicle.desiredSpeed =
      randomRange(
        55,
        66
      );
  } else if (
    vehicle.kind === "pickup"
  ) {
    vehicle.desiredSpeed =
      randomRange(
        58,
        76
      );
  } else if (
    vehicle.kind === "chp"
  ) {
    vehicle.desiredSpeed =
      randomRange(
        60,
        78
      );
  } else {
    vehicle.desiredSpeed =
      randomRange(
        58,
        84
      );
  }
}

for (
  let i = 0;
  i < TRAFFIC_COUNT;
  i++
) {
  const kind =
    randomTrafficKind();

  const oncoming =
    Math.random() < 0.40;

  const vehicle =
    createTrafficVehicle(
      kind,
      oncoming
    );

  spawnTraffic(vehicle);

  // Spread traffic throughout world
  vehicle.group.position.z =
    randomRange(
      30,
      420
    ) * (i % 3 === 0 ? 1 : 0.85);

  trafficVehicles.push(
    vehicle
  );
}

// ============================================================
// PHYSICS
// ============================================================

const vehiclePhysics = {
  mass: 2650,

  enginePower: 0.82,

  brakingForce: 1.65,

  steeringSensitivity: 1.0,

  tireGrip: 0.74,

  drag: 0.0032,

  rollingResistance: 0.035,

  maximumSpeed: 125,

  weightDistributionFront: 0.56,

  suspensionStiffness: 0.65,

  suspensionDamping: 0.58,

  steeringInertia: 4.5,

  understeer: 0.72
};

function updatePlayerPhysics(
  delta: number
): void {
  const accelerating =
    keyDown(
      "w",
      "arrowup"
    );

  const braking =
    keyDown(
      "s",
      "arrowdown"
    );

  const steeringLeft =
    keyDown(
      "a",
      "arrowleft"
    );

  const steeringRight =
    keyDown(
      "d",
      "arrowright"
    );

  throttle = accelerating
    ? 1
    : 0;

  brake = braking
    ? 1
    : 0;

  if (
    steeringLeft &&
    !steeringRight
  ) {
    targetSteering = -1;
  } else if (
    steeringRight &&
    !steeringLeft
  ) {
    targetSteering = 1;
  } else {
    targetSteering = 0;
  }

  steering +=
    (
      targetSteering -
      steering
    ) *
    Math.min(
      1,
      vehiclePhysics.steeringInertia *
        delta
    );

  // ----------------------------------------------------------
  // Acceleration
  // ----------------------------------------------------------

  let acceleration = 0;

  if (throttle) {
    const speedFactor =
      Math.max(
        0,
        1 -
          speed /
            vehiclePhysics.maximumSpeed
      );

    acceleration +=
      vehiclePhysics.enginePower *
      34 *
      speedFactor;
  }

  // ----------------------------------------------------------
  // Braking
  // ----------------------------------------------------------

  if (brake) {
    acceleration -=
      vehiclePhysics.brakingForce *
      24;
  }

  // ----------------------------------------------------------
  // Aerodynamic drag
  // ----------------------------------------------------------

  acceleration -=
    speed *
    speed *
    vehiclePhysics.drag;

  // ----------------------------------------------------------
  // Rolling resistance
  // ----------------------------------------------------------

  acceleration -=
    vehiclePhysics.rollingResistance;

  speed +=
    acceleration *
    delta;

  speed = THREE.MathUtils.clamp(
    speed,
    0,
    vehiclePhysics.maximumSpeed
  );

  // ----------------------------------------------------------
  // Speed-dependent steering
  // ----------------------------------------------------------

  const speedRatio =
    THREE.MathUtils.clamp(
      speed / 80,
      0,
      1.6
    );

  const steeringStrength =
    0.34 /
    (
      1 +
      speedRatio *
        vehiclePhysics.understeer
    );

  // Vehicle lateral movement
  const lateralVelocity =
    steering *
    steeringStrength *
    speed *
    delta;

  playerX +=
    lateralVelocity;

  // Grip limit
  const roadEdge =
    ROAD_WIDTH / 2 -
    1.0;

  playerX =
    THREE.MathUtils.clamp(
      playerX,
      -roadEdge,
      roadEdge
    );

  // Heading follows steering,
  // but much more slowly than a sports car.
  const headingTarget =
    -steering *
    steeringStrength *
    0.55;

  playerHeading +=
    (
      headingTarget -
      playerHeading
    ) *
    delta *
    3.0;

  // ----------------------------------------------------------
  // Body roll
  // ----------------------------------------------------------

  const targetRoll =
    -steering *
    Math.min(
      0.075,
      speed / 500
    );

  cameraRoll +=
    (
      targetRoll -
      cameraRoll
    ) *
    delta *
    4;

  playerVisual.rotation.z =
    cameraRoll;

  // ----------------------------------------------------------
  // Suspension/bob
  // ----------------------------------------------------------

  const speedShake =
    Math.sin(
      performance.now() *
        0.012
    ) *
    Math.min(
      0.018,
      speed / 6000
    );

  cameraBob =
    speedShake;

  // Steering wheel
  steeringWheel.rotation.z =
    -steering *
    0.75;

  // ----------------------------------------------------------
  // Reverse
  // ----------------------------------------------------------

  if (
    braking &&
    speed < 1
  ) {
    speed = 0;
  }
}

// ============================================================
// TRAFFIC AI
// ============================================================

function findVehicleAhead(
  vehicle: TrafficVehicle
): TrafficVehicle | null {
  let closest:
    | TrafficVehicle
    | null = null;

  let closestDistance =
    Infinity;

  for (
    const other of trafficVehicles
  ) {
    if (
      other === vehicle ||
      !other.active ||
      other.oncoming !==
        vehicle.oncoming
    ) {
      continue;
    }

    if (
      other.targetLane !==
      vehicle.targetLane
    ) {
      continue;
    }

    const distance =
      other.group.position.z -
      vehicle.group.position.z;

    if (
      distance > 0 &&
      distance <
        closestDistance
    ) {
      closestDistance =
        distance;

      closest = other;
    }
  }

  return closest;
}

function canChangeLane(
  vehicle: TrafficVehicle,
  targetLane: number
): boolean {
  if (
    targetLane < 0 ||
    targetLane >= LANES
  ) {
    return false;
  }

  // Prevent traffic crossing into
  // the opposite direction.
  if (
    vehicle.oncoming &&
    targetLane >= 2
  ) {
    return false;
  }

  if (
    !vehicle.oncoming &&
    targetLane < 2
  ) {
    return false;
  }

  for (
    const other of trafficVehicles
  ) {
    if (
      other === vehicle ||
      !other.active
    ) {
      continue;
    }

    if (
      other.targetLane !==
      targetLane
    ) {
      continue;
    }

    const distance =
      Math.abs(
        other.group.position.z -
        vehicle.group.position.z
      );

    if (
      distance <
      vehicle.length +
        other.length +
        12
    ) {
      return false;
    }
  }

  return true;
}

function updateTraffic(
  delta: number
): void {
  for (
    const vehicle of trafficVehicles
  ) {
    if (!vehicle.active)
      continue;

    const ahead =
      findVehicleAhead(
        vehicle
      );

    let targetSpeed =
      vehicle.desiredSpeed;

    if (ahead) {
      const gap =
        ahead.group.position.z -
        vehicle.group.position.z -
        (
          vehicle.length +
          ahead.length
        ) /
          2;

      const safeDistance =
        Math.max(
          10,
          vehicle.speed *
            0.55
        );

      if (
        gap <
        safeDistance
      ) {
        targetSpeed =
          Math.min(
            targetSpeed,
            Math.max(
              25,
              ahead.speed -
                2
            )
          );

        // Try a lane change
        if (
          vehicle.laneChangeTimer <=
          0 &&
          Math.random() < 0.012
        ) {
          const direction =
            Math.random() < 0.5
              ? -1
              : 1;

          const newLane =
            vehicle.lane +
            direction;

          if (
            canChangeLane(
              vehicle,
              newLane
            )
          ) {
            vehicle.targetLane =
              newLane;

            vehicle.signalDirection =
              direction;

            vehicle.signalTimer =
              2.5;

            vehicle.laneChangeTimer =
              randomRange(
                6,
                15
              );
          }
        }
      }
    }

    // Gradual acceleration/deceleration
    if (
      vehicle.speed <
      targetSpeed
    ) {
      vehicle.speed +=
        delta *
        (
          vehicle.kind ===
          "semi"
            ? 3.2
            : 5.5
        );
    } else {
      vehicle.speed -=
        delta *
        (
          vehicle.kind ===
          "semi"
            ? 3.5
            : 6.5
        );
    }

    vehicle.speed =
      THREE.MathUtils.clamp(
        vehicle.speed,
        25,
        92
      );

    // Lane changing
    if (
      vehicle.lane !==
      vehicle.targetLane
    ) {
      const targetX =
        laneX(
          vehicle.targetLane
        );

      vehicle.group.position.x =
        THREE.MathUtils.damp(
          vehicle.group.position.x,
          targetX,
          1.7,
          delta
        );

      if (
        Math.abs(
          vehicle.group.position.x -
          targetX
        ) <
        0.08
      ) {
        vehicle.lane =
          vehicle.targetLane;

        vehicle.signalDirection =
          0;
      }
    }

    vehicle.laneChangeTimer -=
      delta;

    vehicle.signalTimer -=
      delta;

    if (
      vehicle.signalTimer <=
      0
    ) {
      vehicle.signalDirection =
        0;
    }

    // --------------------------------------------------------
    // World-relative movement
    //
    // Player stays at z=0.
    // Traffic moves toward/away from player.
    // --------------------------------------------------------

    const relativeSpeed =
      vehicle.oncoming
        ? (
            speed +
            vehicle.speed
          )
        : (
            speed -
            vehicle.speed
          );

    vehicle.group.position.z +=
      relativeSpeed *
      delta *
      0.72;

    // Wheels visibly rotate
    for (
      const wheel of vehicle.wheels
    ) {
      wheel.rotation.x +=
        vehicle.speed *
        delta *
        0.15;
    }

    // Recycle far traffic
    if (
      vehicle.group.position.z <
        MIN_Z ||
      vehicle.group.position.z >
        MAX_Z
    ) {
      spawnTraffic(vehicle);
    }
  }
}

// ============================================================
// ENDLESS WORLD RECYCLING
// ============================================================

function recycleWorld(
  delta: number
): void {
  const movement =
    speed *
    delta *
    0.72;

  worldDistance +=
    movement;

  // Road segments
  for (
    const segment of roadSegments
  ) {
    segment.group.position.z +=
      movement;

    if (
      segment.group.position.z <
      MIN_Z - ROAD_LENGTH
    ) {
      let farthest =
        Infinity;

      for (
        const other of roadSegments
      ) {
        farthest =
          Math.min(
            farthest,
            other.group.position.z
          );
      }

      segment.group.position.z =
        farthest -
        ROAD_LENGTH;
    }
  }

  // Environment
  for (
    const item of environmentObjects
  ) {
    item.object.position.z +=
      movement;

    item.z =
      item.object.position.z;

    if (
      item.object.position.z <
      MIN_Z - 30
    ) {
      item.object.position.z =
        randomRange(
          380,
          470
        );

      const side =
        Math.random() >
        0.5
          ? 1
          : -1;

      item.object.position.x =
        side *
        randomRange(
          ROAD_WIDTH / 2 +
            SHOULDER_WIDTH +
            5,
          52
        );

      item.object.rotation.y =
        randomRange(
          -0.25,
          0.25
        );
    }
  }
}

// ============================================================
// COLLISION DETECTION
// ============================================================

function checkCollisions(): void {
  const playerHalfWidth =
    PLAYER_WIDTH / 2;

  const playerHalfLength =
    PLAYER_LENGTH / 2;

  for (
    const vehicle of trafficVehicles
  ) {
    if (
      !vehicle.active
    )
      continue;

    const dx =
      Math.abs(
        vehicle.group.position.x -
        playerX
      );

    const dz =
      Math.abs(
        vehicle.group.position.z
      );

    const combinedWidth =
      playerHalfWidth +
      vehicle.width / 2;

    const combinedLength =
      playerHalfLength +
      vehicle.length / 2;

    if (
      dx <
        combinedWidth &&
      dz <
        combinedLength
    ) {
      const relativeSpeed =
        vehicle.oncoming
          ? speed +
            vehicle.speed
          : Math.abs(
              speed -
              vehicle.speed
            );

      if (
        relativeSpeed >
        55
      ) {
        endGame(
          "SEVERE CRASH"
        );
      } else {
        endGame(
          "CRASH"
        );
      }

      return;
    }
  }
}

// ============================================================
// CHP SYSTEM
// ============================================================

let chpVehicle:
  TrafficVehicle | null =
  null;

let chpState:
  | "normal"
  | "watching"
  | "stopping"
  | "pullover"
  | "finished" =
  "normal";

let chpTimer = 0;

function getCHPAttentionText():
  string {
  if (
    chpState ===
    "stopping"
  ) {
    return "PULL OVER";
  }

  if (
    chpAttention > 75
  ) {
    return "HIGH";
  }

  if (
    chpAttention > 40
  ) {
    return "WATCHING";
  }

  if (
    chpAttention > 15
  ) {
    return "LOW";
  }

  return "NORMAL";
}

function updateCHP(
  delta: number
): void {
  if (
    chpState ===
    "finished"
  ) {
    return;
  }

  // Probabilistic speeding attention
  const speeding =
    speed -
    speedLimit;

  if (
    speeding <= 0
  ) {
    chpAttention -=
      delta * 1.5;
  } else if (
    speeding < 10
  ) {
    chpAttention +=
      delta * 0.7;
  } else if (
    speeding < 20
  ) {
    chpAttention +=
      delta * 2.0;
  } else if (
    speeding < 35
  ) {
    chpAttention +=
      delta * 4.0;
  } else {
    chpAttention +=
      delta * 7.0;
  }

  chpAttention =
    THREE.MathUtils.clamp(
      chpAttention,
      0,
      100
    );

  chpTimer -= delta;

  // Spawn a CHP after sustained attention
  if (
    chpAttention > 48 &&
    !chpVehicle &&
    chpTimer <= 0
  ) {
    chpVehicle =
      createTrafficVehicle(
        "chp",
        false
      );

    chpVehicle.group.position.set(
      laneX(3),
      0,
      110
    );

    chpVehicle.speed =
      Math.max(
        55,
        speed -
          10
      );

    chpVehicle.desiredSpeed =
      speed;

    trafficVehicles.push(
      chpVehicle
    );

    chpState =
      "watching";

    chpTimer =
      12;
  }

  if (
    !chpVehicle
  ) {
    return;
  }

  // CHP follows the player
  if (
    chpState ===
    "watching"
  ) {
    chpVehicle.desiredSpeed =
      Math.max(
        55,
        speed -
          5
      );

    const relativeDistance =
      chpVehicle.group.position.z;

    if (
      chpAttention > 78 &&
      relativeDistance <
        70
    ) {
      chpState =
        "stopping";
    }
  }

  if (
    chpState ===
    "stopping"
  ) {
    chpVehicle.speed =
      Math.min(
        chpVehicle.speed +
          delta * 7,
        speed + 5
      );

    chpVehicle.group.position.z =
      THREE.MathUtils.damp(
        chpVehicle.group.position.z,
        18,
        1.0,
        delta
      );

    chpVehicle.group.position.x =
      THREE.MathUtils.damp(
        chpVehicle.group.position.x,
        playerX,
        1.0,
        delta
      );

    if (
      Math.abs(
        chpVehicle.group.position.z -
        18
      ) < 2
    ) {
      chpState =
        "pullover";
    }
  }

  if (
    chpState ===
    "pullover"
  ) {
    // Player must move right
    // and slow down.
    if (
      playerX >
        ROAD_WIDTH / 4 &&
      speed <
        20
    ) {
      chpState =
        "finished";

      endGame(
        "TRAFFIC STOP COMPLETED"
      );
    }
  }
}

// ============================================================
// SCORE
// ============================================================

function updateScore(
  delta: number
): void {
  const speedBonus =
    Math.max(
      0,
      speed -
        speedLimit
    );

  const safeSpeedFactor =
    speed >= 55 &&
    speed <= 80
      ? 1.4
      : 0.7;

  const dangerMultiplier =
    1 +
    speedBonus /
      80;

  score +=
    (
      10 +
      speed *
        0.32
    ) *
    safeSpeedFactor *
    dangerMultiplier *
    delta;

  // Clean highway driving bonus
  if (
    chpAttention < 15
  ) {
    score +=
      4 *
      delta;
  }

  distanceMiles +=
    (
      speed *
      delta
    ) /
    3600;
}

// ============================================================
// HUD
// ============================================================

const hud = document.createElement(
  "div"
);

hud.id = "hud";

hud.innerHTML = `
  <div class="hud-top">
    <div class="hud-card">
      <span>SPEED</span>
      <strong id="speedValue">65 MPH</strong>
    </div>

    <div class="hud-card">
      <span>LIMIT</span>
      <strong id="limitValue">65</strong>
    </div>

    <div class="hud-card">
      <span>DISTANCE</span>
      <strong id="distanceValue">0.00 MI</strong>
    </div>

    <div class="hud-card">
      <span>TIME</span>
      <strong id="timeValue">00:00</strong>
    </div>

    <div class="hud-card">
      <span>SCORE</span>
      <strong id="scoreValue">0</strong>
    </div>

    <div class="hud-card">
      <span>CHP</span>
      <strong id="chpValue">NORMAL</strong>
    </div>
  </div>

  <div id="warning"></div>

  <div id="controls">
    W / ↑ Accelerate
    &nbsp;&nbsp;
    S / ↓ Brake
    &nbsp;&nbsp;
    A / ← → D Steer
    &nbsp;&nbsp;
    Q / E Signals
  </div>
`;

document.body.appendChild(
  hud
);

const speedValue =
  document.getElementById(
    "speedValue"
  )!;

const limitValue =
  document.getElementById(
    "limitValue"
  )!;

const distanceValue =
  document.getElementById(
    "distanceValue"
  )!;

const timeValue =
  document.getElementById(
    "timeValue"
  )!;

const scoreValue =
  document.getElementById(
    "scoreValue"
  )!;

const chpValue =
  document.getElementById(
    "chpValue"
  )!;

const warning =
  document.getElementById(
    "warning"
  )!;

function updateHUD(): void {
  speedValue.textContent =
    `${Math.round(speed)} MPH`;

  limitValue.textContent =
    `${speedLimit}`;

  distanceValue.textContent =
    `${distanceMiles.toFixed(2)} MI`;

  const minutes =
    Math.floor(
      survivalTime / 60
    );

  const seconds =
    Math.floor(
      survivalTime % 60
    );

  timeValue.textContent =
    `${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

  scoreValue.textContent =
    Math.floor(
      score
    ).toLocaleString();

  chpValue.textContent =
    getCHPAttentionText();

  if (
    chpState ===
    "stopping"
  ) {
    warning.textContent =
      "⚠ CHP: PULL OVER TO THE RIGHT SHOULDER";

    warning.className =
      "danger";
  } else if (
    speed >
    speedLimit + 20
  ) {
    warning.textContent =
      "SLOW DOWN";

    warning.className =
      "warning";
  } else {
    warning.textContent =
      "";

    warning.className =
      "";
  }
}

// ============================================================
// GAME OVER
// ============================================================

const gameOver =
  document.createElement(
    "div"
  );

gameOver.id =
  "gameOver";

gameOver.innerHTML = `
  <div class="game-over-card">
    <h1 id="gameOverTitle">CRASH</h1>

    <p id="gameOverReason">
      Your drive has ended.
    </p>

    <div class="final-stats">
      <div>
        <span>SCORE</span>
        <strong id="finalScore">0</strong>
      </div>

      <div>
        <span>DISTANCE</span>
        <strong id="finalDistance">0.00 MI</strong>
      </div>

      <div>
        <span>SURVIVAL</span>
        <strong id="finalTime">00:00</strong>
      </div>
    </div>

    <button id="restartButton">
      RESTART
    </button>

    <p class="restartHint">
      Press R to restart
    </p>
  </div>
`;

document.body.appendChild(
  gameOver
);

const gameOverTitle =
  document.getElementById(
    "gameOverTitle"
  )!;

const gameOverReason =
  document.getElementById(
    "gameOverReason"
  )!;

const finalScore =
  document.getElementById(
    "finalScore"
  )!;

const finalDistance =
  document.getElementById(
    "finalDistance"
  )!;

const finalTime =
  document.getElementById(
    "finalTime"
  )!;

const restartButton =
  document.getElementById(
    "restartButton"
  )!;

restartButton.addEventListener(
  "click",
  restartGame
);

function endGame(
  reason: string
): void {
  if (
    gameState ===
    "gameover"
  ) {
    return;
  }

  crashReason =
    reason;

  gameState =
    "gameover";

  gameOver.style.display =
    "flex";

  gameOverTitle.textContent =
    reason;

  gameOverReason.textContent =
    reason ===
    "TRAFFIC STOP COMPLETED"
      ? "You safely pulled over after being stopped by CHP."
      : reason ===
        "SEVERE CRASH"
      ? "A high-speed collision ended the drive."
      : "You collided with another vehicle.";

  finalScore.textContent =
    Math.floor(
      score
    ).toLocaleString();

  finalDistance.textContent =
    `${distanceMiles.toFixed(2)} MI`;

  const minutes =
    Math.floor(
      survivalTime / 60
    );

  const seconds =
    Math.floor(
      survivalTime % 60
    );

  finalTime.textContent =
    `${minutes
      .toString()
      .padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
}

function restartGame(): void {
  gameState =
    "playing";

  speed =
    INITIAL_SPEED_MPH;

  playerX = 0;

  playerHeading = 0;

  steering = 0;

  targetSteering = 0;

  distanceMiles = 0;

  survivalTime = 0;

  score = 0;

  chpAttention = 0;

  chpState =
    "normal";

  chpVehicle = null;

  leftSignal = false;
  rightSignal = false;

  gameOver.style.display =
    "none";

  // Reset traffic
  for (
    const vehicle of trafficVehicles
  ) {
    spawnTraffic(vehicle);
  }

  // Reset road
  for (
    let i = 0;
    i <
    roadSegments.length;
    i++
  ) {
    roadSegments[i].group.position.z =
      20 -
      i * ROAD_LENGTH;
  }

  // Reset environment
  for (
    const item of environmentObjects
  ) {
    item.object.position.z =
      randomRange(
        MIN_Z,
        MAX_Z
      );
  }

  playerVehicle.position.x =
    0;

  playerVehicle.rotation.y =
    0;

  camera.position.set(
    0,
    1.42,
    0.35
  );
}

// ============================================================
// FIRST PERSON CAMERA
// ============================================================

function updateCamera(
  delta: number
): void {
  // Camera does NOT rotate with steering.
  // It remains attached to the cockpit.

  const desiredX =
    -steering *
    0.025;

  camera.position.x =
    THREE.MathUtils.damp(
      camera.position.x,
      desiredX,
      4,
      delta
    );

  const suspensionBob =
    cameraBob;

  camera.position.y =
    1.42 +
    suspensionBob;

  camera.position.z =
    0.35;

  // Very subtle roll.
  camera.rotation.z =
    cameraRoll *
    0.35;

  // Small speed sensation.
  const targetFov =
    70 +
    Math.min(
      8,
      speed / 18
    );

  camera.fov =
    THREE.MathUtils.damp(
      camera.fov,
      targetFov,
      3,
      delta
    );

  camera.updateProjectionMatrix();
}

// ============================================================
// PAUSE SCREEN
// ============================================================

const pause =
  document.createElement(
    "div"
  );

pause.id =
  "pauseScreen";

pause.innerHTML = `
  <div class="pause-card">
    <h2>PAUSED</h2>
    <p>Press ESC to continue.</p>
  </div>
`;

document.body.appendChild(
  pause
);

function updatePause(): void {
  pause.style.display =
    gameState ===
    "stopped"
      ? "flex"
      : "none";
}

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
  }
);

// ============================================================
// MAIN LOOP
// ============================================================

const clock =
  new THREE.Clock();

function gameLoop(): void {
  requestAnimationFrame(
    gameLoop
  );

  const delta =
    Math.min(
      clock.getDelta(),
      0.05
    );

  if (
    gameState ===
    "playing"
  ) {
    survivalTime +=
      delta;

    updatePlayerPhysics(
      delta
    );

    updateTraffic(
      delta
    );

    recycleWorld(
      delta
    );

    checkCollisions();

    updateCHP(
      delta
    );

    updateScore(
      delta
    );
  }

  updateCamera(
    delta
  );

  updateHUD();

  updatePause();

  renderer.render(
    scene,
    camera
  );
}

restartGame();

gameLoop();
