import * as THREE from "three";
import "./style.css";

type VehicleKind =
  | "sedan"
  | "suv"
  | "pickup"
  | "van"
  | "sports"
  | "box"
  | "semi"
  | "bus"
  | "chp";

interface TrafficVehicle {
  root: THREE.Group;
  kind: VehicleKind;
  lane: number;
  targetLane: number;
  speed: number;
  targetSpeed: number;
  laneChangeTimer: number;
  blinkTimer: number;
  color: THREE.Color;
  length: number;
  width: number;
  height: number;
}

interface RoadSegment {
  root: THREE.Group;
  z: number;
  length: number;
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8eb5d3);

scene.fog = new THREE.Fog(0x8eb5d3, 160, 650);

const camera = new THREE.PerspectiveCamera(
  72,
  window.innerWidth / window.innerHeight,
  0.05,
  1200
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
renderer.toneMappingExposure = 1.12;

document.body.innerHTML = "";
document.body.appendChild(renderer.domElement);

// ------------------------------------------------------------
// GLOBAL CONSTANTS
// ------------------------------------------------------------

const ROAD_WIDTH = 16;
const LANE_WIDTH = ROAD_WIDTH / 4;
const SEGMENT_LENGTH = 100;
const SEGMENT_COUNT = 12;

const PLAYER_Z = 0;

const laneCenter = (lane: number) =>
  -ROAD_WIDTH / 2 + LANE_WIDTH * (lane + 0.5);

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));

const lerp = (a: number, b: number, t: number) =>
  a + (b - a) * t;

// ------------------------------------------------------------
// LIGHTING
// ------------------------------------------------------------

const hemi = new THREE.HemisphereLight(
  0xbfdfff,
  0x4b553d,
  2.1
);

scene.add(hemi);

const sun = new THREE.DirectionalLight(0xfff0d2, 3.0);
sun.position.set(-100, 180, 80);
sun.castShadow = true;

sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;

sun.shadow.camera.left = -220;
sun.shadow.camera.right = 220;
sun.shadow.camera.top = 220;
sun.shadow.camera.bottom = -220;

scene.add(sun);

// ------------------------------------------------------------
// WORLD
// ------------------------------------------------------------

const world = new THREE.Group();
scene.add(world);

const highway = new THREE.Group();
world.add(highway);

const scenery = new THREE.Group();
world.add(scenery);

const trafficGroup = new THREE.Group();
world.add(trafficGroup);

// ------------------------------------------------------------
// MATERIAL HELPERS
// ------------------------------------------------------------

function mat(
  color: number,
  roughness = 0.65,
  metalness = 0
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

const asphaltMat = mat(0x292b2d, 0.95);
const shoulderMat = mat(0x555858, 0.95);
const grassMat = mat(0x496b3c, 1);
const dirtMat = mat(0x806b4d, 1);
const concreteMat = mat(0x9b9b96, 0.9);
const whiteMat = mat(0xe8e8e3, 0.55);
const yellowMat = mat(0xf0c52e, 0.5);
const blackMat = mat(0x080909, 0.8);
const rubberMat = mat(0x101010, 1);
const chromeMat = mat(0xbfc5c7, 0.2, 0.8);
const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x16242b,
  roughness: 0.08,
  metalness: 0.1,
  transparent: true,
  opacity: 0.68,
});

// ------------------------------------------------------------
// ROAD
// ------------------------------------------------------------

const roadGeometry = new THREE.BoxGeometry(
  ROAD_WIDTH,
  0.18,
  SEGMENT_LENGTH
);

function createRoadSegment(index: number): RoadSegment {
  const root = new THREE.Group();

  const road = new THREE.Mesh(roadGeometry, asphaltMat);
  road.position.y = -0.12;
  road.receiveShadow = true;
  root.add(road);

  // shoulders
  const shoulderGeometry = new THREE.BoxGeometry(
    3.4,
    0.14,
    SEGMENT_LENGTH
  );

  const leftShoulder = new THREE.Mesh(
    shoulderGeometry,
    shoulderMat
  );

  leftShoulder.position.set(-ROAD_WIDTH / 2 - 1.7, -0.1, 0);
  leftShoulder.receiveShadow = true;

  const rightShoulder = leftShoulder.clone();
  rightShoulder.position.x = ROAD_WIDTH / 2 + 1.7;

  root.add(leftShoulder);
  root.add(rightShoulder);

  // lane markings
  for (let lane = 1; lane < 4; lane++) {
    const x = laneCenter(lane) - LANE_WIDTH / 2;

    for (let z = -SEGMENT_LENGTH / 2 + 5; z < SEGMENT_LENGTH / 2; z += 10) {
      const stripe = new THREE.Mesh(
