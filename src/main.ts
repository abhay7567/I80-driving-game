import * as THREE from "three";
import "./style.css";

/*
 * I-80 DRIVING GAME
 * Browser prototype
 *
 * Engine: Three.js
 * Build: Vite + TypeScript
 *
 * The player vehicle remains near the origin.
 * The highway/world moves toward the player to create
 * the visual sensation of forward driving.
 */

// ============================================================
// CONFIGURATION
// ============================================================

const ROAD = {
  lanes: 4,
  laneWidth: 4,
  width: 16,
  shoulderWidth: 3.5,
  segmentLength: 80,
  segmentCount: 24,
  visibleDistance: 1500,
};

const PLAYER = {
  mass: 2650,
  enginePower: 0.85,
  brakingPower: 1.35,
  maxSpeedMph: 120,

  steeringRate: 7.0,
  steeringReturn: 5.0,
  tireGrip: 0.74,

  acceleration: 14,
  drag: 0.003,
  rollingResistance: 0.018,

  maxLateralSpeed: 7.5,
  steeringWheelDegrees: 22,

  bodyRoll: 0.045,
};

const SPEED_LIMIT = 65;

const MPH_TO_MPS = 0.44704;

// ============================================================
// THREE.JS
// ============================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x8fb8d8);

scene.fog = new THREE.Fog(
  0x8fb8d8,
  180,
  1250
);

const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.05,
  1800
);

camera.position.set(
  0,
  1.48,
  0.15
);

camera.rotation.set(
  0,
  0,
  0
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});

renderer.setSize(
  window.innerWidth,
  window.innerHeight
);

renderer.setPixelRatio(
  Math.min(window.devicePixelRatio, 1.5)
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type =
  THREE.PCFSoftShadowMap;

document.body.appendChild(
  renderer.domElement
);

// ============================================================
// LIGHTING
// ============================================================

const hemisphereLight =
  new THREE.HemisphereLight(
    0xd7ecff,
    0x4f5b40,
    1.8
  );

scene.add(
  hemisphereLight
);

const sun =
  new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

sun.position.set(
  -100,
  180,
  100
);

sun.castShadow = true;

sun.shadow.mapSize.width = 1024;
sun.shadow.mapSize.height = 1024;

scene.add(sun);

// ============================================================
// MATERIALS
// ============================================================

const roadMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x30343a,
    roughness: 0.96,
  });

const asphaltDark =
  new THREE.MeshStandardMaterial({
    color: 0x25292e,
    roughness: 1,
  });

const concreteMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x777a7c,
    roughness: 0.85,
  });

const whiteMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.65,
  });

const yellowMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xffd600,
    roughness: 0.65,
  });

const grassMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x657d51,
    roughness: 1,
  });

const dirtMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x7c6347,
    roughness: 1,
  });

const metalMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x777b7d,
    metalness: 0.65,
    roughness: 0.4,
  });

const blackMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x101214,
    roughness: 0.85,
  });

const tireMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x111111,
    roughness: 1,
  });

const glassMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x152a35,
    roughness: 0.18,
    metalness: 0.1,
    transparent: true,
    opacity: 0.7,
  });

const chromeMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xc7c9ca,
    metalness: 0.85,
    roughness: 0.2,
  });

// ============================================================
// WORLD
// ============================================================

const world =
  new THREE.Group();

scene.add(world);

const roadSegments:
  THREE.Group[] = [];

const roadsideObjects:
  THREE.Group[] = [];

// ============================================================
// TERRAIN
// ============================================================

const terrain =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      2400,
      3000
    ),
    grassMaterial
  );

terrain.rotation.x =
  -Math.PI / 2;

terrain.position.set(
  0,
  -0.1,
  -600
);

terrain.receiveShadow = true;

world.add(terrain);

// ============================================================
// ROAD SEGMENTS
// ============================================================

function createRoadSegment(
  z: number
): THREE.Group {

  const segment =
    new THREE.Group();

  segment.position.z = z;

  // Main road

  const road =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        ROAD.width,
        ROAD.segmentLength
      ),
      roadMaterial
    );

  road.rotation.x =
    -Math.PI / 2;

  road.position.y = 0;

  road.receiveShadow = true;

  segment.add(road);

  // Shoulders

  const leftShoulder =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        ROAD.shoulderWidth,
        ROAD.segmentLength
      ),
      asphaltDark
    );

  leftShoulder.rotation.x =
    -Math.PI / 2;

  leftShoulder.position.set(
    -(ROAD.width / 2) -
      ROAD.shoulderWidth / 2,
    0.01,
    0
  );

  segment.add(
    leftShoulder
  );

  const rightShoulder =
    leftShoulder.clone();

  rightShoulder.position.x =
    ROAD.width / 2 +
    ROAD.shoulderWidth / 2;

  segment.add(
    rightShoulder
  );

  // Lane markings

  for (
    let lane = 1;
    lane < ROAD.lanes;
    lane++
  ) {

    const lineX =
      -ROAD.width / 2 +
      lane * ROAD.laneWidth;

    for (
      let i = 0;
      i < 6;
      i++
    ) {

      const stripe =
        new THREE.Mesh(
          new THREE.PlaneGeometry(
            0.12,
            7
          ),
          whiteMaterial
        );

      stripe.rotation.x =
        -Math.PI / 2;

      stripe.position.set(
        lineX,
        0.025,
        -30 + i * 12
      );

      segment.add(
        stripe
      );
    }
  }

  // Left yellow line

  const yellowLine =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        0.16,
        ROAD.segmentLength
      ),
      yellowMaterial
    );

  yellowLine.rotation.x =
    -Math.PI / 2;

  yellowLine.position.set(
    -ROAD.width / 2,
    0.027,
    0
  );

  segment.add(
    yellowLine
  );

  // Right white edge line

  const rightLine =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        0.16,
        ROAD.segmentLength
      ),
      whiteMaterial
    );

  rightLine.rotation.x =
    -Math.PI / 2;

  rightLine.position.set(
    ROAD.width / 2,
    0.027,
    0
  );

  segment.add(
    rightLine
  );

  // Concrete barriers

  const leftBarrier =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.35,
        0.9,
        ROAD.segmentLength
      ),
      concreteMaterial
    );

  leftBarrier.position.set(
    -12,
    0.45,
    0
  );

  leftBarrier.castShadow = true;

  segment.add(
    leftBarrier
  );

  const rightBarrier =
    leftBarrier.clone();

  rightBarrier.position.x =
    12;

  segment.add(
    rightBarrier
  );

  return segment;
}

for (
  let i = 0;
  i < ROAD.segmentCount;
  i++
) {

  const segment =
    createRoadSegment(
      -i * ROAD.segmentLength
    );

  world.add(
    segment
  );

  roadSegments.push(
    segment
  );
}

// ============================================================
// HILLS
// ============================================================

function createHill(
  x: number,
  z: number,
  size: number
): THREE.Group {

  const group =
    new THREE.Group();

  const hill =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        1,
        18,
        12
      ),
      new THREE.MeshStandardMaterial({
        color:
          Math.random() > 0.5
            ? 0x60744f
            : 0x71845b,
        roughness: 1,
      })
    );

  hill.scale.set(
    size,
    size * 0.45,
    size
  );

  hill.position.y =
    size * 0.12;

  hill.castShadow = true;

  group.add(
    hill
  );

  group.position.set(
    x,
    0,
    z
  );

  return group;
}

for (
  let i = 0;
  i < 18;
  i++
) {

  const z =
    -100 -
    i * 90;

  world.add(
    createHill(
      -100 -
        Math.random() * 60,
      z,
      35 +
        Math.random() * 35
    )
  );

  world.add(
    createHill(
      100 +
        Math.random() * 60,
      z - 40,
      35 +
        Math.random() * 40
    )
  );
}

// ============================================================
// TREES
// ============================================================

function createTree(
  x: number,
  z: number
): THREE.Group {

  const tree =
    new THREE.Group();

  const trunk =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.12,
        0.2,
        2.4,
        8
      ),
      new THREE.MeshStandardMaterial({
        color: 0x5b3d26,
      })
    );

  trunk.position.y = 1.2;

  tree.add(
    trunk
  );

  const leaves =
    new THREE.Mesh(
      new THREE.ConeGeometry(
        1.4,
        3.8,
        8
      ),
      new THREE.MeshStandardMaterial({
        color:
          Math.random() > 0.5
            ? 0x42623c
            : 0x527346,
      })
    );

  leaves.position.y = 3.2;

  leaves.castShadow = true;

  tree.add(
    leaves
  );

  tree.position.set(
    x,
    0,
    z
  );

  return tree;
}

for (
  let i = 0;
  i < 100;
  i++
) {

  const side =
    Math.random() < 0.5
      ? -1
      : 1;

  const x =
    side *
    (
      18 +
      Math.random() * 65
    );

  const z =
    -50 -
    Math.random() * 1300;

  const tree =
    createTree(
      x,
      z
    );

  tree.scale.setScalar(
    0.7 +
    Math.random() * 0.8
  );

  world.add(
    tree
  );
}

// ============================================================
// UTILITY POLES
// ============================================================

function createUtilityPole(
  x: number,
  z: number
): THREE.Group {

  const pole =
    new THREE.Group();

  const wood =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.08,
        0.12,
        8,
        8
      ),
      new THREE.MeshStandardMaterial({
        color: 0x584536,
      })
    );

  wood.position.y = 4;

  pole.add(
    wood
  );

  const crossbar =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        3,
        0.12,
        0.12
      ),
      wood.material
    );

  crossbar.position.y = 7;

  pole.add(
    crossbar
  );

  for (
    const wireX of [-1.1, 0, 1.1]
  ) {

    const insulator =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.04,
          0.04,
          0.3,
          6
        ),
        blackMaterial
      );

    insulator.position.set(
      wireX,
      7.2,
      0
    );

    pole.add(
      insulator
    );
  }

  pole.position.set(
    x,
    0,
    z
  );

  return pole;
}

for (
  let i = 0;
  i < 16;
  i++
) {

  world.add(
    createUtilityPole(
      -25,
      -80 -
        i * 85
    )
  );
}

// ============================================================
// OVERPASSES
// ============================================================

function createOverpass(
  z: number
): THREE.Group {

  const group =
    new THREE.Group();

  const concrete =
    concreteMaterial;

  const deck =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        46,
        1.1,
        6
      ),
      concrete
    );

  deck.position.y = 7;

  deck.castShadow = true;

  group.add(
    deck
  );

  const left =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.2,
        7,
        1.2
      ),
      concrete
    );

  left.position.set(
    -15,
    3.5,
    0
  );

  group.add(
    left
  );

  const right =
    left.clone();

  right.position.x =
    15;

  group.add(
    right
  );

  group.position.z =
    z;

  return group;
}

for (
  let i = 0;
  i < 7;
  i++
) {

  world.add(
    createOverpass(
      -260 -
        i * 190
    )
  );
}

// ============================================================
// HIGHWAY SIGN
// ============================================================

function createHighwaySign(
  z: number
): THREE.Group {

  const group =
    new THREE.Group();

  const postMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x777777,
      metalness: 0.6,
    });

  const post =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.18,
        7,
        0.18
      ),
      postMaterial
    );

  post.position.y =
    3.5;

  group.add(
    post
  );

  const sign =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        6.5,
        2.2,
        0.12
      ),
      new THREE.MeshStandardMaterial({
        color: 0x155b35,
        roughness: 0.7,
      })
    );

  sign.position.set(
    0,
    6.4,
    0
  );

  group.add(
    sign
  );

  // White "I-80" style center panel

  const shield =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.6,
        0.9,
        0.14
      ),
      whiteMaterial
    );

  shield.position.set(
    -2,
    6.4,
    -0.1
  );

  group.add(
    shield
  );

  group.position.set(
    8.5,
    0,
    z
  );

  return group;
}

world.add(
  createHighwaySign(
    -430
  )
);

world.add(
  createHighwaySign(
    -920
  )
);

// ============================================================
// PLAYER COCKPIT
// ============================================================

const cockpit =
  new THREE.Group();

scene.add(
  cockpit
);

// Dashboard

const dashboard =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      3.0,
      0.42,
      1.0
    ),
    blackMaterial
  );

dashboard.position.set(
  0,
  1.02,
  -0.72
);

cockpit.add(
  dashboard
);

// Dashboard upper trim

const dashboardTrim =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.9,
      0.08,
      0.15
    ),
    chromeMaterial
  );

dashboardTrim.position.set(
  0,
  1.23,
  -0.73
);

cockpit.add(
  dashboardTrim
);

// Hood

const hoodMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x1d2226,
    roughness: 0.4,
    metalness: 0.3,
  });

const hood =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.55,
      0.18,
      1.7
    ),
    hoodMaterial
  );

hood.position.set(
  0,
  0.82,
  -1.9
);

hood.castShadow = true;

cockpit.add(
  hood
);

// Hood center crease

const hoodCrease =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.04,
      0.03,
      1.6
    ),
    chromeMaterial
  );

hoodCrease.position.set(
  0,
  0.92,
  -1.9
);

cockpit.add(
  hoodCrease
);

// Windshield

const windshield =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      2.72,
      1.55
    ),
    new THREE.MeshBasicMaterial({
      color: 0x65818b,
      transparent: true,
      opacity: 0.10,
      side: THREE.DoubleSide,
    })
  );

windshield.position.set(
  0,
  1.75,
  -0.7
);

windshield.rotation.x =
  -0.08;

cockpit.add(
  windshield
);

// A-pillars

function createAPillar(
  x: number
): void {

  const pillar =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.15,
        1.9,
        0.16
      ),
      blackMaterial
    );

  pillar.position.set(
    x,
    1.62,
    -0.67
  );

  pillar.rotation.z =
    x < 0
      ? -0.13
      : 0.13;

  cockpit.add(
    pillar
  );
}

createAPillar(-1.43);
createAPillar(1.43);

// Roof edge

const roofEdge =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      3.1,
      0.15,
      0.18
    ),
    blackMaterial
  );

roofEdge.position.set(
  0,
  2.45,
  -0.58
);

cockpit.add(
  roofEdge
);

// ============================================================
// STEERING WHEEL
// ============================================================

const steeringWheel =
  new THREE.Group();

cockpit.add(
  steeringWheel
);

const wheelRing =
  new THREE.Mesh(
    new THREE.TorusGeometry(
      0.29,
      0.055,
      12,
      32
    ),
    blackMaterial
  );

wheelRing.rotation.x =
  Math.PI / 2;

steeringWheel.add(
  wheelRing
);

const wheelHub =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.1,
      0.1,
      0.08,
      16
    ),
    chromeMaterial
  );

wheelHub.rotation.x =
  Math.PI / 2;

steeringWheel.add(
  wheelHub
);

const spokeMaterial =
  blackMaterial;

for (
  let i = 0;
  i < 3;
  i++
) {

  const angle =
    i *
    Math.PI *
    2 /
    3;

  const spoke =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.055,
        0.48,
        0.045
      ),
      spokeMaterial
    );

  spoke.position.y =
    Math.sin(angle) *
    0.2;

  spoke.position.x =
    Math.cos(angle) *
    0.2;

  spoke.rotation.z =
    -angle;

  steeringWheel.add(
    spoke
  );
}

steeringWheel.position.set(
  -0.58,
  1.17,
  -0.95
);

steeringWheel.rotation.z =
  0;

// ============================================================
// GAUGES
// ============================================================

function createGauge(
  x: number
): THREE.Mesh {

  return new THREE.Mesh(
    new THREE.CircleGeometry(
      0.18,
      24
    ),
    new THREE.MeshBasicMaterial({
      color: 0x151a1d
    })
  );
}

cockpit.add(
  createGauge(-0.25)
);

cockpit.children[
  cockpit.children.length - 1
].position.set(
  -0.25,
  1.22,
  -1.0
);

cockpit.add(
  createGauge(0.25)
);

cockpit.children[
  cockpit.children.length - 1
].position.set(
  0.25,
  1.22,
  -1.0
);

// ============================================================
// MIRRORS
// ============================================================

function createMirror(
  x: number
): void {

  const mirror =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.18,
        0.38,
        0.55
      ),
      blackMaterial
    );

  mirror.position.set(
    x,
    1.48,
    -0.25
  );

  cockpit.add(
    mirror
  );

  const glass =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.03,
        0.27,
        0.4
      ),
      glassMaterial
    );

  glass.position.set(
    x +
      (x < 0 ? -0.1 : 0.1),
    1.48,
    -0.25
  );

  cockpit.add(
    glass
  );
}

createMirror(-1.6);
createMirror(1.6);

// ============================================================
// PLAYER STATE
// ============================================================

let speedMph = 0;

let lateralVelocity = 0;

let steering =
  0;

let bodyRoll =
  0;

let distanceMiles =
  0;

let survivalTime =
  0;

let score =
  0;

let gameOver =
  false;

let paused =
  false;

// ============================================================
// INPUT
// ============================================================

const keys =
  new Set<string>();

let throttle =
  0;

let brake =
  0;

let signalLeft =
  false;

let signalRight =
  false;

window.addEventListener(
  "keydown",
  (event) => {

    const key =
      event.key.toLowerCase();

    keys.add(key);

    if (
      [
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " "
      ].includes(key)
    ) {
      event.preventDefault();
    }

    if (
      key === "q"
    ) {
      signalLeft =
        !signalLeft;

      signalRight =
        false;
    }

    if (
      key === "e"
    ) {
      signalRight =
        !signalRight;

      signalLeft =
        false;
    }

    if (
      key === "escape"
    ) {
      paused =
        !paused;
    }

    if (
      key === "r" &&
      gameOver
    ) {
      restartGame();
    }
  }
);

window.addEventListener(
  "keyup",
  (event) => {

    keys.delete(
      event.key.toLowerCase()
    );
  }
);

function readInput(): void {

  throttle =
    keys.has("w") ||
    keys.has("arrowup")
      ? 1
      : 0;

  brake =
    keys.has("s") ||
    keys.has("arrowdown")
      ? 1
      : 0;

  let targetSteering =
    0;

  if (
    keys.has("a") ||
    keys.has("arrowleft")
  ) {
    targetSteering -= 1;
  }

  if (
    keys.has("d") ||
    keys.has("arrowright")
  ) {
    targetSteering += 1;
  }

  if (
    targetSteering !== 0
  ) {

    steering =
      THREE.MathUtils.lerp(
        steering,
        targetSteering,
        0.16
      );

  } else {

    steering =
      THREE.MathUtils.lerp(
        steering,
        0,
        0.10
      );
  }
}

// ============================================================
// TRAFFIC
// ============================================================

interface TrafficVehicle {
  group: THREE.Group;

  type:
    | "car"
    | "suv"
    | "pickup"
    | "semi";

  lane: number;

  speedMph: number;

  desiredSpeedMph: number;

  length: number;

  width: number;

  acceleration: number;

  braking: number;

  laneTimer: number;

  laneCooldown: number;
}

const traffic:
  TrafficVehicle[] = [];

const trafficColors = [
  0xffffff,
  0x20252a,
  0x68727a,
  0x263c54,
  0x7b2424,
  0x9a9a9a,
  0xc7c7c7,
  0x3d4b36,
];

// ============================================================
// VEHICLE MODEL
// ============================================================

function createVehicleModel(
  type:
    | "car"
    | "suv"
    | "pickup"
    | "semi"
): THREE.Group {

  const group =
    new THREE.Group();

  let width = 1.75;
  let height = 1.35;
  let length = 4.4;

  if (
    type === "suv"
  ) {
    width = 1.9;
    height = 1.65;
    length = 4.8;
  }

  if (
    type === "pickup"
  ) {
    width = 1.95;
    height = 1.7;
    length = 5.3;
  }

  if (
    type === "semi"
  ) {
    width = 2.5;
    height = 3.5;
    length = 10;
  }

  const color =
    trafficColors[
      Math.floor(
        Math.random() *
        trafficColors.length
      )
    ];

  const bodyMaterial =
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.2,
    });

  // Main body

  const body =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height * 0.55,
        length
      ),
      bodyMaterial
    );

  body.position.y =
    height * 0.3;

  body.castShadow = true;

  group.add(
    body
  );

  // Cabin

  const cabin =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.82,
        height * 0.45,
        length * 0.45
      ),
      bodyMaterial
    );

  cabin.position.set(
    0,
    height * 0.67,
    -length * 0.08
  );

  cabin.castShadow = true;

  group.add(
    cabin
  );

  // Windows

  const frontWindow =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.68,
        height * 0.27,
        0.05
      ),
      glassMaterial
    );

  frontWindow.position.set(
    0,
    height * 0.69,
    -length * 0.31
  );

  group.add(
    frontWindow
  );

  const rearWindow =
    frontWindow.clone();

  rearWindow.position.z =
    length * 0.16;

  group.add(
    rearWindow
  );

  // Wheels

  const wheelPositions = [
    [-width / 2, 0.27, -length * 0.28],
    [width / 2, 0.27, -length * 0.28],
    [-width / 2, 0.27, length * 0.28],
    [width / 2, 0.27, length * 0.28],
  ];

  for (
    const position of
      wheelPositions
  ) {

    const wheel =
      new THREE.Mesh(
        new THREE.CylinderGeometry(
          0.27,
          0.27,
          0.18,
          12
        ),
        tireMaterial
      );

    wheel.rotation.z =
      Math.PI / 2;

    wheel.position.set(
      position[0],
      position[1],
      position[2]
    );

    group.add(
      wheel
    );
  }

  // Headlights

  const headlightMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xffffdd
    });

  for (
    const x of [
      -width * 0.3,
      width * 0.3
    ]
  ) {

    const light =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.3,
          0.14,
          0.04
        ),
        headlightMaterial
      );

    light.position.set(
      x,
      height * 0.38,
      -length / 2
    );

    group.add(
      light
    );
  }

  // Tail lights

  const tailMaterial =
    new THREE.MeshBasicMaterial({
      color: 0xff1717
    });

  for (
    const x of [
      -width * 0.3,
      width * 0.3
    ]
  ) {

    const light =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.3,
          0.14,
          0.04
        ),
        tailMaterial
      );

    light.position.set(
      x,
      height * 0.38,
      length / 2
    );

    group.add(
      light
    );
  }

  // Semi-specific trailer

  if (
    type === "semi"
  ) {

    body.geometry =
      new THREE.BoxGeometry(
        width,
        height * 0.7,
        length
      );

    cabin.geometry =
      new THREE.BoxGeometry(
        width * 0.95,
        height * 0.75,
        length * 0.2
      );

    cabin.position.z =
      -length * 0.37;

    const trailerStripe =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width * 0.98,
          0.12,
          length * 0.9
        ),
        new THREE.MeshStandardMaterial({
          color: 0xdddddd
        })
      );

    trailerStripe.position.y =
      height * 0.4;

    trailerStripe.position.z =
      length * 0.05;

    group.add(
      trailerStripe
    );
  }

  return group;
}

// ============================================================
// SPAWN TRAFFIC
// ============================================================

function spawnTraffic(
  lane: number,
  z: number
): void {

  const roll =
    Math.random();

  let type:
    | "car"
    | "suv"
    | "pickup"
    | "semi";

  if (
    roll < 0.52
  ) {
    type = "car";
  } else if (
    roll < 0.73
  ) {
    type = "suv";
  } else if (
    roll < 0.91
  ) {
    type = "pickup";
  } else {
    type = "semi";
  }

  const group =
    createVehicleModel(
      type
    );

  const x =
    -ROAD.width / 2 +
    lane *
      ROAD.laneWidth +
    ROAD.laneWidth / 2;

  group.position.set(
    x,
    0,
    z
  );

  world.add(
    group
  );

  let desiredSpeed =
    58 +
    Math.random() * 22;

  if (
    type === "semi"
  ) {
    desiredSpeed =
      48 +
      Math.random() * 15;
  }

  if (
    type === "pickup"
  ) {
    desiredSpeed =
      55 +
      Math.random() * 20;
  }

  traffic.push({
    group,
    type,
    lane,
    speedMph:
      desiredSpeed *
      (0.85 +
        Math.random() *
          0.12),
    desiredSpeedMph:
      desiredSpeed,
    length:
      type === "semi"
        ? 10
        : type === "pickup"
        ? 5.3
        : 4.5,
    width:
      type === "semi"
        ? 2.5
        : 1.9,
    acceleration:
      type === "semi"
        ? 3
        : 5,
    braking:
      type === "semi"
        ? 5
        : 8,
    laneTimer:
      Math.random() * 10,
    laneCooldown:
      6 +
      Math.random() * 10,
  });
}

// Initial traffic

for (
  let i = 0;
  i < 34;
  i++
) {

  const lane =
    Math.floor(
      Math.random() *
        ROAD.lanes
    );

  const z =
    -80 -
    Math.random() *
      1300;

  spawnTraffic(
    lane,
    z
  );
}

// ============================================================
// TRAFFIC AI
// ============================================================

function findVehicleAhead(
  vehicle: TrafficVehicle
): TrafficVehicle | null {

  let nearest:
    TrafficVehicle | null =
    null;

  let nearestDistance =
    Infinity;

  for (
    const other of
      traffic
  ) {

    if (
      other === vehicle
    ) {
      continue;
    }

    if (
      other.lane !==
      vehicle.lane
    ) {
      continue;
    }

    const distance =
      vehicle.group.position.z -
      other.group.position.z;

    if (
      distance > 0 &&
      distance <
        nearestDistance
    ) {

      nearest =
        other;

      nearestDistance =
        distance;
    }
  }

  return nearest;
}

function laneIsSafe(
  vehicle: TrafficVehicle,
  lane: number
): boolean {

  if (
    lane < 0 ||
    lane >= ROAD.lanes
  ) {
    return false;
  }

  for (
    const other of
      traffic
  ) {

    if (
      other === vehicle
    ) {
      continue;
    }

    if (
      other.lane !==
      lane
    ) {
      continue;
    }

    const distance =
      Math.abs(
        other.group.position.z -
        vehicle.group.position.z
      );

    if (
      distance < 45
    ) {
      return false;
    }
  }

  return true;
}

function updateTraffic(
  delta: number,
  worldSpeedMph: number
): void {

  const playerMps =
    worldSpeedMph *
    MPH_TO_MPS;

  for (
    const vehicle of
      traffic
  ) {

    const ahead =
      findVehicleAhead(
        vehicle
      );

    let targetSpeed =
      vehicle.desiredSpeedMph;

    if (
      ahead
    ) {

      const distance =
        vehicle.group.position.z -
        ahead.group.position.z;

      if (
        distance <
        45
      ) {

        targetSpeed =
          Math.min(
            targetSpeed,
            ahead.speedMph -
              5
          );

          vehicle.laneTimer +=
            delta;

          if (
            vehicle.laneTimer >
              vehicle.laneCooldown &&
            Math.random() <
              0.012
          ) {

            const directions =
              Math.random() <
              0.5
                ? [-1, 1]
                : [1, -1];

            for (
              const direction of
                directions
            ) {

              const newLane =
                vehicle.lane +
                direction;

              if (
                laneIsSafe(
                  vehicle,
                  newLane
                )
              ) {

                vehicle.lane =
                  newLane;

                vehicle.laneTimer =
                  0;

                break;
              }
            }
          }
      }
    }

    const difference =
      targetSpeed -
      vehicle.speedMph;

    if (
      difference > 0
    ) {

      vehicle.speedMph +=
        vehicle.acceleration *
        delta;

    } else {

      vehicle.speedMph -=
        vehicle.braking *
        delta;
    }

    vehicle.speedMph =
      THREE.MathUtils.clamp(
        vehicle.speedMph,
        20,
        vehicle.type ===
          "semi"
          ? 72
          : 100
      );

    // Relative motion:
    //
    // Player/world moves forward.
    // Traffic vehicles move according
    // to their own speed relative to player.

    const trafficMps =
      vehicle.speedMph *
      MPH_TO_MPS;

    const relativeSpeed =
      playerMps -
      trafficMps;

    vehicle.group.position.z +=
      relativeSpeed *
      delta;

    const targetX =
      -ROAD.width / 2 +
      vehicle.lane *
        ROAD.laneWidth +
      ROAD.laneWidth / 2;

    vehicle.group.position.x =
      THREE.MathUtils.lerp(
        vehicle.group.position.x,
        targetX,
        Math.min(
          delta * 3,
          1
        )
      );

    // Recycle behind player.

    if (
      vehicle.group.position.z >
        100
    ) {

      vehicle.group.position.z =
        -900 -
        Math.random() *
          700;

      vehicle.lane =
        Math.floor(
          Math.random() *
            ROAD.lanes
        );

      vehicle.group.position.x =
        -ROAD.width / 2 +
        vehicle.lane *
          ROAD.laneWidth +
        ROAD.laneWidth / 2;

      vehicle.speedMph =
        vehicle.desiredSpeedMph *
        (
          0.85 +
          Math.random() *
            0.15
        );
    }
  }
}

// ============================================================
// WORLD MOVEMENT
// ============================================================

function updateWorld(
  delta: number
): void {

  const playerMps =
    speedMph *
    MPH_TO_MPS;

  const movement =
    playerMps *
    delta;

  if (
    movement <= 0
  ) {
    return;
  }

  for (
    const segment of
      roadSegments
  ) {

    segment.position.z +=
      movement;

    if (
      segment.position.z >
        ROAD.segmentLength
    ) {

      const farthest =
        Math.min(
          ...roadSegments.map(
            s =>
              s.position.z
          )
        );

      segment.position.z =
        farthest -
        ROAD.segmentLength;
    }
  }

  // Move terrain scenery.

  for (
    const child of
      world.children
  ) {

    if (
      roadSegments.includes(
        child as THREE.Group
      )
    ) {
      continue;
    }

    if (
      child === terrain
    ) {
      continue;
    }

    child.position.z +=
      movement;

    if (
      child.position.z >
        120
    ) {

      child.position.z -=
        1600;
    }
  }
}

// ============================================================
// PLAYER PHYSICS
// ============================================================

function updatePlayer(
  delta: number
): void {

  readInput();

  // ----------------------------------------------------------
  // ACCELERATION
  // ----------------------------------------------------------

  const speedRatio =
    speedMph /
    PLAYER.maxSpeedMph;

  let acceleration =
    0;

  if (
    throttle > 0
  ) {

    acceleration =
      PLAYER.acceleration *
      PLAYER.enginePower *
      (
        1 -
        speedRatio *
        0.72
      );
  }

  // ----------------------------------------------------------
  // BRAKING
  // ----------------------------------------------------------

  if (
    brake > 0
  ) {

    acceleration -=
      PLAYER.brakingPower *
      18;
  }

  // Natural resistance

  acceleration -=
    speedMph *
    PLAYER.drag;

  if (
    speedMph > 0
  ) {

    acceleration -=
      PLAYER.rollingResistance;
  }

  speedMph +=
    acceleration *
    delta;

  speedMph =
    THREE.MathUtils.clamp(
      speedMph,
      0,
      PLAYER.maxSpeedMph
    );

  // ----------------------------------------------------------
  // STEERING
  // ----------------------------------------------------------

  const steeringEffect =
    THREE.MathUtils.clamp(
      speedMph / 40,
      0.15,
      1
    );

  const desiredLateral =
    steering *
    PLAYER.maxLateralSpeed *
    steeringEffect;

  lateralVelocity =
    THREE.MathUtils.lerp(
      lateralVelocity,
      desiredLateral,
      PLAYER.tireGrip *
        delta *
        3
    );

  // Understeer at high speed

  const highSpeedUndersteer =
    THREE.MathUtils.clamp(
      1 -
        speedRatio *
        0.55,
      0.45,
      1
    );

  lateralVelocity *=
    highSpeedUndersteer;

  cockpit.position.x +=
    lateralVelocity *
    delta;

  // Highway boundaries

  cockpit.position.x =
    THREE.MathUtils.clamp(
      cockpit.position.x,
      -6.4,
      6.4
    );

  // ----------------------------------------------------------
  // BODY ROLL
  // ----------------------------------------------------------

  const targetRoll =
    -steering *
    PLAYER.bodyRoll *
    steeringEffect;

  bodyRoll =
    THREE.MathUtils.lerp(
      bodyRoll,
      targetRoll,
      delta * 5
    );

  cockpit.rotation.z =
    bodyRoll;

  // ----------------------------------------------------------
  // STEERING WHEEL
  // ----------------------------------------------------------

  const targetWheelRotation =
    -steering *
    THREE.MathUtils.degToRad(
      PLAYER.steeringWheelDegrees
    );

  steeringWheel.rotation.z =
    THREE.MathUtils.lerp(
      steeringWheel.rotation.z,
      targetWheelRotation,
      delta * 8
    );

  // ----------------------------------------------------------
  // CAMERA
  // ----------------------------------------------------------

  // IMPORTANT:
  // Camera stays inside the vehicle.
  // It does NOT rotate with steering.

  camera.position.x =
    cockpit.position.x;

  camera.position.y =
    1.48 +
    Math.sin(
      performance.now() *
      0.008
    ) *
    Math.min(
      speedMph / 120,
      1
    ) *
    0.004;

  camera.position.z =
    0.15;

  camera.rotation.set(
    0,
    0,
    0
  );

  // ----------------------------------------------------------
  // DISTANCE
  // ----------------------------------------------------------

  distanceMiles +=
    speedMph *
    delta /
    3600;

  survivalTime +=
    delta;

  // ----------------------------------------------------------
  // SCORE
  // ----------------------------------------------------------

  const speedQuality =
    Math.max(
      0,
      1 -
        Math.abs(
          speedMph -
            SPEED_LIMIT
        ) /
          65
    );

  const speedBonus =
    Math.max(
      0,
      speedMph -
        45
    ) *
    0.5;

  score +=
    (
      8 +
      speedQuality *
        8 +
      speedBonus
    ) *
    delta;
}

// ============================================================
// COLLISIONS
// ============================================================

function checkCollisions(): void {

  const playerX =
    cockpit.position.x;

  for (
    const vehicle of
      traffic
  ) {

    const dx =
      Math.abs(
        playerX -
        vehicle.group.position.x
      );

    const dz =
      Math.abs(
        vehicle.group.position.z
      );

    const collisionWidth =
      (
        vehicle.width +
        1.8
      ) /
      2;

    const collisionLength =
      (
        vehicle.length +
        4.2
      ) /
      2;

    if (
      dx <
        collisionWidth &&
      dz <
        collisionLength
    ) {

      const severe =
        speedMph >
        50;

      endGame(
        severe
          ? "SEVERE CRASH"
          : "VEHICLE COLLISION"
      );

      return;
    }
  }
}

// ============================================================
// HUD
// ============================================================

const hud =
  document.createElement(
    "div"
  );

hud.id =
  "hud";

hud.innerHTML = `
  <div class="hud-row">
    <span>SPEED</span>
    <strong id="hud-speed">0 MPH</strong>
  </div>

  <div class="hud-row">
    <span>LIMIT</span>
    <strong>65</strong>
  </div>

  <div class="hud-row">
    <span>DISTANCE</span>
    <strong id="hud-distance">0.00 MI</strong>
  </div>

  <div class="hud-row">
    <span>TIME</span>
    <strong id="hud-time">00:00</strong>
  </div>

  <div class="hud-row">
    <span>SCORE</span>
    <strong id="hud-score">0</strong>
  </div>

  <div class="hud-row">
    <span>CHP</span>
    <strong id="hud-chp">NORMAL</strong>
  </div>
`;

document.body.appendChild(
  hud
);

// ============================================================
// CENTER INFO
// ============================================================

const controls =
  document.createElement(
    "div"
  );

controls.id =
  "controls";

controls.innerHTML = `
  W / ↑  ACCELERATE
  &nbsp;&nbsp;
  S / ↓  BRAKE
  &nbsp;&nbsp;
  A / ←  LEFT
  &nbsp;&nbsp;
  D / →  RIGHT
`;

document.body.appendChild(
  controls
);

// ============================================================
// GAME OVER
// ============================================================

const gameOverScreen =
  document.createElement(
    "div"
  );

gameOverScreen.id =
  "game-over";

gameOverScreen.innerHTML = `
  <div class="game-over-panel">

    <h1>RUN OVER</h1>

    <div
      id="failure-reason"
      class="failure-reason"
    >
      VEHICLE COLLISION
    </div>

    <div class="result">
      SCORE
      <strong id="final-score">
        0
      </strong>
    </div>

    <div class="result">
      DISTANCE
      <strong id="final-distance">
        0.00 MI
      </strong>
    </div>

    <div class="result">
      SURVIVAL TIME
      <strong id="final-time">
        00:00
      </strong>
    </div>

    <p>
      Press R to restart
    </p>

  </div>
`;

document.body.appendChild(
  gameOverScreen
);

// ============================================================
// END GAME
// ============================================================

function endGame(
  reason: string
): void {

  if (
    gameOver
  ) {
    return;
  }

  gameOver =
    true;

  const reasonElement =
    document.getElementById(
      "failure-reason"
    );

  const scoreElement =
    document.getElementById(
      "final-score"
    );

  const distanceElement =
    document.getElementById(
      "final-distance"
    );

  const timeElement =
    document.getElementById(
      "final-time"
    );

  if (
    reasonElement
  ) {
    reasonElement.textContent =
      reason;
  }

  if (
    scoreElement
  ) {
    scoreElement.textContent =
      Math.floor(
        score
      ).toLocaleString();
  }

  if (
    distanceElement
  ) {
    distanceElement.textContent =
      `${distanceMiles.toFixed(
        2
      )} MI`;
  }

  if (
    timeElement
  ) {

    const minutes =
      Math.floor(
        survivalTime /
          60
      );

    const seconds =
      Math.floor(
        survivalTime %
          60
      );

    timeElement.textContent =
      `${String(
        minutes
      ).padStart(
        2,
        "0"
      )}:${String(
        seconds
      ).padStart(
        2,
        "0"
      )}`;
  }

  gameOverScreen.style.display =
    "flex";
}

// ============================================================
// RESTART
// ============================================================

function restartGame(): void {

  speedMph =
    0;

  lateralVelocity =
    0;

  steering =
    0;

  bodyRoll =
    0;

  distanceMiles =
    0;

  survivalTime =
    0;

  score =
    0;

  gameOver =
    false;

  paused =
    false;

  cockpit.position.x =
    0;

  cockpit.rotation.z =
    0;

  steeringWheel.rotation.z =
    0;

  camera.position.set(
    0,
    1.48,
    0.15
  );

  camera.rotation.set(
    0,
    0,
    0
  );

  // Reset road

  roadSegments.forEach(
    (
      segment,
      index
    ) => {

      segment.position.z =
        -index *
        ROAD.segmentLength;
    }
  );

  // Reset scenery

  world.children.forEach(
    (child) => {

      if (
        child !== terrain &&
        !roadSegments.includes(
          child as THREE.Group
        )
      ) {

        if (
          child.position.z >
          -100
        ) {

          child.position.z =
            -100 -
            Math.random() *
              1200;
        }
      }
    }
  );

  // Reset traffic

  traffic.forEach(
    (
      vehicle,
      index
    ) => {

      vehicle.lane =
        index %
        ROAD.lanes;

      vehicle.group.position.x =
        -ROAD.width / 2 +
        vehicle.lane *
          ROAD.laneWidth +
        ROAD.laneWidth / 2;

      vehicle.group.position.z =
        -80 -
        Math.random() *
          1200;

      vehicle.speedMph =
        vehicle.desiredSpeedMph *
        (
          0.85 +
          Math.random() *
            0.12
        );
    }
  );

  gameOverScreen.style.display =
    "none";
}

// ============================================================
// HUD UPDATE
// ============================================================

function updateHUD(): void {

  const speed =
    document.getElementById(
      "hud-speed"
    );

  const distance =
    document.getElementById(
      "hud-distance"
    );

  const time =
    document.getElementById(
      "hud-time"
    );

  const scoreElement =
    document.getElementById(
      "hud-score"
    );

  if (
    speed
  ) {
    speed.textContent =
      `${Math.round(
        speedMph
      )} MPH`;
  }

  if (
    distance
  ) {
    distance.textContent =
      `${distanceMiles.toFixed(
        2
      )} MI`;
  }

  if (
    time
  ) {

    const minutes =
      Math.floor(
        survivalTime /
          60
      );

    const seconds =
      Math.floor(
        survivalTime %
          60
      );

    time.textContent =
      `${String(
        minutes
      ).padStart(
        2,
        "0"
      )}:${String(
        seconds
      ).padStart(
        2,
        "0"
      )}`;
  }

  if (
    scoreElement
  ) {
    scoreElement.textContent =
      Math.floor(
        score
      ).toLocaleString();
  }
}

// ============================================================
// PAUSE INDICATOR
// ============================================================

const pauseText =
  document.createElement(
    "div"
  );

pauseText.id =
  "pause-text";

pauseText.textContent =
  "PAUSED";

document.body.appendChild(
  pauseText
);

// ============================================================
// MAIN LOOP
// ============================================================

let previousTime =
  performance.now();

function animate(): void {

  requestAnimationFrame(
    animate
  );

  const now =
    performance.now();

  const delta =
    Math.min(
      (
        now -
        previousTime
      ) / 1000,
      0.05
    );

  previousTime =
    now;

  pauseText.style.display =
    paused
      ? "block"
      : "none";

  if (
    paused ||
    gameOver
  ) {

    renderer.render(
      scene,
      camera
    );

    return;
  }

  updatePlayer(
    delta
  );

  updateWorld(
    delta
  );

  updateTraffic(
    delta,
    speedMph
  );

  checkCollisions();

  updateHUD();

  renderer.render(
    scene,
    camera
  );
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
// START
// ============================================================

animate();
