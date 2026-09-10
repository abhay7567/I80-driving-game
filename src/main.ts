import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import "./style.css";

/*
 * I-80 DRIVING GAME
 * Browser prototype
 *
 * Technology:
 * - Three.js
 * - Rapier 3D
 * - TypeScript
 * - Vite
 *
 * No external API or API key is required.
 */

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface VehiclePhysicsConfig {
  mass: number;
  engineForce: number;
  brakingForce: number;
  steeringSensitivity: number;
  tireGrip: number;
  drag: number;
  rollingResistance: number;
  maximumSpeedMph: number;
  steeringInertia: number;
  bodyRollAmount: number;
}

interface TrafficVehicle {
  mesh: THREE.Group;
  type: "car" | "suv" | "pickup" | "semi";
  lane: number;
  speedMph: number;
  desiredSpeedMph: number;
  acceleration: number;
  brakingAbility: number;
  followingDistance: number;
  laneChangeCooldown: number;
  laneChangeTimer: number;
}

// --------------------------------------------------
// GAME INITIALIZATION
// --------------------------------------------------

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x8fb5d3);

scene.fog = new THREE.Fog(
  0x8fb5d3,
  100,
  900
);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.05,
  1500
);

camera.position.set(
  0,
  1.42,
  0
);

const renderer = new THREE.WebGLRenderer({
  antialias: true
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

// --------------------------------------------------
// LIGHTING
// --------------------------------------------------

const sun = new THREE.DirectionalLight(
  0xffffff,
  2.2
);

sun.position.set(
  -100,
  180,
  100
);

sun.castShadow = true;

scene.add(sun);

const skyLight =
  new THREE.HemisphereLight(
    0xcce7ff,
    0x526348,
    1.5
  );

scene.add(skyLight);

// --------------------------------------------------
// WORLD CONFIGURATION
// --------------------------------------------------

const ROAD_WIDTH = 16;
const LANE_WIDTH = 4;
const ROAD_LENGTH = 1400;

const NUMBER_OF_LANES = 4;

const SPEED_LIMIT_MPH = 65;

// --------------------------------------------------
// TERRAIN
// --------------------------------------------------

const terrainMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x657d58,
    roughness: 1
  });

const terrain =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      2200,
      2200
    ),
    terrainMaterial
  );

terrain.rotation.x =
  -Math.PI / 2;

terrain.position.set(
  0,
  -0.08,
  -500
);

terrain.receiveShadow = true;

scene.add(terrain);

// --------------------------------------------------
// HIGHWAY
// --------------------------------------------------

const roadMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x30343a,
    roughness: 0.95
  });

const road =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      ROAD_WIDTH,
      ROAD_LENGTH
    ),
    roadMaterial
  );

road.rotation.x =
  -Math.PI / 2;

road.position.set(
  0,
  0,
  -ROAD_LENGTH / 2
);

road.receiveShadow = true;

scene.add(road);

// --------------------------------------------------
// SHOULDERS
// --------------------------------------------------

const shoulderMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x777777,
    roughness: 1
  });

function createShoulder(
  x: number
): void {
  const shoulder =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        5,
        ROAD_LENGTH
      ),
      shoulderMaterial
    );

  shoulder.rotation.x =
    -Math.PI / 2;

  shoulder.position.set(
    x,
    0.01,
    -ROAD_LENGTH / 2
  );

  scene.add(shoulder);
}

createShoulder(-10.5);
createShoulder(10.5);

// --------------------------------------------------
// ROAD LINES
// --------------------------------------------------

const whiteLineMaterial =
  new THREE.MeshBasicMaterial({
    color: 0xffffff
  });

const yellowLineMaterial =
  new THREE.MeshBasicMaterial({
    color: 0xffd400
  });

function createLaneStripe(
  x: number,
  z: number
): void {
  const stripe =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        0.12,
        5
      ),
      whiteLineMaterial
    );

  stripe.rotation.x =
    -Math.PI / 2;

  stripe.position.set(
    x,
    0.025,
    z
  );

  scene.add(stripe);
}

for (
  let z = 0;
  z > -ROAD_LENGTH;
  z -= 10
) {
  for (
    let lane = 1;
    lane < NUMBER_OF_LANES;
    lane++
  ) {
    const x =
      -ROAD_WIDTH / 2 +
      lane * LANE_WIDTH;

    createLaneStripe(
      x,
      z
    );
  }
}

// --------------------------------------------------
// EDGE LINES
// --------------------------------------------------

const leftEdge =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      0.18,
      ROAD_LENGTH
    ),
    yellowLineMaterial
  );

leftEdge.rotation.x =
  -Math.PI / 2;

leftEdge.position.set(
  -ROAD_WIDTH / 2,
  0.026,
  -ROAD_LENGTH / 2
);

scene.add(leftEdge);

const rightEdge =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      0.18,
      ROAD_LENGTH
    ),
    whiteLineMaterial
  );

rightEdge.rotation.x =
  -Math.PI / 2;

rightEdge.position.set(
  ROAD_WIDTH / 2,
  0.026,
  -ROAD_LENGTH / 2
);

scene.add(rightEdge);

// --------------------------------------------------
// GUARDRAILS
// --------------------------------------------------

const guardrailMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x999999,
    metalness: 0.7,
    roughness: 0.4
  });

function createGuardrail(
  x: number
): void {
  const rail =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.15,
        0.7,
        ROAD_LENGTH
      ),
      guardrailMaterial
    );

  rail.position.set(
    x,
    0.45,
    -ROAD_LENGTH / 2
  );

  rail.castShadow = true;

  scene.add(rail);
}

createGuardrail(-12.5);
createGuardrail(12.5);

// --------------------------------------------------
// HILLS
// --------------------------------------------------

function createHill(
  x: number,
  z: number,
  scale: number
): void {
  const material =
    new THREE.MeshStandardMaterial({
      color: 0x526b4c,
      roughness: 1
    });

  const hill =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        1,
        16,
        10
      ),
      material
    );

  hill.scale.set(
    scale,
    scale * 0.55,
    scale
  );

  hill.position.set(
    x,
    scale * 0.25,
    z
  );

  scene.add(hill);
}

for (
  let z = -100;
  z > -1200;
  z -= 180
) {
  createHill(
    -100,
    z,
    55
  );

  createHill(
    100,
    z - 60,
    65
  );
}

// --------------------------------------------------
// TREES
// --------------------------------------------------

function createTree(
  x: number,
  z: number
): void {
  const group =
    new THREE.Group();

  const trunk =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.15,
        0.2,
        2,
        8
      ),
      new THREE.MeshStandardMaterial({
        color: 0x5a3923
      })
    );

  trunk.position.y = 1;

  group.add(trunk);

  const leaves =
    new THREE.Mesh(
      new THREE.ConeGeometry(
        1.2,
        3.5,
        8
      ),
      new THREE.MeshStandardMaterial({
        color: 0x3f683c
      })
    );

  leaves.position.y = 3;

  group.add(leaves);

  group.position.set(
    x,
    0,
    z
  );

  scene.add(group);
}

for (
  let i = 0;
  i < 80;
  i++
) {
  const side =
    Math.random() < 0.5
      ? -1
      : 1;

  createTree(
    side *
      (18 +
        Math.random() * 70),
    -Math.random() * 1300
  );
}

// --------------------------------------------------
// OVERPASSES
// --------------------------------------------------

function createOverpass(
  z: number
): void {
  const concrete =
    new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9
    });

  const deck =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        45,
        1.3,
        7
      ),
      concrete
    );

  deck.position.set(
    0,
    7,
    z
  );

  deck.castShadow = true;

  scene.add(deck);

  const supportLeft =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        1.4,
        7,
        1.4
      ),
      concrete
    );

  supportLeft.position.set(
    -15,
    3.5,
    z
  );

  scene.add(
    supportLeft
  );

  const supportRight =
    supportLeft.clone();

  supportRight.position.x =
    15;

  scene.add(
    supportRight
  );
}

createOverpass(-350);
createOverpass(-800);
createOverpass(-1150);

// --------------------------------------------------
// PLAYER VEHICLE
// --------------------------------------------------

const player =
  new THREE.Group();

scene.add(player);

const vehicleBodyMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x20252a,
    roughness: 0.45,
    metalness: 0.25
  });

const interiorMaterial =
  new THREE.MeshStandardMaterial({
    color: 0x151515,
    roughness: 0.9
  });

const dashboard =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      3.0,
      0.45,
      0.9
    ),
    interiorMaterial
  );

dashboard.position.set(
  0,
  0.93,
  -0.9
);

player.add(dashboard);

// Hood

const hood =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.55,
      0.25,
      1.8
    ),
    vehicleBodyMaterial
  );

hood.position.set(
  0,
  0.82,
  -2
  );

hood.castShadow = true;

player.add(hood);

// --------------------------------------------------
// WINDSHIELD
// --------------------------------------------------

const windshieldMaterial =
  new THREE.MeshBasicMaterial({
    color: 0x4d6872,
    transparent: true,
    opacity: 0.12
  });

const windshield =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      2.7,
      1.45
    ),
    windshieldMaterial
  );

windshield.position.set(
  0,
  1.7,
  -0.7
);

windshield.rotation.x =
  -0.08;

player.add(windshield);

// --------------------------------------------------
// A-PILLARS
// --------------------------------------------------

function createPillar(
  x: number
): void {
  const pillar =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.13,
        1.8,
        0.13
      ),
      interiorMaterial
    );

  pillar.position.set(
    x,
    1.55,
    -0.65
  );

  pillar.rotation.z =
    x < 0
      ? -0.16
      : 0.16;

  player.add(pillar);
}

createPillar(-1.4);
createPillar(1.4);

// --------------------------------------------------
// STEERING WHEEL
// --------------------------------------------------

const steeringWheel =
  new THREE.Mesh(
    new THREE.TorusGeometry(
      0.28,
      0.055,
      10,
      24
    ),
    interiorMaterial
  );

steeringWheel.position.set(
  -0.5,
  1.12,
  -1.0
);

steeringWheel.rotation.x =
  Math.PI / 2;

player.add(
  steeringWheel
);

// --------------------------------------------------
// MIRRORS
// --------------------------------------------------

function createMirror(
  x: number
): void {
  const mirror =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.18,
        0.35,
        0.55
      ),
      interiorMaterial
    );

  mirror.position.set(
    x,
    1.45,
    -0.35
  );

  player.add(mirror);
}

createMirror(-1.6);
createMirror(1.6);

// --------------------------------------------------
// PLAYER PHYSICS CONFIG
// --------------------------------------------------

const playerPhysics:
  VehiclePhysicsConfig = {

  mass: 2650,

  engineForce: 8200,

  brakingForce: 12500,

  steeringSensitivity: 0.035,

  tireGrip: 0.72,

  drag: 0.42,

  rollingResistance: 0.018,

  maximumSpeedMph: 125,

  steeringInertia: 0.82,

  bodyRollAmount: 0.055
};

// --------------------------------------------------
// RAPier PHYSICS
// --------------------------------------------------

let physicsWorld:
  RAPIER.World | null = null;

let playerBody:
  RAPIER.RigidBody | null = null;

let playerCollider:
  RAPIER.Collider | null = null;

async function initializePhysics(): Promise<void> {

  await RAPIER.init();

  physicsWorld =
    new RAPIER.World({
      x: 0,
      y: -9.81,
      z: 0
    });

  const bodyDescription =
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(
        0,
        0.8,
        0
      );

  playerBody =
    physicsWorld.createRigidBody(
      bodyDescription
    );

  const colliderDescription =
    RAPIER.ColliderDesc.cuboid(
      1.35,
      0.6,
      2.5
    )
      .setMass(
        playerPhysics.mass
      )
      .setFriction(
        playerPhysics.tireGrip
      );

  playerCollider =
    physicsWorld.createCollider(
      colliderDescription,
      playerBody
    );
}

// --------------------------------------------------
// INPUT
// --------------------------------------------------

const keys =
  new Set<string>();

let steeringInput = 0;
let throttleInput = 0;
let brakeInput = 0;

let leftSignal = false;
let rightSignal = false;

window.addEventListener(
  "keydown",
  (event) => {

    keys.add(
      event.key.toLowerCase()
    );

    if (
      event.key.toLowerCase() === "q"
    ) {
      leftSignal =
        !leftSignal;

      rightSignal = false;
    }

    if (
      event.key.toLowerCase() === "e"
    ) {
      rightSignal =
        !rightSignal;

      leftSignal = false;
    }

    if (
      event.key === "Escape"
    ) {
      paused =
        !paused;
    }

    if (
      event.key.toLowerCase() === "r" &&
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

function updateInput(): void {

  throttleInput =
    keys.has("w") ||
    keys.has("arrowup")
      ? 1
      : 0;

  brakeInput =
    keys.has("s") ||
    keys.has("arrowdown")
      ? 1
      : 0;

  const left =
    keys.has("a") ||
    keys.has("arrowleft");

  const right =
    keys.has("d") ||
    keys.has("arrowright");

  if (
    left &&
    !right
  ) {
    steeringInput =
      THREE.MathUtils.lerp(
        steeringInput,
        -1,
        0.12
      );
  }
  else if (
    right &&
    !left
  ) {
    steeringInput =
      THREE.MathUtils.lerp(
        steeringInput,
        1,
        0.12
      );
  }
  else {
    steeringInput =
      THREE.MathUtils.lerp(
        steeringInput,
        0,
        0.08
      );
  }
}

// --------------------------------------------------
// PLAYER STATE
// --------------------------------------------------

let speedMph = 0;

let lateralVelocity = 0;

let distanceMiles = 0;

let survivalSeconds = 0;

let score = 0;

let gameOver = false;

let paused = false;

let gameOverReason = "";

// --------------------------------------------------
// TRAFFIC VEHICLES
// --------------------------------------------------

const trafficVehicles:
  TrafficVehicle[] = [];

const trafficColors = [
  0xffffff,
  0x222222,
  0x777777,
  0x202b35,
  0x8a2525,
  0x9c9c9c,
  0x305080,
  0xb8b8b8
];

function createTrafficVehicle(
  lane: number,
  z: number
): void {

  const group =
    new THREE.Group();

  const types:
    TrafficVehicle["type"][] = [
      "car",
      "suv",
      "pickup",
      "semi"
    ];

  const type =
    types[
      Math.floor(
        Math.random() *
        types.length
      )
    ];

  let width = 1.75;
  let height = 1.45;
  let length = 4.3;

  let desiredSpeed =
    60 +
    Math.random() * 20;

  if (
    type === "suv"
  ) {
    width = 1.9;
    height = 1.75;
    length = 4.8;

    desiredSpeed =
      58 +
      Math.random() * 17;
  }

  if (
    type === "pickup"
  ) {
    width = 1.95;
    height = 1.75;
    length = 5.3;

    desiredSpeed =
      58 +
      Math.random() * 15;
  }

  if (
    type === "semi"
  ) {
    width = 2.5;
    height = 3.8;
    length = 11;

    desiredSpeed =
      50 +
      Math.random() * 12;
  }

  const color =
    type === "semi"
      ? 0xbdbdbd
      : trafficColors[
          Math.floor(
            Math.random() *
            trafficColors.length
          )
        ];

  const material =
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.7
    });

  const body =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        length
      ),
      material
    );

  body.position.y =
    height / 2;

  body.castShadow = true;

  group.add(body);

  // Windows

  const windowMaterial =
    new THREE.MeshStandardMaterial({
      color: 0x18242b,
      roughness: 0.25
    });

  const windows =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.78,
        height * 0.35,
        length * 0.42
      ),
      windowMaterial
    );

  windows.position.y =
    height * 0.7;

  windows.position.z =
    -length * 0.08;

  group.add(windows);

  const x =
    -ROAD_WIDTH / 2 +
    lane * LANE_WIDTH +
    LANE_WIDTH / 2;

  group.position.set(
    x,
    0,
    z
  );

  scene.add(group);

  const vehicle:
    TrafficVehicle = {

    mesh: group,

    type,

    lane,

    speedMph:
      desiredSpeed *
      0.9,

    desiredSpeedMph:
      desiredSpeed,

    acceleration:
      type === "semi"
        ? 1.5
        : 2.8,

    brakingAbility:
      type === "semi"
        ? 0.6
        : 1.0,

    followingDistance:
      type === "semi"
        ? 45
        : 30,

    laneChangeCooldown:
      5 +
      Math.random() * 8,

    laneChangeTimer:
      Math.random() * 10
  };

  trafficVehicles.push(
    vehicle
  );
}

// --------------------------------------------------
// INITIAL TRAFFIC
// --------------------------------------------------

for (
  let i = 0;
  i < 30;
  i++
) {

  const lane =
    Math.floor(
      Math.random() *
      NUMBER_OF_LANES
    );

  const z =
    -60 -
    i * 40 -
    Math.random() * 40;

  createTrafficVehicle(
    lane,
    z
  );
}

// --------------------------------------------------
// TRAFFIC AI
// --------------------------------------------------

function getTrafficAhead(
  vehicle: TrafficVehicle
): TrafficVehicle | null {

  let closest:
    TrafficVehicle | null =
    null;

  let closestDistance =
    Infinity;

  for (
    const other of
      trafficVehicles
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
      other.mesh.position.z -
      vehicle.mesh.position.z;

    if (
      distance > 0 &&
      distance <
        closestDistance
    ) {
      closest =
        other;

      closestDistance =
        distance;
    }
  }

  return closest;
}

function isLaneSafe(
  vehicle: TrafficVehicle,
  lane: number
): boolean {

  if (
    lane < 0 ||
    lane >= NUMBER_OF_LANES
  ) {
    return false;
  }

  for (
    const other of
      trafficVehicles
  ) {

    if (
      other === vehicle
    ) {
      continue;
    }

    if (
      other.lane !== lane
    ) {
      continue;
    }

    const distance =
      Math.abs(
        other.mesh.position.z -
        vehicle.mesh.position.z
      );

    if (
      distance < 35
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
    const vehicle of
      trafficVehicles
  ) {

    const ahead =
      getTrafficAhead(
        vehicle
      );

    let targetSpeed =
      vehicle.desiredSpeedMph;

    if (ahead) {

      const distance =
        ahead.mesh.position.z -
        vehicle.mesh.position.z;

      if (
        distance <
        vehicle.followingDistance
      ) {

        targetSpeed =
          Math.min(
            targetSpeed,
            ahead.speedMph -
              3
          );

        vehicle.laneChangeTimer +=
          delta;

        if (
          vehicle.laneChangeTimer >
            vehicle.laneChangeCooldown &&
          Math.random() < 0.008
        ) {

          const direction =
            Math.random() <
            0.5
              ? -1
              : 1;

          const newLane =
            vehicle.lane +
            direction;

          if (
            isLaneSafe(
              vehicle,
              newLane
            )
          ) {

            vehicle.lane =
              newLane;

            vehicle.laneChangeTimer =
              0;

            vehicle.mesh.position.x =
              -ROAD_WIDTH / 2 +
              vehicle.lane *
                LANE_WIDTH +
              LANE_WIDTH / 2;
          }
        }
      }
    }

    const speedDifference =
      targetSpeed -
      vehicle.speedMph;

    if (
      speedDifference > 0
    ) {

      vehicle.speedMph +=
        vehicle.acceleration *
        delta;

    } else {

      vehicle.speedMph -=
        vehicle.brakingAbility *
        2.5 *
        delta;
    }

    vehicle.speedMph =
      THREE.MathUtils.clamp(
        vehicle.speedMph,
        20,
        vehicle.type ===
          "semi"
          ? 70
          : 95
      );

    const metersPerSecond =
      vehicle.speedMph *
      0.44704;

    vehicle.mesh.position.z +=
      metersPerSecond *
      delta;

    // Recycle vehicles behind player.

    if (
      vehicle.mesh.position.z >
        70
    ) {

      vehicle.mesh.position.z =
        -800 -
        Math.random() *
          500;

      vehicle.lane =
        Math.floor(
          Math.random() *
          NUMBER_OF_LANES
        );

      vehicle.speedMph =
        45 +
        Math.random() *
          30;

      vehicle.desiredSpeedMph =
        vehicle.type === "semi"
          ? 50 +
            Math.random() * 12
          : 60 +
            Math.random() * 20;

      vehicle.mesh.position.x =
        -ROAD_WIDTH / 2 +
        vehicle.lane *
          LANE_WIDTH +
        LANE_WIDTH / 2;
    }
  }
}

// --------------------------------------------------
// PLAYER UPDATE
// --------------------------------------------------

function updatePlayer(
  delta: number
): void {

  updateInput();

  const speedRatio =
    THREE.MathUtils.clamp(
      speedMph /
        playerPhysics.maximumSpeedMph,
      0,
      1
    );

  // Heavy SUV acceleration.

  const engineAcceleration =
    throttleInput *
    18 *
    (
      1 -
      speedRatio *
      0.72
    );

  // Braking.

  const brakingDeceleration =
    brakeInput *
    32;

  speedMph +=
    (
      engineAcceleration -
      brakingDeceleration
    ) *
    delta;

  // Drag.

  speedMph -=
    speedMph *
    playerPhysics.drag *
    0.002 *
    delta;

  // Rolling resistance.

  speedMph -=
    playerPhysics.rollingResistance *
    delta;

  speedMph =
    THREE.MathUtils.clamp(
      speedMph,
      0,
      playerPhysics.maximumSpeedMph
    );

  // ------------------------------------------------
  // STEERING
  // ------------------------------------------------

  const speedSteeringFactor =
    THREE.MathUtils.clamp(
      1 -
        speedRatio *
          0.48,
      0.42,
      1
    );

  const steeringForce =
    steeringInput *
    playerPhysics.steeringSensitivity *
    speedSteeringFactor *
    (
      speedMph /
      18
    );

  lateralVelocity +=
    steeringForce *
    delta;

  // Tire grip / understeer.

  lateralVelocity *=
    Math.pow(
      playerPhysics.tireGrip,
      delta
    );

  // Steering inertia.

  lateralVelocity *=
    playerPhysics.steeringInertia;

  player.position.x +=
    lateralVelocity;

  // Keep vehicle on highway.

  player.position.x =
    THREE.MathUtils.clamp(
      player.position.x,
      -6.9,
      6.9
    );

  // ------------------------------------------------
  // BODY ROLL
  // ------------------------------------------------

  const targetRoll =
    -steeringInput *
    speedRatio *
    playerPhysics.bodyRollAmount;

  player.rotation.z =
    THREE.MathUtils.lerp(
      player.rotation.z,
      targetRoll,
      4 * delta
    );

  // ------------------------------------------------
  // SUSPENSION / CAMERA
  // ------------------------------------------------

  const accelerationMovement =
    throttleInput *
    0.012;

  const brakingMovement =
    brakeInput *
    -0.018;

  const vibration =
    Math.sin(
      performance.now() *
      0.018
    ) *
    0.0035 *
    speedRatio;

  camera.position.y =
    THREE.MathUtils.lerp(
      camera.position.y,
      1.42 +
        accelerationMovement +
        brakingMovement +
        vibration,
      5 * delta
    );

  camera.rotation.z =
    THREE.MathUtils.lerp(
      camera.rotation.z,
      -steeringInput *
        speedRatio *
        0.014,
      4 * delta
    );

  // ------------------------------------------------
  // DISTANCE
  // ------------------------------------------------

  distanceMiles +=
    speedMph *
    delta /
    3600;

  survivalSeconds +=
    delta;

  // ------------------------------------------------
  // SCORE
  // ------------------------------------------------

  const speedMultiplier =
    THREE.MathUtils.clamp(
      speedMph / 65,
      0,
      1.8
    );

  const speedReward =
    8 +
    speedMultiplier *
      10;

  score +=
    speedReward *
    delta;
}

// --------------------------------------------------
// COLLISION DETECTION
// --------------------------------------------------

function checkCollisions(): void {

  for (
    const vehicle of
      trafficVehicles
  ) {

    const dx =
      Math.abs(
        player.position.x -
        vehicle.mesh.position.x
      );

    const dz =
      Math.abs(
        player.position.z -
        vehicle.mesh.position.z
      );

    const width =
      vehicle.type === "semi"
        ? 2.2
        : 1.9;

    const length =
      vehicle.type === "semi"
        ? 6.2
        : 3.3;

    if (
      dx < width &&
      dz < length
    ) {

      const severe =
        speedMph >= 50;

      endGame(
        severe
          ? "Severe collision"
          : "Vehicle collision"
      );

      return;
    }
  }
}

// --------------------------------------------------
// HUD
// --------------------------------------------------

const hud =
  document.createElement(
    "div"
  );

hud.id = "hud";

hud.innerHTML = `
  <div class="hud-item">
    <span>SPEED</span>
    <strong id="speed">0 MPH</strong>
  </div>

  <div class="hud-item">
    <span>LIMIT</span>
    <strong>65</strong>
  </div>

  <div class="hud-item">
    <span>DISTANCE</span>
    <strong id="distance">0.00 MI</strong>
  </div>

  <div class="hud-item">
    <span>TIME</span>
    <strong id="time">00:00</strong>
  </div>

  <div class="hud-item">
    <span>SCORE</span>
    <strong id="score">0</strong>
  </div>

  <div class="hud-item">
    <span>CHP</span>
    <strong id="chp">NORMAL</strong>
  </div>
`;

document.body.appendChild(hud);

// --------------------------------------------------
// GAME OVER SCREEN
// --------------------------------------------------

const gameOverScreen =
  document.createElement(
    "div"
  );

gameOverScreen.id =
  "game-over";

gameOverScreen.innerHTML = `
  <div class="game-over-panel">

    <h1>RUN OVER</h1>

    <p id="failure-reason">
      Vehicle collision
    </p>

    <p>
      FINAL SCORE:
      <strong id="final-score">
        0
      </strong>
    </p>

    <p>
      DISTANCE:
      <strong id="final-distance">
        0.00 MI
      </strong>
    </p>

    <p>
      SURVIVAL:
      <strong id="final-time">
        00:00
      </strong>
    </p>

    <p>
      Press R to restart
    </p>

  </div>
`;

document.body.appendChild(
  gameOverScreen
);

// --------------------------------------------------
// END GAME
// --------------------------------------------------

function endGame(
  reason: string
): void {

  if (gameOver) {
    return;
  }

  gameOver =
    true;

  gameOverReason =
    reason;

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

  if (reasonElement) {
    reasonElement.textContent =
      reason;
  }

  if (scoreElement) {
    scoreElement.textContent =
      Math.floor(
        score
      ).toLocaleString();
  }

  if (distanceElement) {
    distanceElement.textContent =
      `${distanceMiles.toFixed(
        2
      )} MI`;
  }

  if (timeElement) {

    const minutes =
      Math.floor(
        survivalSeconds /
          60
      );

    const seconds =
      Math.floor(
        survivalSeconds %
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

// --------------------------------------------------
// RESTART
// --------------------------------------------------

function restartGame(): void {

  speedMph = 0;

  lateralVelocity = 0;

  distanceMiles = 0;

  survivalSeconds = 0;

  score = 0;

  gameOver = false;

  paused = false;

  gameOverReason = "";

  player.position.set(
    0,
    0,
    0
  );

  player.rotation.set(
    0,
    0,
    0
  );

  trafficVehicles.forEach(
    (vehicle) => {

      vehicle.mesh.position.z =
        -100 -
        Math.random() *
          900;

      vehicle.lane =
        Math.floor(
          Math.random() *
          NUMBER_OF_LANES
        );

      vehicle.mesh.position.x =
        -ROAD_WIDTH / 2 +
        vehicle.lane *
          LANE_WIDTH +
        LANE_WIDTH / 2;
    }
  );

  gameOverScreen.style.display =
    "none";
}

// --------------------------------------------------
// UPDATE HUD
// --------------------------------------------------

function updateHUD(): void {

  const speedElement =
    document.getElementById(
      "speed"
    );

  const distanceElement =
    document.getElementById(
      "distance"
    );

  const timeElement =
    document.getElementById(
      "time"
    );

  const scoreElement =
    document.getElementById(
      "score"
    );

  if (speedElement) {
    speedElement.textContent =
      `${Math.round(
        speedMph
      )} MPH`;
  }

  if (distanceElement) {
    distanceElement.textContent =
      `${distanceMiles.toFixed(
        2
      )} MI`;
  }

  if (timeElement) {

    const minutes =
      Math.floor(
        survivalSeconds /
          60
      );

    const seconds =
      Math.floor(
        survivalSeconds %
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

  if (scoreElement) {
    scoreElement.textContent =
      Math.floor(
        score
      ).toLocaleString();
  }
}

// --------------------------------------------------
// START
// --------------------------------------------------

async function startGame(): Promise<void> {

  try {
    await initializePhysics();

    animate();

  } catch (error) {

    console.error(
      "Unable to initialize physics:",
      error
    );

    const message =
      document.createElement(
        "div"
      );

    message.style.position =
      "fixed";

    message.style.top = "20px";

    message.style.left = "20px";

    message.style.color =
      "white";

    message.style.background =
      "rgba(150,0,0,.8)";

    message.style.padding =
      "15px";

    message.textContent =
      "Physics initialization failed.";

    document.body.appendChild(
      message
    );
  }
}

// --------------------------------------------------
// MAIN LOOP
// --------------------------------------------------

let previousTime =
  performance.now();

function animate(): void {

  requestAnimationFrame(
    animate
  );

  const currentTime =
    performance.now();

  const delta =
    Math.min(
      (
        currentTime -
        previousTime
      ) / 1000,
      0.05
    );

  previousTime =
    currentTime;

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

  // Rapier simulation.

  if (physicsWorld) {
    physicsWorld.step();
  }

  updatePlayer(
    delta
  );

  updateTraffic(
    delta
  );

  checkCollisions();

  updateHUD();

  renderer.render(
    scene,
    camera
  );
}

// --------------------------------------------------
// RESIZE
// --------------------------------------------------

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

// --------------------------------------------------
// START GAME
// --------------------------------------------------

startGame();
