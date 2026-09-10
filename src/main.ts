import * as THREE from "three";
import "./style.css";

/* =========================================================
   I-80 HIGHWAY DRIVING — BROWSER PROTOTYPE
   Three.js + TypeScript
   ========================================================= */

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7fb7e6);
scene.fog = new THREE.Fog(0x7fb7e6, 180, 850);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.05,
  1500
);

const renderer = new THREE.WebGLRenderer({
  antialias: true,
  powerPreference: "high-performance",
});

renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

document.body.appendChild(renderer.domElement);

/* =========================================================
   LIGHTING
   ========================================================= */

const hemi = new THREE.HemisphereLight(
  0xbfdcff,
  0x43522f,
  2.0
);

scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff3d2, 3.2);
sun.position.set(-180, 280, 100);
sun.castShadow = true;

sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

sun.shadow.camera.left = -300;
sun.shadow.camera.right = 300;
sun.shadow.camera.top = 300;
sun.shadow.camera.bottom = -300;

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

const STEERING_SPEED = 11.0;
const LANE_CHANGE_SPEED = 9.5;

const ROAD_SEGMENT_LENGTH = 100;

const TRAFFIC_COUNT = 34;
const SCENERY_COUNT = 130;

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

window.addEventListener("keydown", (event) => {
  keys[event.key.toLowerCase()] = true;

  if (
    ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(
      event.key.toLowerCase()
    )
  ) {
    event.preventDefault();
  }

  if (event.key.toLowerCase() === "r" && gameOver) {
    location.reload();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.key.toLowerCase()] = false;
});

/* =========================================================
   MATERIAL HELPERS
   ========================================================= */

function material(
  color: number,
  roughness = 0.8,
  metalness = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

/* =========================================================
   WORLD
   ========================================================= */

const world = new THREE.Group();
scene.add(world);

/* =========================================================
   ROAD
   ========================================================= */

const roadMaterial = material(0x303338, 0.95);

const road = new THREE.Mesh(
  new THREE.BoxGeometry(ROAD_WIDTH, 0.15, 3000),
  roadMaterial
);

road.position.y = -0.15;
road.position.z = -900;

road.receiveShadow = true;

world.add(road);

/* =========================================================
   ROAD SHOULDERS
   ========================================================= */

const shoulderMaterial = material(0x777875);

const leftShoulder = new THREE.Mesh(
  new THREE.BoxGeometry(3.5, 0.12, 3000),
  shoulderMaterial
);

leftShoulder.position.set(-10, -0.11, -900);

world.add(leftShoulder);

const rightShoulder = new THREE.Mesh(
  new THREE.BoxGeometry(3.5, 0.12, 3000),
  shoulderMaterial
);

rightShoulder.position.set(10, -0.11, -900);

world.add(rightShoulder);

/* =========================================================
   LANE MARKINGS
   ========================================================= */

const lineMaterial = new THREE.MeshBasicMaterial({
  color: 0xf3f3e8,
});

for (const x of [-4, 0, 4]) {
  for (let z = -1500; z < 200; z += 12) {
    const line = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.025, 6),
      lineMaterial
    );

    line.position.set(x, -0.04, z);

    world.add(line);
  }
}

/* =========================================================
   YELLOW LEFT EDGE LINE
   ========================================================= */

const yellowLine = new THREE.Mesh(
  new THREE.BoxGeometry(0.18, 0.035, 3000),
  new THREE.MeshBasicMaterial({
    color: 0xf0c928,
  })
);

yellowLine.position.set(-7.85, -0.03, -900);

world.add(yellowLine);

/* =========================================================
   RIGHT EDGE LINE
   ========================================================= */

const whiteEdge = new THREE.Mesh(
  new THREE.BoxGeometry(0.15, 0.035, 3000),
  lineMaterial
);

whiteEdge.position.set(7.85, -0.03, -900);

world.add(whiteEdge);

/* =========================================================
   BARRIERS
   ========================================================= */

function createBarrier(x: number, z: number): THREE.Group {
  const group = new THREE.Group();

  const barrier = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 1.05, 20),
    material(0x9a9b98)
  );

  barrier.position.y = 0.45;

  group.add(barrier);

  for (let i = -9; i <= 9; i += 3) {
    const reflector = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.18, 0.08),
      material(0xdde8e4)
    );

    reflector.position.set(
      x > 0 ? -0.36 : 0.36,
      0.6,
      i
    );

    group.add(reflector);
  }

  group.position.set(x, 0, z);

  return group;
}

for (let z = -1500; z < 200; z += 20) {
  world.add(createBarrier(-9.5, z));
  world.add(createBarrier(9.5, z));
}

/* =========================================================
   TERRAIN
   ========================================================= */

const terrainMaterial = material(0x506d3e);

const terrainLeft = new THREE.Mesh(
  new THREE.BoxGeometry(1000, 0.5, 3000),
  terrainMaterial
);

terrainLeft.position.set(-510, -0.4, -900);

terrainLeft.receiveShadow = true;

world.add(terrainLeft);

const terrainRight = new THREE.Mesh(
  new THREE.BoxGeometry(1000, 0.5, 3000),
  terrainMaterial
);

terrainRight.position.set(510, -0.4, -900);

terrainRight.receiveShadow = true;

world.add(terrainRight);

/* =========================================================
   HILLS
   ========================================================= */

const hills = new THREE.Group();

function createHill(
  x: number,
  z: number,
  scale: number,
  color: number
): THREE.Mesh {
  const hill = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 12),
    material(color)
  );

  hill.scale.set(
    scale * 2.5,
    scale * 1.4,
    scale
  );

  hill.position.set(x, scale * 0.5, z);

  hill.castShadow = true;
  hill.receiveShadow = true;

  return hill;
}

for (let i = 0; i < 35; i++) {
  const side = Math.random() < 0.5 ? -1 : 1;

  hills.add(
    createHill(
      side * (80 + Math.random() * 280),
      -Math.random() * 1600,
      20 + Math.random() * 65,
      0x4e633e
    )
  );
}

world.add(hills);

/* =========================================================
   TREE CREATION
   ========================================================= */

function createTree(): THREE.Group {
  const tree = new THREE.Group();

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.28, 2.2, 8),
    material(0x63452b)
  );

  trunk.position.y = 1.1;

  tree.add(trunk);

  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(
      1.6 + Math.random(),
      4.2 + Math.random() * 2,
      8
    ),
    material(
      Math.random() > 0.5
        ? 0x31582f
        : 0x3f6c36
    )
  );

  foliage.position.y = 3.5;

  foliage.castShadow = true;

  tree.add(foliage);

  return tree;
}

const scenery = new THREE.Group();

for (let i = 0; i < SCENERY_COUNT; i++) {
  const side = Math.random() < 0.5 ? -1 : 1;

  const tree = createTree();

  tree.position.set(
    side * (15 + Math.random() * 75),
    0,
    -Math.random() * 1700
  );

  const scale = 0.7 + Math.random() * 1.5;

  tree.scale.setScalar(scale);

  scenery.add(tree);
}

world.add(scenery);

/* =========================================================
   ROAD SIGNS
   ========================================================= */

function createSign(
  text: string,
  x: number,
  z: number,
  color = 0x175c32
): THREE.Group {
  const group = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4.5, 8),
    material(0x8c8c86, 0.7, 0.4)
  );

  pole.position.y = 2.25;

  group.add(pole);

  const board = new THREE.Mesh(
    new THREE.BoxGeometry(5.5, 2, 0.15),
    material(color, 0.65)
  );

  board.position.y = 4.2;

  group.add(board);

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 180;

  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 54px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(text, 256, 90);

  const texture = new THREE.CanvasTexture(canvas);

  const signText = new THREE.Mesh(
    new THREE.PlaneGeometry(5.1, 1.7),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
    })
  );

  signText.position.set(0, 4.2, -0.09);

  group.add(signText);

  group.position.set(x, 0, z);

  return group;
}

world.add(createSign("EXIT 42", 12, -500));
world.add(createSign("SACRAMENTO", -12, -1000));
world.add(createSign("I-80", 12, -1450));

/* =========================================================
   PLAYER VEHICLE
   ========================================================= */

const playerCar = new THREE.Group();

world.add(playerCar);

/* ---------------------------------------------------------
   BODY
   --------------------------------------------------------- */

const bodyMaterial = material(0x22252a, 0.32, 0.45);

const body = new THREE.Mesh(
  new THREE.BoxGeometry(2.25, 0.85, 4.8),
  bodyMaterial
);

body.position.y = 0.75;

body.castShadow = true;

playerCar.add(body);

/* ---------------------------------------------------------
   HOOD
   --------------------------------------------------------- */

const hood = new THREE.Mesh(
  new THREE.BoxGeometry(2.12, 0.22, 1.45),
  bodyMaterial
);

hood.position.set(0, 1.12, -1.75);

hood.castShadow = true;

playerCar.add(hood);

/* ---------------------------------------------------------
   CABIN
   --------------------------------------------------------- */

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(2.0, 1.1, 2.45),
  material(0x17191d, 0.2, 0.35)
);

cabin.position.set(0, 1.35, 0.25);

cabin.castShadow = true;

playerCar.add(cabin);

/* ---------------------------------------------------------
   WINDOWS
   --------------------------------------------------------- */

const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0x17252e,
  roughness: 0.08,
  metalness: 0.1,
  transparent: true,
  opacity: 0.65,
});

const windshield = new THREE.Mesh(
  new THREE.PlaneGeometry(1.75, 0.82),
  glassMaterial
);

windshield.position.set(0, 1.55, -1.0);

windshield.rotation.x = -0.12;

playerCar.add(windshield);

/* ---------------------------------------------------------
   SIDE MIRRORS
   --------------------------------------------------------- */

function createMirror(x: number): THREE.Group {
  const mirror = new THREE.Group();

  const stem = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.35),
    material(0x17191c, 0.3, 0.5)
  );

  stem.rotation.y = Math.PI / 2;

  mirror.add(stem);

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.25, 0.5),
    material(0x101114, 0.3, 0.5)
  );

  housing.position.x = x > 0 ? 0.18 : -0.18;

  mirror.add(housing);

  mirror.position.set(
    x,
    1.45,
    -0.15
  );

  return mirror;
}

playerCar.add(createMirror(-1.2));
playerCar.add(createMirror(1.2));

/* ---------------------------------------------------------
   WHEELS
   --------------------------------------------------------- */

function createWheel(): THREE.Group {
  const wheel = new THREE.Group();

  const tire = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.42,
      0.42,
      0.25,
      20
    ),
    material(0x111214, 0.9)
  );

  tire.rotation.z = Math.PI / 2;

  wheel.add(tire);

  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(
      0.23,
      0.23,
      0.27,
      16
    ),
    material(0xb7b9ba, 0.25, 0.8)
  );

  rim.rotation.z = Math.PI / 2;

  wheel.add(rim);

  return wheel;
}

const frontLeftWheel = createWheel();
const frontRightWheel = createWheel();

frontLeftWheel.position.set(-1.1, 0.45, -1.45);
frontRightWheel.position.set(1.1, 0.45, -1.45);

playerCar.add(frontLeftWheel);
playerCar.add(frontRightWheel);

const rearLeftWheel = createWheel();
const rearRightWheel = createWheel();

rearLeftWheel.position.set(-1.1, 0.45, 1.45);
rearRightWheel.position.set(1.1, 0.45, 1.45);

playerCar.add(rearLeftWheel);
playerCar.add(rearRightWheel);

/* =========================================================
   COCKPIT
   ========================================================= */

const cockpit = new THREE.Group();

playerCar.add(cockpit);

/* Dashboard */

const dashboard = new THREE.Mesh(
  new THREE.BoxGeometry(2.05, 0.35, 0.65),
  material(0x16181b, 0.7)
);

dashboard.position.set(
  0,
  1.12,
  -0.75
);

cockpit.add(dashboard);

/* Steering wheel */

const steeringWheel = new THREE.Group();

const wheelRing = new THREE.Mesh(
  new THREE.TorusGeometry(
    0.32,
    0.055,
    10,
    32
  ),
  material(0x111214, 0.4, 0.3)
);

wheelRing.rotation.x = Math.PI / 2;

steeringWheel.add(wheelRing);

const wheelHub = new THREE.Mesh(
  new THREE.CylinderGeometry(
    0.11,
    0.11,
    0.07,
    16
  ),
  material(0x24272a, 0.5, 0.4)
);

wheelHub.rotation.x = Math.PI / 2;

steeringWheel.add(wheelHub);

steeringWheel.position.set(
  -0.48,
  1.27,
  -0.82
);

cockpit.add(steeringWheel);

/* Instrument cluster */

const instrument = new THREE.Mesh(
  new THREE.BoxGeometry(0.85, 0.25, 0.08),
  material(0x050505)
);

instrument.position.set(
  -0.48,
  1.43,
  -0.9
);

cockpit.add(instrument);

/* =========================================================
   CAMERA
   ========================================================= */

const cameraRig = new THREE.Group();

playerCar.add(cameraRig);

cameraRig.position.set(
  0,
  1.65,
  0.75
);

cameraRig.add(camera);

camera.position.set(0, 0, 0);

camera.rotation.set(0, 0, 0);

/* =========================================================
   TRAFFIC VEHICLES
   ========================================================= */

type TrafficType =
  | "sedan"
  | "suv"
  | "pickup"
  | "sports"
  | "van"
  | "semi";

interface TrafficVehicle {
  group: THREE.Group;
  type: TrafficType;
  lane: number;
  targetLane: number;
  speed: number;
  desiredSpeed: number;
  changeTimer: number;
}

const traffic: TrafficVehicle[] = [];

function randomVehicleType(): TrafficType {
  const r = Math.random();

  if (r < 0.28) return "sedan";
  if (r < 0.48) return "suv";
  if (r < 0.66) return "pickup";
  if (r < 0.76) return "sports";
  if (r < 0.88) return "van";

  return "semi";
}

/* =========================================================
   TRAFFIC CAR CREATOR
   ========================================================= */

function createTrafficVehicle(
  type: TrafficType,
  color: number
): THREE.Group {
  const car = new THREE.Group();

  let width = 1.75;
  let height = 0.75;
  let length = 4;

  if (type === "suv") {
    width = 1.9;
    height = 1;
    length = 4.3;
  }

  if (type === "pickup") {
    width = 1.9;
    height = 0.95;
    length = 4.7;
  }

  if (type === "sports") {
    width = 1.8;
    height = 0.62;
    length = 4.1;
  }

  if (type === "van") {
    width = 1.9;
    height = 1.35;
    length = 4.6;
  }

  if (type === "semi") {
    width = 2.35;
    height = 3.2;
    length = 9;
  }

  const paint = material(
    color,
    0.28,
    0.4
  );

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(
      width,
      height,
      length
    ),
    paint
  );

  base.position.y =
    type === "semi"
      ? 1.55
      : 0.7;

  base.castShadow = true;

  car.add(base);

  if (type !== "semi") {
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.88,
        height * 0.9,
        length * 0.48
      ),
      material(
        0x18232b,
        0.12,
        0.3
      )
    );

    cabin.position.set(
      0,
      base.position.y + height * 0.48,
      0.15
    );

    car.add(cabin);
  } else {
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(
        width,
        2.4,
        2.4
      ),
      paint
    );

    cab.position.set(
      0,
      2.1,
      -3.1
    );

    car.add(cab);

    const trailer = new THREE.Mesh(
      new THREE.BoxGeometry(
        2.3,
        3.2,
        6.5
      ),
      material(
        0xd6d6d1,
        0.75
      )
    );

    trailer.position.set(
      0,
      1.8,
      1.0
    );

    car.add(trailer);
  }

  /* Windows */

  if (type !== "semi") {
    const window = new THREE.Mesh(
      new THREE.BoxGeometry(
        width * 0.82,
        height * 0.45,
        length * 0.32
      ),
      new THREE.MeshStandardMaterial({
        color: 0x10202a,
        roughness: 0.1,
        metalness: 0.15,
      })
    );

    window.position.set(
      0,
      base.position.y + height * 0.52,
      0
    );

    car.add(window);
  }

  /* Wheels */

  if (type !== "semi") {
    for (const x of [-width / 2, width / 2]) {
      for (const z of [
        -length * 0.31,
        length * 0.31,
      ]) {
        const tire = new THREE.Mesh(
          new THREE.CylinderGeometry(
            0.36,
            0.36,
            0.23,
            12
          ),
          material(0x101112)
        );

        tire.rotation.z =
          Math.PI / 2;

        tire.position.set(
          x,
          0.42,
          z
        );

        car.add(tire);
      }
    }
  }

  /* Headlights */

  for (const x of [-width * 0.32, width * 0.32]) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(
        0.25,
        0.12,
        0.05
      ),
      new THREE.MeshBasicMaterial({
        color: 0xfff4d0,
      })
    );

    light.position.set(
      x,
      base.position.y + 0.05,
      -length / 2 - 0.03
    );

    car.add(light);
  }

  return car;
}

/* =========================================================
   TRAFFIC SPAWNING
   ========================================================= */

const trafficColors = [
  0xffffff,
  0x151719,
  0x2c3e50,
  0x8b1e24,
  0x1d3c6b,
  0x777777,
  0xc6c6c6,
  0xeeeeee,
  0x4e513f,
  0x2c2c2c,
  0x9b9b9b,
  0x315b45,
];

function spawnTraffic(): void {
  const type = randomVehicleType();

  const group = createTrafficVehicle(
    type,
    trafficColors[
      Math.floor(
        Math.random() *
          trafficColors.length
      )
    ]
  );

  const lane =
    Math.floor(
      Math.random() *
        LANE_COUNT
    );

  const z =
    -100 -
    Math.random() *
      1600;

  group.position.set(
    LANES[lane],
    0,
    z
  );

  const baseSpeed =
    type === "semi"
      ? 38
      : type === "sports"
      ? 68
      : 48 + Math.random() * 20;

  world.add(group);

  traffic.push({
    group,
    type,
    lane,
    targetLane: lane,
    speed: baseSpeed,
    desiredSpeed:
      baseSpeed +
      (Math.random() * 12 - 6),
    changeTimer:
      3 + Math.random() * 8,
  });
}

for (
  let i = 0;
  i < TRAFFIC_COUNT;
  i++
) {
  spawnTraffic();
}

/* =========================================================
   CHP
   ========================================================= */

let chpAttention = 0;
let chpActive = false;

const chpVehicle = createTrafficVehicle(
  "sedan",
  0xffffff
);

chpVehicle.visible = false;

world.add(chpVehicle);

/* CHP light bar */

const lightBar = new THREE.Group();

const redLight = new THREE.Mesh(
  new THREE.BoxGeometry(
    0.22,
    0.08,
    0.12
  ),
  new THREE.MeshBasicMaterial({
    color: 0xff1111,
  })
);

redLight.position.x = -0.18;

const blueLight = new THREE.Mesh(
  new THREE.BoxGeometry(
    0.22,
    0.08,
    0.12
  ),
  new THREE.MeshBasicMaterial({
    color: 0x2255ff,
  })
);

blueLight.position.x = 0.18;

lightBar.add(redLight);
lightBar.add(blueLight);

lightBar.position.y = 1.55;

chpVehicle.add(lightBar);

/* =========================================================
   HUD
   ========================================================= */

const hud = document.createElement("div");

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

document.body.appendChild(hud);

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
  document.createElement("div");

gameOverScreen.id =
  "game-over";

gameOverScreen.style.display =
  "none";

gameOverScreen.innerHTML = `
  <div class="game-over-card">
    <h1>RUN OVER</h1>

    <p id="crash-reason"></p>

    <div class="final-stats">
      <div>Score: <strong id="final-score">0</strong></div>
      <div>Distance: <strong id="final-distance">0.00 MI</strong></div>
      <div>Time: <strong id="final-time">00:00</strong></div>
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
    () => location.reload()
  );

/* =========================================================
   GAME OVER FUNCTION
   ========================================================= */

function endGame(
  reason: string
): void {
  if (gameOver) return;

  gameOver = true;

  crashReason = reason;

  (
    document.getElementById(
      "crash-reason"
    )!
  ).textContent = reason;

  (
    document.getElementById(
      "final-score"
    )!
  ).textContent =
    Math.floor(score).toLocaleString();

  (
    document.getElementById(
      "final-distance"
    )!
  ).textContent =
    distanceMiles.toFixed(2) +
    " MI";

  (
    document.getElementById(
      "final-time"
    )!
  ).textContent =
    formatTime(survivalTime);

  gameOverScreen.style.display =
    "flex";
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

  throttleInput = forward ? 1 : 0;
  brakeInput = brake ? 1 : 0;

  steeringInput =
    (right ? 1 : 0) -
    (left ? 1 : 0);

  /* Faster steering */

  if (steeringInput !== 0) {
    velocityX +=
      steeringInput *
      STEERING_SPEED *
      delta;
  } else {
    velocityX *=
      Math.pow(0.025, delta);
  }

  /* Stronger lane movement */

  velocityX = THREE.MathUtils.clamp(
    velocityX,
    -LANE_CHANGE_SPEED,
    LANE_CHANGE_SPEED
  );

  /* Acceleration */

  if (throttleInput) {
    velocityZ +=
      34 *
      delta;
  }

  /* Natural drag */

  velocityZ *=
    Math.pow(0.18, delta);

  /* Braking */

  if (brakeInput) {
    velocityZ -=
      60 *
      delta;
  }

  velocityZ = THREE.MathUtils.clamp(
    velocityZ,
    0,
    MAX_FORWARD_SPEED
  );

  /* Player movement */

  playerX +=
    velocityX *
    delta;

  playerZ -=
    velocityZ *
    delta;

  /* Keep car on highway */

  playerX = THREE.MathUtils.clamp(
    playerX,
    -7,
    7
  );

  /* Convert into speed */

  currentSpeed =
    velocityZ *
    2.23694;

  /* Body roll */

  const desiredRoll =
    -velocityX * 0.045;

  playerCar.rotation.z +=
    (desiredRoll -
      playerCar.rotation.z) *
    Math.min(
      delta * 7,
      1
    );

  /* Steering wheel */

  steeringWheelAngle +=
    (steeringInput * 0.72 -
      steeringWheelAngle) *
    Math.min(
      delta * 12,
      1
    );

  steeringWheel.rotation.z =
    -steeringWheelAngle;

  /* Front wheels follow steering */

  frontLeftWheel.rotation.y =
    steeringInput * 0.35;

  frontRightWheel.rotation.y =
    steeringInput * 0.35;

  /* Camera follows the car */

  playerCar.position.x =
    playerX;

  playerCar.position.z =
    playerZ;

  /* Subtle suspension */

  const suspension =
    Math.sin(
      performance.now() *
        0.008
    ) *
    Math.min(
      currentSpeed / 90,
      1
    ) *
    0.012;

  cameraRig.position.y =
    1.65 + suspension;
}

/* =========================================================
   TRAFFIC AI
   ========================================================= */

function updateTraffic(
  delta: number
): void {
  for (const vehicle of traffic) {
    if (gameOver) return;

    vehicle.changeTimer -=
      delta;

    /* Find nearby vehicle ahead */

    let nearestDistance =
      Infinity;

    let nearestVehicle:
      | TrafficVehicle
      | null = null;

    for (const other of traffic) {
      if (
        other === vehicle ||
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
        nearestDistance =
          distance;

        nearestVehicle =
          other;
      }
    }

    /* Following behavior */

    if (
      nearestVehicle &&
      nearestDistance < 32
    ) {
      vehicle.speed -=
        20 * delta;

      vehicle.speed = Math.max(
        vehicle.speed,
        nearestVehicle.speed -
          4
      );
    } else {
      vehicle.speed +=
        (vehicle.desiredSpeed -
          vehicle.speed) *
        delta *
        0.6;
    }

    /* Lane changes */

    if (
      vehicle.changeTimer <= 0
    ) {
      vehicle.changeTimer =
        5 +
        Math.random() * 10;

      if (
        Math.random() <
        0.25
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

          for (const other of traffic) {
            if (
              other.lane ===
                newLane &&
              Math.abs(
                other.group.position.z -
                  vehicle.group
                    .position.z
              ) < 18
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

    /* Smooth lane change */

    const targetX =
      LANES[
        vehicle.targetLane
      ];

    vehicle.group.position.x +=
      (targetX -
        vehicle.group.position.x) *
      Math.min(
        delta * 1.7,
        1
      );

    if (
      Math.abs(
        vehicle.group.position.x -
          targetX
      ) < 0.08
    ) {
      vehicle.lane =
        vehicle.targetLane;
    }

    /* Move traffic */

    vehicle.group.position.z -=
      vehicle.speed *
      delta;

    /* Recycle */

    if (
      vehicle.group.position.z >
        playerZ + 30
    ) {
      vehicle.group.position.z =
        playerZ -
        1500 -
        Math.random() *
          500;

      vehicle.lane =
        Math.floor(
          Math.random() *
            LANE_COUNT
        );

      vehicle.targetLane =
        vehicle.lane;

      vehicle.group.position.x =
        LANES[vehicle.lane];

      vehicle.desiredSpeed =
        vehicle.type ===
        "semi"
          ? 35 +
            Math.random() * 8
          : 48 +
            Math.random() * 22;

      vehicle.speed =
        vehicle.desiredSpeed;
    }
  }
}

/* =========================================================
   SCENERY RECYCLING
   ========================================================= */

function updateScenery(): void {
  for (const object of scenery
    .children) {
    if (
      object.position.z >
      playerZ + 80
    ) {
      const side =
        object.position.x <
        0
          ? -1
          : 1;

      object.position.z =
        playerZ -
        1400 -
        Math.random() *
          400;

      object.position.x =
        side *
        (15 +
          Math.random() *
            75);
    }
  }
}

/* =========================================================
   CHP AI
   ========================================================= */

function updateCHP(
  delta: number
): void {
  if (gameOver) return;

  const limit = 65;

  const speeding =
    Math.max(
      0,
      currentSpeed -
        limit
    );

  if (speeding < 5) {
    chpAttention -=
      delta * 1.5;
  } else if (
    speeding < 15
  ) {
    chpAttention +=
      delta * 0.7;
  } else if (
    speeding < 30
  ) {
    chpAttention +=
      delta * 2.0;
  } else {
    chpAttention +=
      delta * 4.0;
  }

  chpAttention =
    THREE.MathUtils.clamp(
      chpAttention,
      0,
      100
    );

  if (
    !chpActive &&
    chpAttention >
      65 &&
    Math.random() <
      delta * 0.08
  ) {
    chpActive = true;

    chpVehicle.visible =
      true;

    chpVehicle.position.set(
      playerX,
      0,
      playerZ + 35
    );
  }

  if (chpActive) {
    chpVehicle.position.z -=
      55 * delta;

    chpVehicle.position.x +=
      (playerX -
        chpVehicle.position.x) *
      delta *
      1.5;

    lightBar.visible =
      Math.floor(
        performance.now() /
          120
      ) %
        2 ===
      0;

    if (
      Math.abs(
        chpVehicle.position.z -
          playerZ
      ) < 15
    ) {
      chpElement.textContent =
        "PULL OVER";

      chpElement.style.color =
        "#ff4040";
    }

    if (
      Math.abs(
        chpVehicle.position.z -
          playerZ
      ) < 7 &&
      currentSpeed <
        8
    ) {
      endGame(
        "You successfully pulled over for CHP."
      );
    }
  }

  if (!chpActive) {
    if (
      chpAttention >
      50
    ) {
      chpElement.textContent =
        "WATCHING";
    } else if (
      chpAttention >
      25
    ) {
      chpElement.textContent =
        "ATTENTION";
    } else {
      chpElement.textContent =
        "NORMAL";
    }
  }
}

/* =========================================================
   COLLISION DETECTION
   ========================================================= */

function checkCollisions(): void {
  if (gameOver) return;

  const playerBox =
    new THREE.Box3().setFromObject(
      body
    );

  for (const vehicle of traffic) {
    const trafficBox =
      new THREE.Box3().setFromObject(
        vehicle.group
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
          "CRASH — collision with traffic."
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
    currentSpeed >
    85
  ) {
    multiplier +=
      1.4;
  }

  if (
    currentSpeed >
    100
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
   HUD UPDATE
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
   CAMERA SPEED EFFECT
   ========================================================= */

function updateCamera(
  delta: number
): void {
  if (gameOver) return;

  /* Important:
     Camera stays inside playerCar.
     It never rotates with steering. */

  const targetFov =
    70 +
    Math.min(
      currentSpeed / 3,
      14
    );

  camera.fov +=
    (targetFov -
      camera.fov) *
    delta *
    4;

  camera.updateProjectionMatrix();

  /* Very subtle movement */

  const vibration =
    currentSpeed >
    30
      ? Math.sin(
          performance.now() *
            0.015
        ) *
        0.006
      : 0;

  camera.position.x =
    vibration;

  camera.position.y =
    vibration * 0.4;
}

/* =========================================================
   SKY / DISTANT ATMOSPHERE
   ========================================================= */

const sunSphere =
  new THREE.Mesh(
    new THREE.SphereGeometry(
      18,
      24,
      24
    ),
    new THREE.MeshBasicMaterial({
      color: 0xffe7a1,
    })
  );

sunSphere.position.set(
  -350,
  300,
  -1000
);

scene.add(sunSphere);

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

  const delta = Math.min(
    (now -
      previousTime) /
      1000,
    0.05
  );

  previousTime = now;

  if (!gameOver) {
    updatePlayer(delta);
    updateTraffic(delta);
    updateScenery();
    updateCHP(delta);
    checkCollisions();
    updateScore(delta);
    updateHUD();
    updateCamera(delta);
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
);
