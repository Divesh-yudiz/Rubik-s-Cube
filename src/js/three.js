import * as THREE from 'three';
// eslint-disable-next-line import/no-unresolved
// import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import fragment from '../shaders/fragment.glsl';
import vertex from '../shaders/vertex.glsl';
// import BLUE from '/Colors/blue.png'
// import ORANGE from '/Colors/orange.png'
// import RED from '/Colors/red.png'
// import WHITE from '/Colors/white.png'
// import YELLOW from '/Colors/yellow.png'
// import GREEN from '/Colors/green.png'

const device = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: window.devicePixelRatio
};

// note that the order is important here!
const colorNames = ["blue", "green", "white", "yellow", "red", "orange"];
const colorDirs = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

// assigns color codes to "color characters"
const colors = {
  "b": "#2362FD", // blue
  "g": "#018A46", // green
  "w": "#F6F9FD", // white
  "y": "#FFE456", // yellow
  "r": "#DF2F31", // red
  "o": "#F36726"  // orange
};
// in the SVG drawing, the six middle squares are fixed; these
// structures assign to each one the one above it and the one to the
// right of it
const up = {
  "b": "r",
  "g": "o",
  "w": "g",
  "y": "g",
  "r": "g",
  "o": "b"
};
const right = {
  "b": "w",
  "g": "w",
  "w": "o",
  "y": "r",
  "r": "w",
  "o": "w"
};
// helper array used in index searches
const indices = [0, 1, 2];

// some global variables for three.js (needed by mouse handlers)
// let camera, renderer;
let raycaster, renderer, camera;
// the 26 cube data structures, and the two closures used to re-render
// the three.js output and to re-arrange the screen
let cubes, renderFunction, resize;
// whether the right half should be shown
let showSVG = true;
// the size of one cube
const size = 5;
// used to map indices 0,1,2 to axis names
const chars = ["x", "y", "z"];
// the last character the user typed
let lastChar = false;
// whether an animation is currently running
let animation = false;
// the viewport values of the SVG area
const svgWidth = 11.25;
const svgHeight = 17;
// assign arrays of nine SVG rectangles each to color characters
const squares = {};
// SVG triangle information;
const triangles = {};
let showTriangles = false;
// remember where mouse click was and on what
let lastMouse = null;
// length of three.js diagonal
let diag = 1000;
// how much the mouse has to move to initiate an action
let moveDist = 50;
// time of last touch
let lastTouch = performance.now();
// for storing moves
let store = false;
let invert = false;
let storedMoves = [];



export default class Three {
  constructor(canvas) {
    this.canvas = canvas;

    this.scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.x = -30;
    camera.position.y = 20;
    camera.position.z = 17;
    camera.lookAt(this.scene.position);
    this.scene.add(camera);

    renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    renderer.setSize(device.width, device.height);
    renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    // this.controls = new OrbitControls(camera, this.canvas);

    const backgroundColor = new THREE.Color(0x000000); // Replace with your desired color in hexadecimal
    this.scene.background = backgroundColor;

    this.clock = new THREE.Clock();

    this.setLights();
    this.setGeometry();
    this.createSides();
    this.render();
    this.setResize();
  }

  setLights = () => {
    // this.ambientLight = new THREE.AmbientLight(new THREE.Color(1, 1, 1, 1));
    // this.scene.add(this.ambientLight);

    const directionalLight = new THREE.DirectionalLight("#ffffff");
    directionalLight.position.set(-25, 30, 25);

    this.scene.add(directionalLight);
    this.scene.add(new THREE.AmbientLight(0xffffff));
  }

  setGeometry = () => {
    this.planeGeometry = new THREE.PlaneGeometry(1, 1, 128, 128);
    this.planeMaterial = new THREE.ShaderMaterial({
      side: THREE.DoubleSide,
      wireframe: true,
      fragmentShader: fragment,
      vertexShader: vertex,
      uniforms: {
        progress: { type: 'f', value: 0 }
      }
    });

    this.planeMesh = new THREE.Mesh(this.planeGeometry, this.planeMaterial);
    // this.scene.add(this.planeMesh);

  }

  cubeIndex = (x, y, z) => {

    return (x + 1) + 3 * (y + 1) + 9 * (z + 1);
  }

  origColor = (x, y, z) => {

    switch (this.cubeIndex(x, y, z)) {
      case 14: return "b"; // [1,0,0] is blue
      case 12: return "g"; // [-1,0,0] is green
      case 16: return "w"; // [0,1,0] is white
      case 10: return "y"; // [0,-1,0] is yellow
      case 22: return "r"; // [0,0,1] is red
      case 4: return "o"; // [0,0,-1] is orange
      // only for "pure" vectors (with two zeros)
      default: return null;
    }
  }

  showSide = (i, x, y, z) => {

    switch (i) {
      case 0:
        return x == 1;
      case 1:
        return x == -1;
      case 2:
        return y == 1;
      case 3:
        return y == -1;
      case 4:
        return z == 1;
      default:
        return z == -1;
    };
  }

  init = () => {

    const moves = localStorage.getItem("moves");
    if (moves)
      storedMoves = JSON.parse(moves);

    // document.getElementById("info").ontouchstart = hideInfo;
    document.onkeydown = this.keyHandler;
    const output = document.getElementById("output");
    output.onmousedown = this.mouseDown;
    output.onmouseup = this.mouseUp;
    output.onmousemove = this.mouseMove;
    output.ontouchstart = this.touchStart;
    output.ontouchend = this.mouseUp;
    output.ontouchmove = this.touchMove;

    raycaster = new THREE.Raycaster();
    for (let cube of cubes) {
      this.scene.add(cube.mesh);
    }

    output.appendChild(this.canvas);

    const svg = document.getElementById("svg");
    svg.ontouchstart = this.svgTouchStart;
    for (let el of [svg, renderer.domElement]) {
      ["contextmenu", "drag", "dragstart", "dragend", "dragover", "dragenter", "dragleave", "drop"].forEach((event) => {
        el.addEventListener(event, this.prevent);
      });
    }

    this.draw();
  }

  setAttributes = (el, attrs) => {

    for (let [name, val] of attrs) {
      el.setAttribute(name, val);
    }
  }

  draw = () => {

    const svg = document.getElementById("svg");
    const svgNS = svg.namespaceURI;
    for (let [name, cx, cy] of [
      ["g", 5.25, 2],
      ["y", 2, 5.25],
      ["r", 5.25, 5.25],
      ["w", 8.5, 5.25],
      ["b", 5.25, 8.5],
      ["o", 5.25, 11.75]
    ]) {
      squares[name] = [];
      for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
          const sq = svg.appendChild(document.createElementNS(svgNS, "rect"));
          this.setAttributes(sq, [
            ["fill", "white"],
            ["x", cx + x],
            ["y", cy + y + 1.25],
            ["width", 0.9],
            ["height", 0.9]
          ]);
          squares[name].push(sq);
        }
      }
      cx += 0.45;
      cy += 1.7;
      const triangle = svg.appendChild(document.createElementNS(svgNS, "polygon"));
      triangles[name] = [triangle, cx, cy, 0];
      this.setAttributes(triangle, [
        ["fill", "none"],
        ["points", `${cx + 0.2},${cy + 0.3} ${cx - 0.2},${cy + 0.3} ${cx},${cy - 0.3}`]
      ]);
    }
    this.updateSquares();
    this.randomMovement();
  }

  origColor = (x, y, z) => {

    switch (this.cubeIndex(x, y, z)) {
      case 14: return "b"; // [1,0,0] is blue
      case 12: return "g"; // [-1,0,0] is green
      case 16: return "w"; // [0,1,0] is white
      case 10: return "y"; // [0,-1,0] is yellow
      case 22: return "r"; // [0,0,1] is red
      case 4: return "o"; // [0,0,-1] is orange
      // only for "pure" vectors (with two zeros)
      default: return null;
    }
  }

  colorInDir = (cube, vec) => {

    const rot = new THREE.Quaternion();
    rot.copy(cube.mesh.quaternion);
    rot.invert();
    const dir = new THREE.Vector3(...vec);
    dir.applyQuaternion(rot);
    dir.round();
    return colors[this.origColor(...dir.toArray())];
  }

  updateSquares = () => {
    for (let name of ["g", "y", "r", "w", "b", "o"]) {
      // all cubes on the side of middle square with this color
      const c = this.findAllCubes(name);
      // the direction this color "looks at"
      const v = this.axisFromChar(name);
      // for this to work findAllCubes must return the cubes in a
      // specific order
      for (let i = 0; i < 9; i++) {
        squares[name][i].setAttribute("fill", this.colorInDir(c[i], v));
        if (i == 4) {
          const [triangle, cx, cy, r] = triangles[name];
          triangle.setAttribute("transform", `rotate(${r * 90}, ${cx}, ${cy})`);
          triangle.setAttribute("fill", showTriangles ? "black" : "none");
        }
      }
    }
  }

  findCube = (c) => {

    return cubes.find(cube => cube.color == c);
  }

  axisFromChar = (c) => {

    return this.findCube(c).coords;
  }

  vecEq = (v1, v2) => {

    return v1[0] == v2[0] && v1[1] == v2[1] && v1[2] == v2[2];
  }

  findAllCubes = (c) => {

    const mainAxis = this.axisFromChar(c);
    const mainIndex = indices.find(i => mainAxis[i] != 0);
    const upAxis = this.axisFromChar(up[c]);
    const upIndex = indices.find(i => upAxis[i] != 0);
    const upValue = upAxis[upIndex];
    const rightAxis = this.axisFromChar(right[c]);
    const rightIndex = indices.find(i => rightAxis[i] != 0);
    const rightValue = rightAxis[rightIndex];
    const vec = [0, 0, 0];
    vec[mainIndex] = mainAxis[mainIndex];
    const result = [];
    for (let y of [upValue, 0, -upValue]) {
      vec[upIndex] = y;
      for (let x of [-rightValue, 0, rightValue]) {
        vec[rightIndex] = x;
        result.push(cubes.find(cube => this.vecEq(vec, cube.coords)));
      }
    }
    return result;
  }

  prevent = (event) => {

    event.preventDefault();
  }

  createSides = () => {

    const sides = [];
    let i = 0;
    let counter = 0;
    // console.log(BLUE)
    for (let colorName of colorNames) {
      const j = i;
      new THREE.TextureLoader().load(
        `/Colors/${colorName}.png`,

        // callback which is called once the texture is loaded
        texture => {
          const material = new THREE.MeshStandardMaterial({
            map: texture,
            side: THREE.DoubleSide
          });
          sides[j] = material;
          counter++;
          // we're finished once all six are done
          if (counter >= 6) {
            this.createCubes(sides);
          }
        }
      );
      i++;
    }
  }

  createCubes = (sides) => {

    cubes = [];
    const blackSide = new THREE.MeshStandardMaterial({
      color: 0x000000,
      side: THREE.DoubleSide
    });
    const cubeGeometry = new THREE.BoxGeometry(0.98 * size, 0.98 * size, 0.98 * size);
    for (let x of [-1, 0, 1]) {
      for (let y of [-1, 0, 1]) {
        for (let z of [-1, 0, 1]) {
          // skip middle cube
          if (this.cubeIndex(x, y, z) == 13)
            continue;
          const materials = [];
          for (let i = 0; i < 6; i++)
            materials.push(this.showSide(i, x, y, z) ? sides[i] : blackSide);
          const cubeMesh = new THREE.Mesh(cubeGeometry, materials);
          cubeMesh.position.x = size * x;
          cubeMesh.position.y = size * y;
          cubeMesh.position.z = size * z;
          cubes.push({
            mesh: cubeMesh,
            // "simplified coordinates" where x, y, and z are always -1, 0, or 1
            coords: [x, y, z],
            // the six "middle cubes" can be asked for their color so we
            // can find them
            color: this.origColor(x, y, z)
          });
        }
      }
    }
    this.init();
  }


  randomInt = (from, toIncl) => {
    return from + Math.floor((toIncl - from + 1) * Math.random());
  }

  randomMovement = () => {
    store = false;
    const n = this.randomInt(20, 30);
    const moves = [];
    for (let i = 0; i < n; i++) {
      moves.push([this.rotate, this.randomVec(), Math.random() < 0.5, Math.random() < 0.2 ? true : Math.random() < 0.4 ? 1 : false, 400]);
    }
    this.performMoves(moves);
  }

  randomVec = () => {
    const vec = [0, 0, 0];
    vec[this.randomInt(0, 2)] = Math.random() < 0.5 ? 1 : -1;
    return vec;
  }

  randomInt = (from, toIncl) => {
    return from + Math.floor((toIncl - from + 1) * Math.random());
  }

  performMoves = (moves) => {
    let nextMove = () => {
      if (moves.length <= 0)
        return;
      const [fn, ...args] = moves.pop();
      fn(...args, nextMove);
    };
    nextMove();
  }

  keyHandler = (e) => {
    lastMouse = null;
    let c = e.keyCode ? e.keyCode : e.charCode;
    if (c != 112)
      // hideInfo();
      switch (c) {
        case 84: // t
          showTriangles = !showTriangles;
          updateSquares();
          break;
        case 83: // s
          store = [];
          break;
        case 49: // 1
        case 50: // 2
        case 51: // 3
        case 52: // 4
        case 53: // 5
        case 54: // 6
        case 55: // 7
        case 56: // 8
        case 57: // 9
          const n = c - 48;
          if (store) {
            storedMoves[n] = store;
            this.storeMoves();
            store = false;
          } else if (!animation) {
            if (invert)
              this.runStoredMovesReverse(n);
            else
              this.runStoredMoves(n);
          }
          break;
        case 73: // i
          invert = true;
          store = false;
          break;
        case 66: // b
          lastChar = "b";
          break;
        case 79: // o
          lastChar = "o";
          break;
        case 71: // g
          lastChar = "g";
          break;
        case 82: // r
          lastChar = "r";
          break;
        case 87: // w
          lastChar = "w";
          break;
        case 89: // y
          lastChar = "y";
          break;
        case 67: // c
          lastChar = "c";
          break;
        case 77: // m
          lastChar = "m";
          break;
        case 48: // 0 (zero)
          if (!animation)
            this.resetCubes();
          break;
        case 65: // a
          if (!animation)
            this.randomMovement();
          break;
        case 39: // ->
          if (lastChar == "c")
            this.rotate([0, 1, 0], true, true);
          else if (lastChar == "m")
            this.middleMove([0, 1, 0]);
          else if (lastChar)
            this.rotate(axisFromChar(lastChar), false);
          break;
        case 37: // <-
          if (lastChar == "c")
            this.rotate([0, 1, 0], false, true);
          else if (lastChar == "m")
            this.middleMove([0, -1, 0]);
          else if (lastChar)
            this.rotate(axisFromChar(lastChar));
          break;
        case 38: // up arrow
          if (lastChar == "m")
            this.middleMove([0, 0, -1]);
          else if (lastChar == "c")
            this.rotate([0, 0, 1], false, true);
          break;
        case 40: // down arrow
          if (lastChar == "m")
            this.middleMove([0, 0, 1]);
          else if (lastChar == "c")
            this.rotate([0, 0, 1], true, true);
          break;
        case 33: // page up
          if (lastChar == "c")
            this.rotate([1, 0, 0], true, true);
          else if (lastChar == "m")
            this.middleMove([-1, 0, 0]);
          break;
        case 34: // page down
          if (lastChar == "c")
            this.rotate([1, 0, 0], false, true);
          else if (lastChar == "m")
            this.middleMove([1, 0, 0]);
          break;
        case 112: // F1
          // toggleInfo();
          break;
        case 72: // h
          showSVG = !showSVG;
          this.onResize();
          break;
      }
    if (c != 73)
      invert = false;
  }

  mouseDown = (event, touch) => {

    // "special": right button or more than one finger
    let special = false;
    if (touch) {
      special = event.touches.length > 1;
      event = event.touches[0];
    } else {
      special = event.button == 2;
    }
    // hideInfo();
    if (animation) {
      lastMouse = null;
      return;
    }

    const dx = event.clientX - renderer.domElement.offsetLeft;
    const dy = renderer.domElement.offsetTop - event.clientY;
    // normalized device coordinates

    let mouseNDC = new THREE.Vector2(
      dx / renderer.domElement.width * 2 - 1,
      dy / renderer.domElement.height * 2 + 1
    );


    raycaster.setFromCamera(mouseNDC, camera);
    const intersects = raycaster.intersectObjects(cubes.map(cube => cube.mesh));
    // lastMouse remembers starting position and mouse button (0 is
    // left, 2 is right); first element is cube nearest to camera (or
    // nothing)
    if (intersects.length > 0)
      lastMouse = [intersects[0], event.clientX, event.clientY, special];
    else {
      const double = touch && doubleTouch();
      // double touch in upper left corner?
      if (double && Math.hypot(dx, dy) < diag / 4) {
        this.resetCubes();
        return;
        // double touch in lower left corner?
      } else if (double && Math.hypot(dx, renderer.domElement.height + dy) < diag / 4) {
        this.randomMovement();
        return;
        // right side
      } else if (double && !showSVG && Math.abs(renderer.domElement.width - dx) < diag / 4) {
        showSVG = true;
        this.onResize();
        return;
      }
      lastMouse = [null, event.clientX, event.clientY, special];
    }
  }

  directedCall = (reference1, reference2, changeX, changeY, directionFunctions) => {
    const direction = this.findDirection(reference1, reference2, changeX, changeY);

    const [selectedFunction, ...args] = directionFunctions[direction];
    selectedFunction(...args);
  }

  faceIndexToVec = (faceIndex, mesh) => {
    const dir = new THREE.Vector3(...colorDirs[Math.floor(faceIndex / 2)]);
    dir.applyQuaternion(mesh.quaternion);
    dir.round();
    return dir.toArray();
  }

  cubeIndex = (x, y, z) => {

    return (x + 1) + 3 * (y + 1) + 9 * (z + 1);
  }

  vecEq = (v1, v2) => {

    return v1[0] == v2[0] && v1[1] == v2[1] && v1[2] == v2[2];
  }

  directedCall = (reference1, reference2, changeX, changeY, directionFunctions) => {
    const direction = this.findDir(reference1, reference2, changeX, changeY);
    const [selectedFunction, ...args] = directionFunctions[direction];
    selectedFunction(...args);
  }

  findDir = (r, u, dx, dy) => {
    r = (r / 180 * Math.PI);
    u = (u / 180 * Math.PI);
    const angle = Math.atan2(-dy, dx);
    let min = 1000;
    let index = -1;
    let i = 0;
    for (let given of [r, r + Math.PI, u, u + Math.PI]) {
      const dist = this.angleDist(angle, given);
      if (dist < min) {
        min = dist;
        index = i;
      }
      i += 1;
    }
    return index;
  }

  angleDist = (a1, a2) => {
    a1 = a1 % (2 * Math.PI);
    a2 = a2 % (2 * Math.PI);
    return Math.min(Math.abs(a1 - a2), Math.abs(a1 + 2 * Math.PI - a2));
  }

  resetCubes = () => {
    store = false;
    let i = 0;
    for (let x of [-1, 0, 1]) {
      for (let y of [-1, 0, 1]) {
        for (let z of [-1, 0, 1]) {
          // skip middle cube
          if (this.cubeIndex(x, y, z) == 13)
            continue;
          const cubeMesh = cubes[i].mesh;
          cubeMesh.position.x = size * x;
          cubeMesh.position.y = size * y;
          cubeMesh.position.z = size * z;
          cubeMesh.rotation.x = 0;
          cubeMesh.rotation.x = 0;
          cubeMesh.rotation.y = 0;
          cubeMesh.rotation.z = 0;
          cubes[i].coords = [x, y, z];
          cubes[i].color = this.origColor(x, y, z);
          i += 1;
        }
      }
    }
    // reset triangle rotations
    for (let name of ["g", "y", "r", "w", "b", "o"])
      triangles[name][3] = 0;
    this.render();
    this.updateSquares();
  }


  mouseMove = (event, touch) => {


    if (!lastMouse)
      return;
    if (animation) {
      lastMouse = null;
      return;
    }
    if (touch)
      event = event.touches[0];
    const [thing, oldX, oldY, special] = lastMouse;
    const dx = event.clientX - oldX;
    const dy = event.clientY - oldY;
    if (Math.hypot(dx, dy) < moveDist)
      return;
    if (!thing) {
      if (!special)
        this.directedCall(0, 90, dx, dy, [[0, 1, 0], [0, -1, 0], [0, 0, -1], [0, 0, 1]].map(vec => [this.rotate, vec, true, true]));
      else
        this.directedCall(0, 90, dx, dy, [[0, 1, 0], [0, -1, 0], [-1, 0, 0], [1, 0, 0]].map(vec => [this.rotate, vec, true, true]));
    } else {
      const faceVec = this.faceIndexToVec(thing.faceIndex, thing.object);
      const coords = cubes.find(cube => cube.mesh == thing.object).coords;

      switch (this.cubeIndex(...coords)) {
        // front cubes are [-1,vert,horiz]
        case this.cubeIndex(-1, -1, -1): // bottom left
          this.directedCall(-20, 95, dx, dy, [
            [this.rotate, [0, -1, 0], false],
            [this.rotate, [0, -1, 0], true],
            [this.rotate, [0, 0, -1], true],
            [this.rotate, [0, 0, -1], false]
          ]);
          break;
        case this.cubeIndex(-1, -1, 0): // bottom middle
          this.directedCall(-20, 93, dx, dy, [
            [this.rotate, [0, -1, 0], false],
            [this.rotate, [0, -1, 0], true],
            [this.middleMove, [0, 0, -1]],
            [this.middleMove, [0, 0, 1]]
          ]);
          break;
        case this.cubeIndex(-1, -1, 1): // bottom right
          if (this.vecEq(faceVec, [-1, 0, 0]))
            // front face
            this.directedCall(-20, 93, dx, dy, [
              [this.rotate, [0, -1, 0], false],
              [this.rotate, [0, -1, 0], true],
              [this.rotate, [0, 0, 1], false],
              [this.rotate, [0, 0, 1], true]
            ]);
          else
            // must be right face
            this.directedCall(50, 85, dx, dy, [
              [this.rotate, [0, -1, 0], false],
              [this.rotate, [0, -1, 0], true],
              [this.rotate, [-1, 0, 0], true],
              [this.rotate, [-1, 0, 0], false]
            ]);
          break;
        case this.cubeIndex(-1, 0, -1): // middle left
          this.directedCall(-20, 95, dx, dy, [
            [this.middleMove, [0, 1, 0]],
            [this.middleMove, [0, -1, 0]],
            [this.rotate, [0, 0, -1], true],
            [this.rotate, [0, 0, -1], false]
          ]);
          break;
        case this.cubeIndex(-1, 0, 0): // center
          this.directedCall(-20, 93, dx, dy, [
            [this.middleMove, [0, 1, 0]],
            [this.middleMove, [0, -1, 0]],
            [this.middleMove, [0, 0, -1]],
            [this.middleMove, [0, 0, 1]]
          ]);
          break;
        case this.cubeIndex(-1, 0, 1): // middle right
          if (this.vecEq(faceVec, [-1, 0, 0]))
            // front face
            this.directedCall(-20, 93, dx, dy, [
              [this.middleMove, [0, 1, 0]],
              [this.middleMove, [0, -1, 0]],
              [this.rotate, [0, 0, 1], false],
              [this.rotate, [0, 0, 1], true]
            ]);
          else
            // must be right face
            this.directedCall(50, 85, dx, dy, [
              [this.middleMove, [0, 1, 0]],
              [this.middleMove, [0, -1, 0]],
              [this.rotate, [-1, 0, 0], true],
              [this.rotate, [-1, 0, 0], false]
            ]);
          break;
        case this.cubeIndex(-1, 1, -1): // top left
          if (this.vecEq(faceVec, [-1, 0, 0]))
            // front face
            this.directedCall(-20, 93, dx, dy, [
              [this.rotate, [0, 1, 0], true],
              [this.rotate, [0, 1, 0], false],
              [this.rotate, [0, 0, -1], true],
              [this.rotate, [0, 0, -1], false]
            ]);
          else
            // must be top face
            this.directedCall(-10, 25, dx, dy, [
              [this.rotate, [-1, 0, 0], false],
              [this.rotate, [-1, 0, 0], true],
              [this.rotate, [0, 0, -1], true],
              [this.rotate, [0, 0, -1], false]
            ]);
          break;
        case this.cubeIndex(-1, 1, 0): // top middle
          if (this.vecEq(faceVec, [-1, 0, 0]))
            // front face
            this.directedCall(-20, 93, dx, dy, [
              [this.rotate, [0, 1, 0], true],
              [this.rotate, [0, 1, 0], false],
              [this.middleMove, [0, 0, -1]],
              [this.middleMove, [0, 0, 1]]
            ]);
          else
            // must be top face
            this.directedCall(-10, 25, dx, dy, [
              [this.rotate, [-1, 0, 0], false],
              [this.rotate, [-1, 0, 0], true],
              [this.middleMove, [0, 0, -1]],
              [this.middleMove, [0, 0, 1]]
            ]);
          break;
        case this.cubeIndex(-1, 1, 1): // top right
          if (this.vecEq(faceVec, [-1, 0, 0]))
            // front face
            this.directedCall(-20, 93, dx, dy, [
              [this.rotate, [0, 1, 0], true],
              [this.rotate, [0, 1, 0], false],
              [this.rotate, [0, 0, 1], false],
              [this.rotate, [0, 0, 1], true]
            ]);
          else if (this.vecEq(faceVec, [0, 0, 1]))
            // right face
            this.directedCall(50, 85, dx, dy, [
              [this.rotate, [0, 1, 0], true],
              [this.rotate, [0, 1, 0], false],
              [this.rotate, [-1, 0, 0], true],
              [this.rotate, [-1, 0, 0], false]
            ]);
          else
            // must be top face
            this.directedCall(-10, 25, dx, dy, [
              [this.rotate, [-1, 0, 0], false],
              [this.rotate, [-1, 0, 0], true],
              [this.rotate, [0, 0, 1], false],
              [this.rotate, [0, 0, 1], true]
            ]);
          break;
        // top cubes are [vert,1,horiz]
        case this.cubeIndex(1, 1, -1): // top left
          this.directedCall(-10, 25, dx, dy, [
            [this.rotate, [1, 0, 0], true],
            [this.rotate, [1, 0, 0], false],
            [this.rotate, [0, 0, -1], true],
            [this.rotate, [0, 0, -1], false]
          ]);
          break;
        case this.cubeIndex(1, 1, 0): // top middle
          this.directedCall(-10, 25, dx, dy, [
            [this.rotate, [1, 0, 0], true],
            [this.rotate, [1, 0, 0], false],
            [this.middleMove, [0, 0, -1]],
            [this.middleMove, [0, 0, 1]]
          ]);
          break;
        case this.cubeIndex(1, 1, 1): // top right
          if (this.vecEq(faceVec, [0, 1, 0]))
            // top face
            this.directedCall(-10, 25, dx, dy, [
              [this.rotate, [1, 0, 0], true],
              [this.rotate, [1, 0, 0], false],
              [this.rotate, [0, 0, 1], false],
              [this.rotate, [0, 0, 1], true]
            ]);
          // must be right face
          this.directedCall(50, 85, dx, dy, [
            [this.rotate, [0, 1, 0], true],
            [this.rotate, [0, 1, 0], false],
            [this.rotate, [1, 0, 0], false],
            [this.rotate, [1, 0, 0], true]
          ]);
          break;
        case this.cubeIndex(0, 1, -1): // middle left
          this.directedCall(-10, 25, dx, dy, [
            [this.middleMove, [1, 0, 0]],
            [this.middleMove, [-1, 0, 0]],
            [this.rotate, [0, 0, -1], true],
            [this.rotate, [0, 0, -1], false]
          ]);
          break;
        case this.cubeIndex(0, 1, 0): // center
          this.directedCall(-10, 25, dx, dy, [
            [this.middleMove, [1, 0, 0]],
            [this.middleMove, [-1, 0, 0]],
            [this.middleMove, [0, 0, -1]],
            [this.middleMove, [0, 0, 1]]
          ]);
          break;
        case this.cubeIndex(0, 1, 1): // middle right
          if (this.vecEq(faceVec, [0, 1, 0]))
            // top face
            this.directedCall(-10, 25, dx, dy, [
              [this.middleMove, [1, 0, 0]],
              [this.middleMove, [-1, 0, 0]],
              [this.rotate, [0, 0, 1], false],
              [this.rotate, [0, 0, 1], true]
            ]);
          // must be right face
          this.directedCall(50, 85, dx, dy, [
            [this.rotate, [0, 1, 0], true],
            [this.rotate, [0, 1, 0], false],
            [this.middleMove, [-1, 0, 0]],
            [this.middleMove, [1, 0, 0]]
          ]);
          break;
        // right cubes are [horiz,vert,1]
        case this.cubeIndex(1, -1, 1): // bottom right
          this.directedCall(50, 85, dx, dy, [
            [this.rotate, [0, -1, 0], false],
            [this.rotate, [0, -1, 0], true],
            [this.rotate, [1, 0, 0], false],
            [this.rotate, [1, 0, 0], true]
          ]);
          break;
        case this.cubeIndex(0, -1, 1): // bottom middle
          this.directedCall(50, 85, dx, dy, [
            [this.rotate, [0, -1, 0], false],
            [this.rotate, [0, -1, 0], true],
            [this.middleMove, [-1, 0, 0]],
            [this.middleMove, [1, 0, 0]]
          ]);
          break;
        case this.cubeIndex(1, 0, 1): // middle right
          this.directedCall(50, 85, dx, dy, [
            [this.middleMove, [0, 1, 0]],
            [this.middleMove, [0, -1, 0]],
            [this.rotate, [1, 0, 0], false],
            [this.rotate, [1, 0, 0], true]
          ]);
          break;
        case this.cubeIndex(0, 0, 1): // center
          this.directedCall(50, 85, dx, dy, [
            [this.middleMove, [0, 1, 0]],
            [this.middleMove, [0, -1, 0]],
            [this.middleMove, [-1, 0, 0]],
            [this.middleMove, [1, 0, 0]]
          ]);
          break;
      }
    }
  }

  middleMove = (v, duration = 500, nextMove = null) => {
    this.rotate(v, true, 1, duration, nextMove);
  }

  rotate = (vec, plus = true, all = false, duration = 500, next = null) => {
    // do nothing if another animation is running
    if (animation)
      return;
    if (store)
      store.push([vec, plus, all]);
    // reverse direction if the non-zero component is negative
    const rev = vec.some(comp => comp < 0);
    if (rev)
      plus = !plus;
    // angle is for the cube positions, angle2 is for the local
    // rotations
    const angle = plus ? Math.PI / 2 : -Math.PI / 2;
    const angle2 = rev ? -angle : angle;
    // update triangle rotations
    if (all === false)
      triangles[this.findCubeAt(vec).color][3] += angle2 > 0 ? -1 : 1;
    else if (all == 1) {
      triangles[this.findCubeAt(vec).color][3] += angle2 > 0 ? 1 : -1;
      triangles[this.findCubeAt([-vec[0], -vec[1], -vec[2]]).color][3] += angle2 > 0 ? -1 : 1;
    }
    // the index of the non-zero component
    const index = vec.findIndex(el => el != 0);
    const vec3 = new THREE.Vector3(...vec);
    // remember local rotations before this action
    for (let cube of cubes) {
      cube.oldQuaternion = new THREE.Quaternion();
      cube.oldQuaternion.copy(cube.mesh.quaternion);
    }
    animation = true;
    this.runAction(
      duration,
      value => {
        const q = new THREE.Quaternion();
        q.setFromAxisAngle(vec3, value * angle2);
        for (let cube of cubes) {
          if (all === true || (all === 1 && this.rectTo(vec, cube.coords)) || (!all && this.sameSide(vec, cube.coords))) {
            const turned = this.turn(cube, index, value * angle);
            for (let i = 0; i < 3; i++)
              cube.mesh.position[chars[i]] = size * turned[i];
            const qq = new THREE.Quaternion();
            qq.multiplyQuaternions(q, cube.oldQuaternion);
            qq.normalize();
            cube.mesh.setRotationFromQuaternion(qq);
          }
        }
        // renderFunction();
      },
      () => {
        // recompute the "simplified coordinates" after rotation
        for (let cube of cubes)
          if (all === true || (all === 1 && this.rectTo(vec, cube.coords)) || (!all && this.sameSide(vec, cube.coords)))
            cube.coords = this.turn(cube, index, angle).map(Math.round);
        // update SVG if this was a move (and not a rotation of the
        // whole cube)
        if (all !== true)
          this.updateSquares();
        animation = false;
        if (next)
          next();
      }
    );
  }

  rectTo = (vec, coords) => {
    return coords[vec.findIndex(el => el != 0)] == 0;
  }

  sameSide = (side, coords) => {
    return coords.every((coord, i) => side[i] == 0 || side[i] == coord);
  }

  turn = (cube, keep, angle) => {
    const xIndex = (keep + 1) % 3;
    const yIndex = (keep + 2) % 3;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let newX = c * cube.coords[xIndex] - s * cube.coords[yIndex];
    let newY = s * cube.coords[xIndex] + c * cube.coords[yIndex];
    const result = [0, 0, 0];
    result[keep] = cube.coords[keep];
    result[xIndex] = newX;
    result[yIndex] = newY;
    return result;
  }

  findCubeAt = (v) => {
    return cubes.find(cube => this.vecEq(cube.coords, v));
  }

  updateSquares = () => {

    for (let name of ["g", "y", "r", "w", "b", "o"]) {
      // all cubes on the side of middle square with this color
      const c = this.findAllCubes(name);
      // the direction this color "looks at"
      const v = this.axisFromChar(name);
      // for this to work findAllCubes must return the cubes in a
      // specific order
      for (let i = 0; i < 9; i++) {
        squares[name][i].setAttribute("fill", this.colorInDir(c[i], v));
        if (i == 4) {
          const [triangle, cx, cy, r] = triangles[name];
          triangle.setAttribute("transform", `rotate(${r * 90}, ${cx}, ${cy})`);
          triangle.setAttribute("fill", showTriangles ? "black" : "none");
        }
      }
    }
  }

  // makes sure x is between m and M
  clip = (x, m = 0, M = 1) => {
    return Math.max(m, Math.min(M, x));
  }

  quadUp = (t) => {
    return this.clip(t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
  }

  runAction = (duration, setter, finish) => {
    let start = performance.now();
    let run = () => {
      let value = performance.now() - start;
      if (value >= duration) {
        setter(1);
        finish();
      } else {
        let val = this.quadUp(value / duration)
        setter(val);
        window.requestAnimationFrame(run);
      };
    };
    run();
  }

  mouseUp = () => {

    lastMouse = null;
  }

  touchStart = (event) => {

    event.preventDefault();
    mouseDown(event, event.touches);
  }

  mouseUp = () => {

    lastMouse = null;
  }

  touchMove = (event) => {

    event.preventDefault();
    mouseMove(event, event.touches, this);
  }

  svgTouchStart = () => {

    if (doubleTouch()) {
      showSVG = false;
      resize();
    }
  }

  render = () => {
    const elapsedTime = this.clock.getElapsedTime();

    // this.planeMesh.rotation.x = 0.2 * elapsedTime;
    // this.planeMesh.rotation.y = 0.1 * elapsedTime;

    renderer.render(this.scene, camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize = () => {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize = () => {
    device.width = window.innerWidth;
    device.height = window.innerHeight;

    camera.aspect = device.width / device.height;
    camera.updateProjectionMatrix();

    renderer.setSize(device.width, device.height);
    renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
  }
}
