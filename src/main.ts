import * as THREE from "three";
import "./style.css";

/* =========================================================
   I-80 HIGHWAY DRIVING — HIGH DETAIL VERSION
   Three.js + TypeScript

   FIXES:
   - Terrain never covers the highway
   - Reliable oncoming traffic
   - 60+ traffic vehicle variants
   - Faster lane changes
   - More sensitive steering
   - Detailed player car
   - Procedural roadside scenery
   - Camera permanently attached to vehicle
   ========================================================= */

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x79afe0);
scene.fog = new THREE.Fog(0x79afe0, 160, 1000);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.03,
  1800
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
  Math.min(window.devicePixelRatio, 2)
);

renderer.shadowMap.enabled = true;
renderer.shadowMap.type =
  THREE.PCFSoftShadowMap;

renderer.outputColorSpace =
  THREE.SRGBColorSpace;

renderer.toneMapping =
  THREE.ACESFilmicToneMapping;

renderer.toneMappingExposure = 1.08;

document.body.appendChild(
  renderer.domElement
);

/* =========================================================
   LIGHTING
   ========================================================= */

const hemi =
  new THREE.HemisphereLight(
    0xc9e4ff,
    0x3b4c2e,
    2.2
  );

scene.add(hemi);

const sun =
  new THREE.DirectionalLight(
    0xfff1cf,
    3.4
  );

sun.position.set(
  -180,
  300,
  100
);

sun.castShadow = true;

sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

sun.shadow.camera.left = -350;
sun.shadow.camera.right = 350;
sun.shadow.camera.top = 350;
sun.shadow.camera.bottom = -350;

sun.shadow.camera.near = 1;
sun.shadow.camera.far = 900;

scene.add(sun);

/* =========================================================
   CONSTANTS
   ========================================================= */

const ROAD_WIDTH = 16;
const LANE_WIDTH = 4;
const LANE_COUNT = 4;

const LANES = [-6, -2, 2, 6];

const PLAYER_Y = 0.45;

const MAX_FORWARD_SPEED = 72;
const CRUISE_SPEED = 58;

/*
   Increased from the original.
   The car responds more quickly to steering.
*/
const STEERING_SPEED = 13.5;

/*
   Much faster lane changes.
*/
const LANE_CHANGE_SPEED = 18.0;

const ROAD_SEGMENT_LENGTH = 100;

/*
   More traffic.
*/
const TRAFFIC_COUNT = 56;

/*
   Much more scenery.
*/
const SCENERY_COUNT = 360;

/* =========================================================
   PLAYER STATE
   ========================================================= */

let playerX = 0;
let playerZ = 0;

let velocityX = 0;
let velocityZ = 0;

let steeringInput = 0;
let throttleInput = 0;
let brakeInput = 0;

let currentSpeed = 0;

let targetLane = 1;

let steeringWheelAngle = 0;

let survivalTime = 0;
let distanceMiles = 0;
let score = 0;

let gameOver = false;

let crashReason = "";

/* =========================================================
   INPUT
   ========================================================= */

const keys: Record<string, boolean> = {};

window.addEventListener(
  "keydown",
  (event) => {
    keys[
      event.key.toLowerCase()
    ] = true;

    if (
      [
        "arrowup",
        "arrowdown",
        "arrowleft",
        "arrowright",
        " ",
      ].includes(
        event.key.toLowerCase()
      )
    ) {
      event.preventDefault();
    }

    if (
      event.key.toLowerCase() ===
        "r" &&
      gameOver
    ) {
      location.reload();
    }
  }
);

window.addEventListener(
  "keyup",
  (event) => {
    keys[
      event.key.toLowerCase()
    ] = false;
  }
);

/* =========================================================
   MATERIAL HELPERS
   ========================================================= */

function material(
  color: number,
  roughness = 0.8,
  metalness = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial(
    {
      color,
      roughness,
      metalness,
    }
  );
}

function glassMaterial(
  color = 0x15252e
): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial(
    {
      color,
      roughness: 0.08,
      metalness: 0.2,
      transparent: true,
      opacity: 0.62,
      clearcoat: 0.8,
      clearcoatRoughness: 0.08,
    }
  );
}

/* =========================================================
   WORLD
   ========================================================= */

const world =
  new THREE.Group();

scene.add(world);

/* =========================================================
   ROAD
   ========================================================= */

const roadMaterial =
  material(
    0x292c31,
    0.93
  );

const road =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      ROAD_WIDTH,
      0.15,
      5000
    ),
    roadMaterial
  );

road.position.set(
  0,
  -0.15,
  -1800
);

road.receiveShadow = true;

world.add(road);

/* =========================================================
   ROAD SHOULDER
   ========================================================= */

const shoulderMaterial =
  material(
    0x747670,
    0.9
  );

const leftShoulder =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      3.2,
      0.12,
      5000
    ),
    shoulderMaterial
  );

leftShoulder.position.set(
  -9.6,
  -0.11,
  -1800
);

world.add(
  leftShoulder
);

const rightShoulder =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      3.2,
      0.12,
      5000
    ),
    shoulderMaterial
  );

rightShoulder.position.set(
  9.6,
  -0.11,
  -1800
);

world.add(
  rightShoulder
);

/* =========================================================
   LANE MARKINGS
   ========================================================= */

const lineMaterial =
  new THREE.MeshBasicMaterial(
    {
      color: 0xf4f4e8,
    }
  );

for (const x of [
  -4,
  0,
  4,
]) {
  for (
    let z = -3500;
    z < 500;
    z += 12
  ) {
    const line =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.12,
          0.025,
          6
        ),
        lineMaterial
      );

    line.position.set(
      x,
      -0.04,
      z
    );

    world.add(line);
  }
}

/* =========================================================
   ROAD EDGE LINES
   ========================================================= */

const yellowLine =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.18,
      0.035,
      5000
    ),
    new THREE.MeshBasicMaterial(
      {
        color: 0xf1c72d,
      }
    )
  );

yellowLine.position.set(
  -7.85,
  -0.03,
  -1800
);

world.add(
  yellowLine
);

const whiteEdge =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.15,
      0.035,
      5000
    ),
    lineMaterial
  );

whiteEdge.position.set(
  7.85,
  -0.03,
  -1800
);

world.add(
  whiteEdge
);

/* =========================================================
   TERRAIN
   IMPORTANT:
   Terrain starts OUTSIDE the highway.
   It no longer uses giant slabs that overlap the road.
   ========================================================= */

const terrainGroup =
  new THREE.Group();

world.add(
  terrainGroup
);

const terrainMaterial =
  material(
    0x4d6b3b,
    1
  );

/*
   LEFT terrain begins at x=-32.
   RIGHT terrain begins at x=32.
*/
const terrainLeft =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      44,
      0.5,
      5000
    ),
    terrainMaterial
  );

terrainLeft.position.set(
  -54,
  -0.4,
  -1800
);

terrainLeft.receiveShadow =
  true;

terrainGroup.add(
  terrainLeft
);

const terrainRight =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      44,
      0.5,
      5000
    ),
    terrainMaterial
  );

terrainRight.position.set(
  54,
  -0.4,
  -1800
);

terrainRight.receiveShadow =
  true;

terrainGroup.add(
  terrainRight
);

/* =========================================================
   DIRT STRIPS
   ========================================================= */

const dirtMaterial =
  material(
    0x756445,
    1
  );

const dirtLeft =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      12,
      0.08,
      5000
    ),
    dirtMaterial
  );

dirtLeft.position.set(
  -18,
  -0.08,
  -1800
);

world.add(dirtLeft);

const dirtRight =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      12,
      0.08,
      5000
    ),
    dirtMaterial
  );

dirtRight.position.set(
  18,
  -0.08,
  -1800
);

world.add(dirtRight);

/* =========================================================
   HILLS
   ========================================================= */

const hills =
  new THREE.Group();

function createHill(
  x: number,
  z: number,
  scale: number,
  color: number
): THREE.Mesh {
  const hill =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        1,
        28,
        18
      ),
      material(
        color,
        1
      )
    );

  hill.scale.set(
    scale * 2.8,
    scale * 1.4,
    scale
  );

  hill.position.set(
    x,
    scale * 0.42,
    z
  );

  hill.castShadow = true;
  hill.receiveShadow = true;

  return hill;
}

for (
  let i = 0;
  i < 65;
  i++
) {
  const side =
    Math.random() < 0.5
      ? -1
      : 1;

  hills.add(
    createHill(
      side *
        (55 +
          Math.random() *
            350),
      -Math.random() *
        3200,
      18 +
        Math.random() *
          80,
      Math.random() <
        0.5
        ? 0x435d37
        : 0x506c3d
    )
  );
}

world.add(hills);

/* =========================================================
   TREES
   ========================================================= */

function createTree(): THREE.Group {
  const tree =
    new THREE.Group();

  const trunk =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.16,
        0.3,
        2.6,
        9
      ),
      material(
        0x5a3b24,
        1
      )
    );

  trunk.position.y = 1.3;

  trunk.castShadow = true;

  tree.add(trunk);

  const foliageColor =
    [
      0x274b2b,
      0x315b31,
      0x3d6937,
      0x416e38,
      0x234326,
    ][
      Math.floor(
        Math.random() * 5
      )
    ];

  const foliage =
    new THREE.Group();

  for (
    let i = 0;
    i < 3;
    i++
  ) {
    const cone =
      new THREE.Mesh(
        new THREE.ConeGeometry(
          1.45 -
            i * 0.25 +
            Math.random() *
              0.25,
          2.3,
          9
        ),
        material(
          foliageColor,
          1
        )
      );

    cone.position.y =
      2.2 +
      i * 0.9;

    cone.castShadow =
      true;

    foliage.add(
      cone
    );
  }

  tree.add(
    foliage
  );

  return tree;
}

/* =========================================================
   SHRUB
   ========================================================= */

function createShrub(): THREE.Group {
  const shrub =
    new THREE.Group();

  const bush =
    new THREE.Mesh(
      new THREE.SphereGeometry(
        0.7 +
          Math.random() *
            0.6,
        10,
        8
      ),
      material(
        0x345d32,
        1
      )
    );

  bush.scale.y =
    0.7;

  bush.position.y =
    0.55;

  bush.castShadow =
    true;

  shrub.add(
    bush
  );

  return shrub;
}

/* =========================================================
   ROCK
   ========================================================= */

function createRock(): THREE.Mesh {
  const rock =
    new THREE.Mesh(
      new THREE.DodecahedronGeometry(
        0.7 +
          Math.random(),
        0
      ),
      material(
        0x68655a,
        1
      )
    );

  rock.scale.y =
    0.65;

  rock.castShadow =
    true;

  return rock;
}

/* =========================================================
   SCENERY GROUP
   ========================================================= */

const scenery =
  new THREE.Group();

world.add(
  scenery
);

for (
  let i = 0;
  i < SCENERY_COUNT;
  i++
) {
  const side =
    Math.random() < 0.5
      ? -1
      : 1;

  const distance =
    17 +
    Math.random() *
      105;

  const random =
    Math.random();

  let object:
    | THREE.Object3D;

  if (
    random < 0.72
  ) {
    object =
      createTree();
  } else if (
    random < 0.92
  ) {
    object =
      createShrub();
  } else {
    object =
      createRock();
  }

  object.position.set(
    side * distance,
    0,
    -Math.random() *
      3200
  );

  const scale =
    0.65 +
    Math.random() *
      1.8;

  object.scale.setScalar(
    scale
  );

  scenery.add(
    object
  );
}

/* =========================================================
   ROAD BARRIERS
   ========================================================= */

function createBarrier(
  x: number,
  z: number
): THREE.Group {
  const group =
    new THREE.Group();

  const barrier =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.65,
        1.05,
        20
      ),
      material(
        0x92938f,
        0.7,
        0.3
      )
    );

  barrier.position.y =
    0.45;

  barrier.castShadow =
    true;

  group.add(
    barrier
  );

  for (
    let i = -9;
    i <= 9;
    i += 3
  ) {
    const reflector =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.12,
          0.18,
          0.08
        ),
        material(
          0xf5f1c8,
          0.3,
          0.2
        )
      );

    reflector.position.set(
      x > 0
        ? -0.36
        : 0.36,
      0.6,
      i
    );

    group.add(
      reflector
    );
  }

  group.position.set(
    x,
    0,
    z
  );

  return group;
}

for (
  let z = -3500;
  z < 300;
  z += 20
) {
  world.add(
    createBarrier(
      -9.5,
      z
    )
  );

  world.add(
    createBarrier(
      9.5,
      z
    )
  );
}

/* =========================================================
   PLAYER VEHICLE
   ========================================================= */

const playerCar =
  new THREE.Group();

world.add(
  playerCar
);

/* =========================================================
   PLAYER BODY
   ========================================================= */

const bodyMaterial =
  new THREE.MeshPhysicalMaterial(
    {
      color: 0x25282d,
      roughness: 0.22,
      metalness: 0.65,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    }
  );

const body =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.3,
      0.8,
      4.8
    ),
    bodyMaterial
  );

body.position.y =
  0.75;

body.castShadow =
  true;

playerCar.add(
  body
);

/* =========================================================
   LOWER BODY / SIDE SKIRTS
   ========================================================= */

const lowerBody =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.38,
      0.25,
      4.5
    ),
    material(
      0x121417,
      0.35,
      0.65
    )
  );

lowerBody.position.y =
  0.43;

lowerBody.castShadow =
  true;

playerCar.add(
  lowerBody
);

/* =========================================================
   HOOD
   ========================================================= */

const hood =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.15,
      0.2,
      1.55
    ),
    bodyMaterial
  );

hood.position.set(
  0,
  1.08,
  -1.72
);

hood.castShadow =
  true;

playerCar.add(
  hood
);

/* =========================================================
   HOOD CENTER LINE
   ========================================================= */

const hoodLine =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.035,
      0.015,
      1.3
    ),
    material(
      0x55585d,
      0.25,
      0.4
    )
  );

hoodLine.position.set(
  0,
  1.19,
  -1.72
);

playerCar.add(
  hoodLine
);

/* =========================================================
   CABIN
   ========================================================= */

const cabin =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.02,
      1.08,
      2.45
    ),
    material(
      0x111316,
      0.2,
      0.5
    )
  );

cabin.position.set(
  0,
  1.34,
  0.25
);

cabin.castShadow =
  true;

playerCar.add(
  cabin
);

/* =========================================================
   WINDOWS
   ========================================================= */

const glass =
  glassMaterial();

const windshield =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      1.72,
      0.78
    ),
    glass
  );

windshield.position.set(
  0,
  1.56,
  -1.0
);

windshield.rotation.x =
  -0.12;

playerCar.add(
  windshield
);

function createSideWindow(
  x: number
): THREE.Mesh {
  const window =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        0.88,
        0.72
      ),
      glass
    );

  window.position.set(
    x,
    1.52,
    0.2
  );

  window.rotation.y =
    x > 0
      ? -Math.PI / 2
      : Math.PI / 2;

  return window;
}

playerCar.add(
  createSideWindow(-1.025)
);

playerCar.add(
  createSideWindow(1.025)
);

/* =========================================================
   REAR WINDOW
   ========================================================= */

const rearWindow =
  new THREE.Mesh(
    new THREE.PlaneGeometry(
      1.7,
      0.72
    ),
    glass
  );

rearWindow.position.set(
  0,
  1.54,
  1.48
);

rearWindow.rotation.y =
  Math.PI;

playerCar.add(
  rearWindow
);

/* =========================================================
   FRONT GRILLE
   ========================================================= */

const grille =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      1.0,
      0.25,
      0.08
    ),
    material(
      0x050608,
      0.2,
      0.8
    )
  );

grille.position.set(
  0,
  0.67,
  -2.43
);

playerCar.add(
  grille
);

for (
  let i = -4;
  i <= 4;
  i++
) {
  const grilleBar =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.035,
        0.2,
        0.1
      ),
      material(
        0x6e7378,
        0.2,
        0.8
      )
    );

  grilleBar.position.set(
    i * 0.11,
    0.67,
    -2.48
  );

  playerCar.add(
    grilleBar
  );
}

/* =========================================================
   HEADLIGHTS
   ========================================================= */

function createHeadlight(
  x: number
): THREE.Mesh {
  const light =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.52,
        0.22,
        0.08
      ),
      new THREE.MeshPhysicalMaterial(
        {
          color: 0xffffe2,
          emissive: 0xffffd0,
          emissiveIntensity: 2.2,
          roughness: 0.15,
          metalness: 0.1,
          clearcoat: 1,
        }
      )
    );

  light.position.set(
    x,
    0.86,
    -2.43
  );

  return light;
}

playerCar.add(
  createHeadlight(-0.72)
);

playerCar.add(
  createHeadlight(0.72)
);

/* =========================================================
   FRONT BUMPER
   ========================================================= */

const frontBumper =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.25,
      0.3,
      0.22
    ),
    material(
      0x111316,
      0.3,
      0.55
    )
  );

frontBumper.position.set(
  0,
  0.45,
  -2.43
);

playerCar.add(
  frontBumper
);

/* =========================================================
   SIDE MIRRORS
   ========================================================= */

function createMirror(
  x: number
): THREE.Group {
  const mirror =
    new THREE.Group();

  const stem =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.1,
        0.1,
        0.34
      ),
      material(
        0x111315,
        0.25,
        0.65
      )
    );

  mirror.add(
    stem
  );

  const housing =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.3,
        0.22,
        0.48
      ),
      material(
        0x17191c,
        0.22,
        0.65
      )
    );

  housing.position.x =
    x > 0
      ? 0.16
      : -0.16;

  mirror.add(
    housing
  );

  const mirrorGlass =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.03,
        0.14,
        0.3
      ),
      glassMaterial(
        0x253b45
      )
    );

  mirrorGlass.position.x =
    x > 0
      ? 0.32
      : -0.32;

  mirror.add(
    mirrorGlass
  );

  mirror.position.set(
    x,
    1.45,
    -0.2
  );

  return mirror;
}

playerCar.add(
  createMirror(-1.2)
);

playerCar.add(
  createMirror(1.2)
);

/* =========================================================
   WHEELS
   ========================================================= */

function createWheel(): THREE.Group {
  const wheel =
    new THREE.Group();

  const tire =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.43,
        0.43,
        0.26,
        24
      ),
      material(
        0x090a0b,
        0.96
      )
    );

  tire.rotation.z =
    Math.PI / 2;

  tire.castShadow =
    true;

  wheel.add(
    tire
  );

  const rim =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.25,
        0.25,
        0.28,
        20
      ),
      material(
        0xbfc4c7,
        0.18,
        0.92
      )
    );

  rim.rotation.z =
    Math.PI / 2;

  wheel.add(
    rim
  );

  const hub =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        0.08,
        0.08,
        0.3,
        12
      ),
      material(
        0x33383d,
        0.2,
        0.9
      )
    );

  hub.rotation.z =
    Math.PI / 2;

  wheel.add(
    hub
  );

  return wheel;
}

const frontLeftWheel =
  createWheel();

const frontRightWheel =
  createWheel();

const rearLeftWheel =
  createWheel();

const rearRightWheel =
  createWheel();

frontLeftWheel.position.set(
  -1.12,
  0.45,
  -1.48
);

frontRightWheel.position.set(
  1.12,
  0.45,
  -1.48
);

rearLeftWheel.position.set(
  -1.12,
  0.45,
  1.48
);

rearRightWheel.position.set(
  1.12,
  0.45,
  1.48
);

playerCar.add(
  frontLeftWheel,
  frontRightWheel,
  rearLeftWheel,
  rearRightWheel
);

/* =========================================================
   BRAKE LIGHTS
   ========================================================= */

for (const x of [
  -0.72,
  0.72,
]) {
  const brakeLight =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.5,
        0.16,
        0.08
      ),
      new THREE.MeshPhysicalMaterial(
        {
          color: 0xff1616,
          emissive: 0xff0000,
          emissiveIntensity: 0.7,
        }
      )
    );

  brakeLight.position.set(
    x,
    0.82,
    2.43
  );

  playerCar.add(
    brakeLight
  );
}

/* =========================================================
   COCKPIT
   IMPORTANT:
   Steering wheel is inside the cabin.
   ========================================================= */

const cockpit =
  new THREE.Group();

playerCar.add(
  cockpit
);

/* Dashboard */

const dashboard =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      2.02,
      0.34,
      0.68
    ),
    material(
      0x101214,
      0.65
    )
  );

dashboard.position.set(
  0,
  1.13,
  -0.76
);

cockpit.add(
  dashboard
);

/* Dashboard trim */

const dashTrim =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      1.8,
      0.035,
      0.035
    ),
    material(
      0x73777b,
      0.25,
      0.7
    )
  );

dashTrim.position.set(
  0,
  1.31,
  -1.08
);

cockpit.add(
  dashTrim
);

/* Steering wheel */

const steeringWheel =
  new THREE.Group();

const wheelRing =
  new THREE.Mesh(
    new THREE.TorusGeometry(
      0.32,
      0.055,
      12,
      40
    ),
    material(
      0x090a0b,
      0.35,
      0.5
    )
  );

wheelRing.rotation.x =
  Math.PI / 2;

steeringWheel.add(
  wheelRing
);

const wheelHub =
  new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.11,
      0.11,
      0.075,
      20
    ),
    material(
      0x303438,
      0.4,
      0.6
    )
  );

wheelHub.rotation.x =
  Math.PI / 2;

steeringWheel.add(
  wheelHub
);

/*
   This is deliberately positioned
   deep inside the cabin, NOT on the hood.
*/
steeringWheel.position.set(
  -0.48,
  1.28,
  -0.72
);

cockpit.add(
  steeringWheel
);

/* Steering spokes */

for (
  let i = 0;
  i < 3;
  i++
) {
  const spoke =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.045,
        0.38,
        0.055
      ),
      material(
        0x202326,
        0.3,
        0.6
      )
    );

  spoke.rotation.z =
    (i / 3) *
      Math.PI *
      2;

  spoke.position.set(
    -0.48,
    1.28,
    -0.72
  );

  cockpit.add(
    spoke
  );
}

/* Instrument cluster */

const instrument =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.88,
      0.28,
      0.08
    ),
    material(
      0x050607,
      0.5
    )
  );

instrument.position.set(
  -0.48,
  1.45,
  -0.88
);

cockpit.add(
  instrument
);

/* =========================================================
   CAMERA
   ========================================================= */

const cameraRig =
  new THREE.Group();

playerCar.add(
  cameraRig
);

cameraRig.position.set(
  0,
  1.63,
  0.72
);

cameraRig.add(
  camera
);

camera.position.set(
  0,
  0,
  0
);

camera.rotation.set(
  0,
  0,
  0
);

/* =========================================================
   TRAFFIC TYPES
   ========================================================= */

type TrafficType =
  | "sedan"
  | "suv"
  | "pickup"
  | "sports"
  | "van"
  | "wagon"
  | "coupe"
  | "hatchback"
  | "muscle"
  | "semi";

interface TrafficVehicle {
  group: THREE.Group;
  type: TrafficType;
  lane: number;
  targetLane: number;
  speed: number;
  desiredSpeed: number;
  changeTimer: number;
  variant: number;
}

/* =========================================================
   TRAFFIC STORAGE
   ========================================================= */

const traffic: TrafficVehicle[] =
  [];

/* =========================================================
   RANDOM VEHICLE TYPES
   ========================================================= */

function randomVehicleType(): TrafficType {
  const types: TrafficType[] = [
    "sedan",
    "sedan",
    "sedan",
    "suv",
    "suv",
    "pickup",
    "pickup",
    "sports",
    "van",
    "wagon",
    "coupe",
    "hatchback",
    "muscle",
    "semi",
  ];

  return types[
    Math.floor(
      Math.random() *
        types.length
    )
  ];
}

/* =========================================================
   TRAFFIC COLORS
   ========================================================= */

const trafficColors = [
  0xffffff,
  0xf2f2ee,
  0x111214,
  0x1c2733,
  0x263b52,
  0x8b1e24,
  0xb32929,
  0x173e70,
  0x37658a,
  0x5b5b5b,
  0x767676,
  0x999999,
  0xc5c5c0,
  0xd8d0b6,
  0x40533d,
  0x29332d,
  0x533d31,
  0x735a45,
  0x4a4a4a,
  0x252525,
];

/* =========================================================
   TRAFFIC CREATOR
   ========================================================= */

function createTrafficVehicle(
  type: TrafficType,
  color: number
): THREE.Group {
  const car =
    new THREE.Group();

  let width = 1.78;
  let height = 0.76;
  let length = 4.1;

  switch (type) {
    case "suv":
      width = 1.95;
      height = 1.05;
      length = 4.45;
      break;

    case "pickup":
      width = 1.95;
      height = 0.95;
      length = 4.8;
      break;

    case "sports":
      width = 1.82;
      height = 0.58;
      length = 4.15;
      break;

    case "van":
      width = 1.95;
      height = 1.38;
      length = 4.7;
      break;

    case "wagon":
      width = 1.82;
      height = 0.85;
      length = 4.5;
      break;

    case "coupe":
      width = 1.8;
      height = 0.65;
      length = 4.1;
      break;

    case "hatchback":
      width = 1.75;
      height = 0.8;
      length = 3.8;
      break;

    case "muscle":
      width = 1.9;
      height = 0.7;
      length = 4.7;
      break;

    case "semi":
      width = 2.38;
      height = 3.2;
      length = 9;
      break;
  }

  const paint =
    new THREE.MeshPhysicalMaterial(
      {
        color,
        roughness:
          0.22 +
          Math.random() *
            0.12,
        metalness:
          0.38 +
          Math.random() *
            0.3,
        clearcoat: 0.8,
        clearcoatRoughness: 0.12,
      }
    );

  /* Main body */

  const base =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        height,
        length
      ),
      paint
    );

  base.position.y =
    type === "semi"
      ? 1.45
      : 0.68;

  base.castShadow =
    true;

  car.add(
    base
  );

  /* Non-semi cabin */

  if (
    type !== "semi"
  ) {
    const cabinHeight =
      type === "van"
        ? 1.1
        : type === "sports"
        ? 0.48
        : 0.72;

    const cabinLength =
      type === "pickup"
        ? 1.75
        : type === "hatchback"
        ? 1.75
        : 2.0;

    const cabin =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width *
            0.86,
          cabinHeight,
          cabinLength
        ),
        glassMaterial(
          0x182831
        )
      );

    cabin.position.set(
      0,
      base.position.y +
        height *
          0.52,
      0.15
    );

    cabin.castShadow =
      true;

    car.add(
      cabin
    );

    /* Roof */

    const roof =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width * 0.78,
          0.12,
          cabinLength *
            0.72
        ),
        paint
      );

    roof.position.set(
      0,
      cabin.position.y +
        cabinHeight *
          0.48,
      0.12
    );

    car.add(
      roof
    );
  } else {
    /* Semi cab */

    const cab =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width,
          2.25,
          2.5
        ),
        paint
      );

    cab.position.set(
      0,
      2.0,
      -3.15
    );

    cab.castShadow =
      true;

    car.add(
      cab
    );

    const trailer =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          2.32,
          3.15,
          6.4
        ),
        material(
          Math.random() <
            0.7
            ? 0xd6d6d1
            : color,
          0.72,
          0.05
        )
      );

    trailer.position.set(
      0,
      1.72,
      0.9
    );

    trailer.castShadow =
      true;

    car.add(
      trailer
    );

    /* Trailer rear details */

    const trailerStripe =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          2.25,
          0.18,
          0.05
        ),
        material(
          0xc02020,
          0.5
        )
      );

    trailerStripe.position.set(
      0,
      0.82,
      4.13
    );

    car.add(
      trailerStripe
    );
  }

  /* =======================================================
     WINDOWS
     ======================================================= */

  if (
    type !== "semi"
  ) {
    const frontWindow =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          width * 0.72,
          0.42
        ),
        glassMaterial(
          0x10212a
        )
      );

    frontWindow.position.set(
      0,
      base.position.y +
        height *
          0.57,
      -length *
        0.2
    );

    frontWindow.rotation.x =
      -0.05;

    car.add(
      frontWindow
    );

    const rearWindow =
      new THREE.Mesh(
        new THREE.PlaneGeometry(
          width * 0.7,
          0.4
        ),
        glassMaterial(
          0x0e1d25
        )
      );

    rearWindow.position.set(
      0,
      base.position.y +
        height *
          0.57,
      length *
        0.35
    );

    rearWindow.rotation.y =
      Math.PI;

    car.add(
      rearWindow
    );
  }

  /* =======================================================
     WHEELS
     ======================================================= */

  if (
    type !== "semi"
  ) {
    for (const x of [
      -width / 2,
      width / 2,
    ]) {
      for (const z of [
        -length * 0.31,
        length * 0.31,
      ]) {
        const tire =
          new THREE.Mesh(
            new THREE.CylinderGeometry(
              0.34,
              0.34,
              0.24,
              16
            ),
            material(
              0x0a0b0c,
              0.95
            )
          );

        tire.rotation.z =
          Math.PI / 2;

        tire.position.set(
          x,
          0.4,
          z
        );

        tire.castShadow =
          true;

        car.add(
          tire
        );

        const rim =
          new THREE.Mesh(
            new THREE.CylinderGeometry(
              0.18,
              0.18,
              0.25,
              12
            ),
            material(
              0x8d9397,
              0.2,
              0.8
            )
          );

        rim.rotation.z =
          Math.PI / 2;

        rim.position.set(
          x,
          0.4,
          z
        );

        car.add(
          rim
        );
      }
    }
  } else {
    /* Semi wheels */

    for (
      let axle = -1;
      axle <= 1;
      axle++
    ) {
      for (const x of [
        -width / 2,
        width / 2,
      ]) {
        const tire =
          new THREE.Mesh(
            new THREE.CylinderGeometry(
              0.46,
              0.46,
              0.3,
              16
            ),
            material(
              0x080909,
              0.98
            )
          );

        tire.rotation.z =
          Math.PI / 2;

        tire.position.set(
          x,
          0.5,
          axle * 2.5
        );

        car.add(
          tire
        );
      }
    }
  }

  /* =======================================================
     HEADLIGHTS
     ======================================================= */

  for (const x of [
    -width * 0.32,
    width * 0.32,
  ]) {
    const headlight =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          0.28,
          0.13,
          0.06
        ),
        new THREE.MeshPhysicalMaterial(
          {
            color: 0xffffdd,
            emissive: 0xfff3b0,
            emissiveIntensity: 2.2,
            roughness: 0.12,
            clearcoat: 1,
          }
        )
      );

    headlight.position.set(
      x,
      base.position.y +
        0.06,
      -length / 2 -
        0.04
    );

    car.add(
      headlight
    );
  }

  /* =======================================================
     FRONT BUMPER DETAIL
     ======================================================= */

  if (
    type !== "semi"
  ) {
    const bumper =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width *
            0.94,
          0.18,
          0.15
        ),
        material(
          0x151719,
          0.3,
          0.4
        )
      );

    bumper.position.set(
      0,
      0.48,
      -length / 2
    );

    car.add(
      bumper
    );
  }

  return car;
}

/* =========================================================
   SPAWN TRAFFIC
   ========================================================= */

function spawnTraffic(
  initial = false
): void {
  const type =
    randomVehicleType();

  const group =
    createTrafficVehicle(
      type,
      trafficColors[
        Math.floor(
          Math.random() *
            trafficColors.length
        )
      ]
    );

  /*
     CRITICAL:
     Every traffic car is spawned
     AHEAD of the player.
  */

  const lane =
    Math.floor(
      Math.random() *
        LANE_COUNT
    );

  const z =
    playerZ -
    (initial
      ? 180 +
        Math.random() *
          1900
      : 1400 +
        Math.random() *
          1200);

  group.position.set(
    LANES[lane],
    0,
    z
  );

  /*
     Traffic moves toward the player
     because it has a positive Z velocity.
  */

  const baseSpeed =
    type === "semi"
      ? 28 +
        Math.random() *
          12
      : type === "sports"
      ? 48 +
        Math.random() *
          30
      : 38 +
        Math.random() *
          28;

  world.add(
    group
  );

  traffic.push({
    group,
    type,
    lane,
    targetLane: lane,
    speed: baseSpeed,
    desiredSpeed:
      baseSpeed +
      (Math.random() *
        12 -
        6),
    changeTimer:
      2 +
      Math.random() *
        6,
    variant:
      Math.floor(
        Math.random() *
          64
      ),
  });
}

/* =========================================================
   INITIAL TRAFFIC
   ========================================================= */

for (
  let i = 0;
  i < TRAFFIC_COUNT;
  i++
) {
  spawnTraffic(true);
}

/* =========================================================
   PLAYER PHYSICS
   ========================================================= */

function updatePlayer(
  delta: number
): void {
  if (gameOver) return;

  const forward =
    keys["w"] ||
    keys["arrowup"];

  const brake =
    keys["s"] ||
    keys["arrowdown"];

  const left =
    keys["a"] ||
    keys["arrowleft"];

  const right =
    keys["d"] ||
    keys["arrowright"];

  throttleInput =
    forward ? 1 : 0;

  brakeInput =
    brake ? 1 : 0;

  steeringInput =
    (right ? 1 : 0) -
    (left ? 1 : 0);

  /* =======================================================
     STEERING
     ======================================================= */

  if (
    steeringInput !== 0
  ) {
    velocityX +=
      steeringInput *
      STEERING_SPEED *
      delta;
  } else {
    velocityX *=
      Math.pow(
        0.018,
        delta
      );
  }

  velocityX =
    THREE.MathUtils.clamp(
      velocityX,
      -LANE_CHANGE_SPEED,
      LANE_CHANGE_SPEED
    );

  /* =======================================================
     ACCELERATION
     ======================================================= */

  if (throttleInput) {
    velocityZ +=
      36 * delta;
  }

  velocityZ *=
    Math.pow(
      0.16,
      delta
    );

  if (brakeInput) {
    velocityZ -=
      65 * delta;
  }

  velocityZ =
    THREE.MathUtils.clamp(
      velocityZ,
      0,
      MAX_FORWARD_SPEED
    );

  /* =======================================================
     MOVEMENT
     ======================================================= */

  playerX +=
    velocityX *
    delta;

  playerZ -=
    velocityZ *
    delta;

  playerX =
    THREE.MathUtils.clamp(
      playerX,
      -7,
      7
    );

  currentSpeed =
    velocityZ *
    2.23694;

  /* =======================================================
     BODY LEAN
     ======================================================= */

  const desiredRoll =
    -velocityX * 0.045;

  playerCar.rotation.z +=
    (desiredRoll -
      playerCar.rotation.z) *
    Math.min(
      delta * 8,
      1
    );

  /* =======================================================
     STEERING WHEEL
     ======================================================= */

  steeringWheelAngle +=
    (steeringInput *
      0.72 -
      steeringWheelAngle) *
    Math.min(
      delta * 15,
      1
    );

  steeringWheel.rotation.z =
    -steeringWheelAngle;

  /* Front wheel steering */

  frontLeftWheel.rotation.y =
    steeringInput *
    0.38;

  frontRightWheel.rotation.y =
    steeringInput *
    0.38;

  /* =======================================================
     PLAYER POSITION
     ======================================================= */

  playerCar.position.x =
    playerX;

  playerCar.position.z =
    playerZ;

  /* =======================================================
     SUSPENSION
     ======================================================= */

  const suspension =
    Math.sin(
      performance.now() *
        0.012
    ) *
    Math.min(
      currentSpeed / 100,
      1
    ) *
    0.009;

  cameraRig.position.y =
    1.63 +
    suspension;
}

/* =========================================================
   TRAFFIC AI
   ========================================================= */

function updateTraffic(
  delta: number
): void {
  if (gameOver) return;

  for (const vehicle of traffic) {
    /* =====================================================
       SPEED
       ===================================================== */

    vehicle.speed +=
      (vehicle.desiredSpeed -
        vehicle.speed) *
      delta *
      0.5;

    /* =====================================================
       OCCASIONAL LANE CHANGE
       ===================================================== */

    vehicle.changeTimer -=
      delta;

    if (
      vehicle.changeTimer <= 0
    ) {
      vehicle.changeTimer =
        3 +
        Math.random() *
          7;

      if (
        Math.random() <
        0.28
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
          newLane >= 0 &&
          newLane <
            LANE_COUNT
        ) {
          let safe = true;

          for (
            const other of traffic
          ) {
            if (
              other ===
              vehicle
            )
              continue;

            if (
              other.lane ===
                newLane &&
              Math.abs(
                other.group
                  .position
                  .z -
                  vehicle
                    .group
                    .position
                    .z
              ) < 25
            ) {
              safe = false;
              break;
            }
          }

          if (safe) {
            vehicle.targetLane =
              newLane;
          }
        }
      }
    }

    /* =====================================================
       FAST SMOOTH LANE CHANGE
       ===================================================== */

    const targetX =
      LANES[
        vehicle.targetLane
      ];

    const laneDifference =
      targetX -
      vehicle.group
        .position.x;

    /*
       18x-ish responsiveness compared
       with the original 1.7 factor.
    */

    vehicle.group.position.x +=
      laneDifference *
      Math.min(
        delta *
          LANE_CHANGE_SPEED,
        1
      );

    if (
      Math.abs(
        laneDifference
      ) < 0.04
    ) {
      vehicle.group.position.x =
        targetX;

      vehicle.lane =
        vehicle.targetLane;
    }

    /* =====================================================
       ONCOMING TRAFFIC
       ===================================================== */

    /*
       Player moves NEGATIVE Z.

       Traffic moves POSITIVE Z.

       Therefore they physically approach
       one another.
    */

    vehicle.group.position.z +=
      vehicle.speed *
      delta;

    /* =====================================================
       SMALL VEHICLE MOTION
       ===================================================== */

    const wobble =
      Math.sin(
        performance.now() *
          0.0015 +
          vehicle.variant
      ) *
      0.006;

    vehicle.group.rotation.z =
      wobble;

    /* =====================================================
       RECYCLE AFTER PASSING PLAYER
       ===================================================== */

    if (
      vehicle.group.position.z >
      playerZ + 80
    ) {
      vehicle.group.position.z =
        playerZ -
        (1250 +
          Math.random() *
            1400);

      vehicle.lane =
        Math.floor(
          Math.random() *
            LANE_COUNT
        );

      vehicle.targetLane =
        vehicle.lane;

      vehicle.group.position.x =
        LANES[
          vehicle.lane
        ];

      vehicle.desiredSpeed =
        vehicle.type ===
        "semi"
          ? 28 +
            Math.random() *
              14
          : 38 +
            Math.random() *
              30;

      vehicle.speed =
        vehicle.desiredSpeed;

      vehicle.changeTimer =
        2 +
        Math.random() *
          7;
    }
  }
}

/* =========================================================
   SCENERY RECYCLING
   ========================================================= */

function updateScenery(): void {
  for (
    const object of scenery
      .children
  ) {
    if (
      object.position.z >
      playerZ + 100
    ) {
      const side =
        object.position.x <
        0
          ? -1
          : 1;

      object.position.z =
        playerZ -
        1300 -
        Math.random() *
          2200;

      object.position.x =
        side *
        (17 +
          Math.random() *
            105);

      object.rotation.y =
        Math.random() *
        Math.PI *
        2;

      const scale =
        0.6 +
        Math.random() *
          2;

      object.scale.setScalar(
        scale
      );
    }
  }
}

/* =========================================================
   CHP
   ========================================================= */

let chpAttention = 0;
let chpActive = false;

const chpVehicle =
  createTrafficVehicle(
    "sedan",
    0xffffff
  );

chpVehicle.visible =
  false;

world.add(
  chpVehicle
);

const lightBar =
  new THREE.Group();

const redLight =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.22,
      0.08,
      0.12
    ),
    new THREE.MeshBasicMaterial(
      {
        color: 0xff1111,
      }
    )
  );

redLight.position.x =
  -0.18;

const blueLight =
  new THREE.Mesh(
    new THREE.BoxGeometry(
      0.22,
      0.08,
      0.12
    ),
    new THREE.MeshBasicMaterial(
      {
        color: 0x2255ff,
      }
    )
  );

blueLight.position.x =
  0.18;

lightBar.add(
  redLight,
  blueLight
);

lightBar.position.y =
  1.55;

chpVehicle.add(
  lightBar
);

/* =========================================================
   HUD
   ========================================================= */

const hud =
  document.createElement(
    "div"
  );

hud.id = "hud";

hud.innerHTML = `
  <div class="hud-top">
    <div>
      <span class="label">SPEED</span>
      <span id="speed">0 MPH</span>
    </div>

    <div>
      <span class="label">LIMIT</span>
      <span>65</span>
    </div>
  </div>

  <div class="hud-bottom">
    <div>
      <span class="label">DISTANCE</span>
      <span id="distance">0.00 MI</span>
    </div>

    <div>
      <span class="label">TIME</span>
      <span id="time">00:00</span>
    </div>

    <div>
      <span class="label">SCORE</span>
      <span id="score">0</span>
    </div>

    <div>
      <span class="label">CHP</span>
      <span id="chp">NORMAL</span>
    </div>
  </div>
`;

document.body.appendChild(
  hud
);

const speedElement =
  document.getElementById(
    "speed"
  )!;

const distanceElement =
  document.getElementById(
    "distance"
  )!;

const timeElement =
  document.getElementById(
    "time"
  )!;

const scoreElement =
  document.getElementById(
    "score"
  )!;

const chpElement =
  document.getElementById(
    "chp"
  )!;

/* =========================================================
   GAME OVER
   ========================================================= */

const gameOverScreen =
  document.createElement(
    "div"
  );

gameOverScreen.id =
  "game-over";

gameOverScreen.style.display =
  "none";

gameOverScreen.innerHTML = `
  <div class="game-over-card">
    <h1>RUN OVER</h1>

    <p id="crash-reason"></p>

    <div class="final-stats">
      <div>
        Score:
        <strong id="final-score">0</strong>
      </div>

      <div>
        Distance:
        <strong id="final-distance">
          0.00 MI
        </strong>
      </div>

      <div>
        Time:
        <strong id="final-time">
          00:00
        </strong>
      </div>
    </div>

    <button id="restart-button">
      RESTART
    </button>

    <p class="restart-hint">
      Press R to restart
    </p>
  </div>
`;

document.body.appendChild(
  gameOverScreen
);

document
  .getElementById(
    "restart-button"
  )!
  .addEventListener(
    "click",
    () =>
      location.reload()
  );

/* =========================================================
   GAME OVER FUNCTION
   ========================================================= */

function endGame(
  reason: string
): void {
  if (gameOver) return;

  gameOver = true;

  crashReason =
    reason;

  document.getElementById(
    "crash-reason"
  )!.textContent =
    reason;

  document.getElementById(
    "final-score"
  )!.textContent =
    Math.floor(
      score
    ).toLocaleString();

  document.getElementById(
    "final-distance"
  )!.textContent =
    distanceMiles.toFixed(
      2
    ) + " MI";

  document.getElementById(
    "final-time"
  )!.textContent =
    formatTime(
      survivalTime
    );

  gameOverScreen.style.display =
    "flex";
}

/* =========================================================
   COLLISION DETECTION
   ========================================================= */

function checkCollisions(): void {
  if (gameOver) return;

  /*
     Use the actual player's body
     rather than the entire camera.
  */

  const playerBox =
    new THREE.Box3().setFromObject(
      body
    );

  /*
     Slightly shrink the player's
     collision box to avoid false
     crashes from mirrors/trim.
  */

  playerBox.expandByScalar(
    -0.08
  );

  for (
    const vehicle of traffic
  ) {
    const trafficBox =
      new THREE.Box3().setFromObject(
        vehicle.group
      );

    trafficBox.expandByScalar(
      -0.05
    );

    if (
      playerBox.intersectsBox(
        trafficBox
      )
    ) {
      const relativeSpeed =
        Math.abs(
          currentSpeed -
            vehicle.speed *
              2.23694
        );

      if (
        relativeSpeed >
        35
      ) {
        endGame(
          "SEVERE CRASH — high-speed collision."
        );
      } else {
        endGame(
          "CRASH — collision with oncoming traffic."
        );
      }

      return;
    }
  }
}

/* =========================================================
   SCORING
   ========================================================= */

function updateScore(
  delta: number
): void {
  if (gameOver) return;

  survivalTime +=
    delta;

  distanceMiles +=
    (currentSpeed *
      delta) /
    3600;

  let multiplier = 1;

  if (
    currentSpeed >= 55 &&
    currentSpeed <= 72
  ) {
    multiplier +=
      0.8;
  }

  if (
    currentSpeed > 85
  ) {
    multiplier +=
      1.4;
  }

  if (
    currentSpeed > 100
  ) {
    multiplier +=
      1.8;
  }

  score +=
    delta *
    (12 +
      currentSpeed *
        0.18) *
    multiplier;
}

/* =========================================================
   TIME
   ========================================================= */

function formatTime(
  seconds: number
): string {
  const mins =
    Math.floor(
      seconds / 60
    );

  const secs =
    Math.floor(
      seconds % 60
    );

  return (
    mins
      .toString()
      .padStart(2, "0") +
    ":" +
    secs
      .toString()
      .padStart(2, "0")
  );
}

/* =========================================================
   HUD UPDATE
   ========================================================= */

function updateHUD(): void {
  speedElement.textContent =
    Math.round(
      currentSpeed
    ) + " MPH";

  distanceElement.textContent =
    distanceMiles.toFixed(
      2
    ) + " MI";

  timeElement.textContent =
    formatTime(
      survivalTime
    );

  scoreElement.textContent =
    Math.floor(
      score
    ).toLocaleString();
}

/* =========================================================
   CAMERA
   ========================================================= */

function updateCamera(
  delta: number
): void {
  if (gameOver) return;

  /*
     Camera stays physically attached
     to the player's car.
  */

  const targetFov =
    70 +
    Math.min(
      currentSpeed / 3,
      14
    );

  camera.fov +=
    (targetFov -
      camera.fov) *
    Math.min(
      delta * 5,
      1
    );

  camera.updateProjectionMatrix();

  /*
     Very subtle high-speed vibration.
  */

  const vibration =
    currentSpeed > 30
      ? Math.sin(
          performance.now() *
            0.015
        ) *
        0.004
      : 0;

  camera.position.x =
    vibration;

  camera.position.y =
    vibration * 0.4;
}

/* =========================================================
   SUN
   ========================================================= */

const sunSphere =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      18,
      32,
      32
    ),
    new THREE.MeshBasicMaterial(
      {
        color: 0xffe6a0,
      }
    )
  );

sunSphere.position.set(
  -350,
  300,
  -1200
);

scene.add(
  sunSphere
);

/* =========================================================
   MAIN LOOP
   ========================================================= */

let previousTime =
  performance.now();

function animate(
  now: number
): void {
  requestAnimationFrame(
    animate
  );

  const delta =
    Math.min(
      (now -
        previousTime) /
        1000,
      0.05
    );

  previousTime =
    now;

  if (!gameOver) {
    updatePlayer(
      delta
    );

    updateTraffic(
      delta
    );

    updateScenery();

    updateCHP(
      delta
    );

    checkCollisions();

    updateScore(
      delta
    );

    updateHUD();

    updateCamera(
      delta
    );
  }

  renderer.render(
    scene,
    camera
  );
}

animate(
  performance.now()
);

/* =========================================================
   RESIZE
   ========================================================= */

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
