// ─── Types ────────────────────────────────────────────────────────────────────

type Vec3 = { x: number; y: number; z: number };
type SignalState = "moving" | "paused" | "impact";
type Direction = 1 | -1;

interface Projected {
  sx: number;
  sy: number;
  depth: number;
  scale: number;
}

interface Camera {
  yaw: number;
  pitch: number;
  zoom: number;
  panX: number;
  panY: number;
  distance: number;
}

interface Path {
  id: number;
  nodes: Vec3[];
  segLengths: number[];
  totalLength: number;
  color: string;
  thickness: number;
  opacity: number;
  active: boolean;
  diagonal: boolean;
}

interface Signal {
  id: number;
  pathId: number;
  segIndex: number;
  progress: number;
  direction: Direction;
  speed: number;
  colorFwd: string;
  colorBwd: string;
  tailLength: number;
  pauseDuration: number;
  pauseTime: number;
  state: SignalState;
}

interface ImpactEffect {
  pos: Vec3;
  age: number;
  maxAge: number;
  color: string;
}

interface InputState {
  rotating: boolean;
  panning: boolean;
  lastX: number;
  lastY: number;
}

interface SceneState {
  paths: Path[];
  pathMap: Map<number, Path>;
  signals: Signal[];
  impacts: ImpactEffect[];
  camera: Camera;
  input: InputState;
  time: number;
}

// ─── Math ─────────────────────────────────────────────────────────────────────

function v3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

function dist3(a: Vec3, b: Vec3): number {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function rng(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function snap(v: number, g: number): number {
  return Math.round(v / g) * g;
}

function pickRandom<T>(arr: [T, ...T[]]): T {
  return arr[Math.floor(Math.random() * arr.length)] ?? arr[0];
}

// ─── Projection ───────────────────────────────────────────────────────────────

function projectPoint(p: Vec3, cam: Camera, cx: number, cy: number): Projected | null {
  const x = p.x + cam.panX;
  const y = p.y + cam.panY;
  const z = p.z;

  const cosY = Math.cos(cam.yaw),
    sinY = Math.sin(cam.yaw);
  const rx = x * cosY + z * sinY;
  const rz = -x * sinY + z * cosY;

  const cosP = Math.cos(cam.pitch),
    sinP = Math.sin(cam.pitch);
  const ry = y * cosP - rz * sinP;
  const fz = y * sinP + rz * cosP + cam.distance;

  if (fz <= 1) return null;

  const focal = 700 * cam.zoom;
  const scale = focal / fz;
  return { sx: cx + rx * scale, sy: cy + ry * scale, depth: fz, scale };
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const _colorCache = new Map<string, [number, number, number]>();
const _rgbaCache = new Map<string, string>();

function getRgb(hex: string): [number, number, number] {
  let c = _colorCache.get(hex);
  if (!c) {
    c = [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ];
    _colorCache.set(hex, c);
  }
  return c;
}

function rgba(hex: string, alpha: number): string {
  const a = Math.round(alpha * 50) / 50;
  const key = hex + a;
  let v = _rgbaCache.get(key);
  if (!v) {
    const [r, g, b] = getRgb(hex);
    const ac = a < 0 ? 0 : a > 1 ? 1 : a;
    v = `rgba(${r},${g},${b},${ac})`;
    _rgbaCache.set(key, v);
  }
  return v;
}

function depthFade(depth: number): number {
  return clamp(1.0 - (depth - 250) / 1400, 0.04, 1.0);
}

// ─── Path builder ─────────────────────────────────────────────────────────────

function buildPath(
  id: number,
  nodes: Vec3[],
  color: string,
  thickness: number,
  opacity: number,
  active: boolean,
  diagonal: boolean = false,
): Path {
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (!a || !b) continue;
    const d = dist3(a, b);
    segLengths.push(d);
    total += d;
  }
  return { id, nodes, segLengths, totalLength: total, color, thickness, opacity, active, diagonal };
}

// ─── Scene generation ─────────────────────────────────────────────────────────

function generateScene(): SceneState {
  const GRID = 50;
  const W = 520,
    H = 160,
    D = 520;
  const paths: Path[] = [];
  let id = 0;

  const infraColors: [string, ...string[]] = [
    "#0a2040",
    "#0d2a50",
    "#091a34",
    "#0f2244",
    "#071528",
  ];
  const activeColors: [string, ...string[]] = [
    "#00e5ff",
    "#18ffff",
    "#00bcd4",
    "#4dd0e1",
    "#76ff03",
    "#69f000",
    "#00e676",
    "#1de9b6",
  ];
  const particleColor = "#8ab4cc";

  function makeCircuitPath(active: boolean): Vec3[] {
    const nodes: Vec3[] = [];
    const cx = snap(rng(-W / 2, W / 2), GRID);
    const cy = snap(rng(-H / 2, H / 2), GRID / 2);
    const cz = snap(rng(-D / 2, D / 2), GRID);
    nodes.push(v3(cx, cy, cz));

    const steps = active ? Math.floor(rng(2, 7)) : Math.floor(rng(1, 5));
    for (let s = 0; s < steps; s++) {
      const axis = Math.floor(rng(0, 3));
      const mag = snap(rng(GRID, GRID * (active ? 4 : 5)), GRID);
      const sign = Math.random() < 0.5 ? 1 : -1;
      const prev = nodes.at(-1);
      if (!prev) continue;
      let nx = prev.x,
        ny = prev.y,
        nz = prev.z;
      if (axis === 0) nx = clamp(nx + mag * sign, -W / 2, W / 2);
      else if (axis === 1) ny = clamp(ny + mag * sign * 0.4, -H / 2, H / 2);
      else nz = clamp(nz + mag * sign, -D / 2, D / 2);
      if (nx !== prev.x || ny !== prev.y || nz !== prev.z) nodes.push(v3(nx, ny, nz));
    }
    if (nodes.length < 2) {
      const first = nodes[0];
      if (first) nodes.push(v3(first.x + GRID, first.y, first.z));
    }
    return nodes;
  }

  for (let i = 0; i < 110; i++) {
    const nodes = makeCircuitPath(false);
    const color = pickRandom(infraColors);
    paths.push(buildPath(id++, nodes, color, rng(0.3, 0.9), rng(0.1, 0.32), false));
  }

  for (let i = 0; i < 55; i++) {
    const nodes = makeCircuitPath(true);
    const color = pickRandom(activeColors);
    paths.push(buildPath(id++, nodes, color, rng(0.4, 1.4), rng(0.4, 0.85), true));
  }

  for (let i = 0; i < 40; i++) {
    const ox = rng(-W / 2, W / 2);
    const oy = rng(-H / 2, H / 2);
    const oz = rng(-D / 2, D / 2);
    const angle = rng(0, Math.PI * 2);
    const tilt = rng(-0.6, 0.6);
    const len = rng(30, 180);
    const ex = ox + Math.cos(angle) * len;
    const ey = oy + tilt * len * 0.4;
    const ez = oz + Math.sin(angle) * len;
    paths.push(
      buildPath(
        id++,
        [v3(ox, oy, oz), v3(ex, ey, ez)],
        particleColor,
        rng(0.2, 0.7),
        rng(0.08, 0.22),
        false,
        true,
      ),
    );
  }

  const signals: Signal[] = [];
  let sid = 0;
  for (const path of paths) {
    if (!path.active || path.nodes.length < 2) continue;
    if (Math.random() > 0.72) continue;

    const color = path.color;
    signals.push({
      id: sid++,
      pathId: path.id,
      segIndex: Math.floor(rng(0, path.nodes.length - 1)),
      progress: Math.random(),
      direction: 1,
      speed: rng(35, 130),
      colorFwd: color,
      colorBwd: color,
      tailLength: rng(0.07, 0.28),
      pauseDuration: rng(0.1, 0.7),
      pauseTime: 0,
      state: "moving",
    });
  }

  const pathMap = new Map<number, Path>();
  for (const p of paths) pathMap.set(p.id, p);

  return {
    paths,
    pathMap,
    signals,
    impacts: [],
    camera: { yaw: -0.45, pitch: 0.38, zoom: 1.0, panX: 0, panY: 0, distance: 720 },
    input: { rotating: false, panning: false, lastX: 0, lastY: 0 },
    time: 0,
  };
}

// ─── Signal helpers ───────────────────────────────────────────────────────────

function getSignalPos(sig: Signal, path: Path): Vec3 {
  const seg = clamp(sig.segIndex, 0, path.nodes.length - 2);
  const a = path.nodes[seg];
  const b = path.nodes[seg + 1];
  if (!a || !b) return { x: 0, y: 0, z: 0 };
  return lerp3(a, b, sig.progress);
}

function getTailPoints(sig: Signal, path: Path, tailWorldLen: number): Vec3[] {
  const points: Vec3[] = [];
  const headSeg = clamp(sig.segIndex, 0, path.nodes.length - 2);

  const headA = path.nodes[headSeg];
  const headB = path.nodes[headSeg + 1];
  if (!headA || !headB) return points;
  points.push(lerp3(headA, headB, sig.progress));

  let remaining = tailWorldLen;
  let curSeg = headSeg;
  let distFromSegStart = sig.progress * (path.segLengths[curSeg] || 1);

  while (remaining > 0 && points.length < 16) {
    if (distFromSegStart >= remaining) {
      const t = (distFromSegStart - remaining) / (path.segLengths[curSeg] || 1);
      const nodeA = path.nodes[curSeg];
      const nodeB = path.nodes[curSeg + 1];
      if (!nodeA || !nodeB) break;
      points.push(lerp3(nodeA, nodeB, t));
      break;
    }
    remaining -= distFromSegStart;
    const node = path.nodes[curSeg];
    if (!node) break;
    points.push({ ...node });
    if (curSeg <= 0) break;
    curSeg--;
    distFromSegStart = path.segLengths[curSeg] || 1;
  }

  return points;
}

// ─── Update ───────────────────────────────────────────────────────────────────

function updateSignals(scene: SceneState, dt: number): void {
  const { signals, pathMap, impacts } = scene;

  for (const sig of signals) {
    if (sig.state === "paused") {
      sig.pauseTime += dt;
      if (sig.pauseTime >= sig.pauseDuration) {
        sig.pauseTime = 0;
        sig.direction = (sig.direction === 1 ? -1 : 1) as Direction;
        sig.state = "moving";
      }
      continue;
    }

    if (sig.state === "impact") {
      sig.state = "paused";
      continue;
    }

    const path = pathMap.get(sig.pathId);
    if (!path || path.nodes.length < 2) continue;

    const segLen = path.segLengths[sig.segIndex] || 1;
    const dp = (sig.speed / segLen) * dt * sig.direction;
    sig.progress += dp;

    if (sig.progress >= 1) {
      if (sig.direction === 1 && sig.segIndex < path.nodes.length - 2) {
        sig.progress -= 1;
        sig.segIndex++;
      } else {
        sig.progress = 1;
        sig.state = "impact";
        const pos = getSignalPos(sig, path);
        if (impacts.length < 60)
          impacts.push({ pos: { ...pos }, age: 0, maxAge: 0.45, color: sig.colorFwd });
      }
    } else if (sig.progress < 0) {
      if (sig.direction === -1 && sig.segIndex > 0) {
        sig.segIndex--;
        sig.progress = 1 + sig.progress;
      } else {
        sig.progress = 0;
        sig.state = "impact";
        const pos = getSignalPos(sig, path);
        if (impacts.length < 60)
          impacts.push({ pos: { ...pos }, age: 0, maxAge: 0.45, color: sig.colorFwd });
      }
    }
  }

  for (let i = impacts.length - 1; i >= 0; i--) {
    const impact = impacts[i];
    if (!impact) continue;
    impact.age += dt;
    if (impact.age > impact.maxAge) impacts.splice(i, 1);
  }
}

// ─── Draw ─────────────────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const grad = ctx.createRadialGradient(
    w * 0.5,
    h * 0.5,
    0,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.72,
  );
  grad.addColorStop(0, "#07101f");
  grad.addColorStop(0.45, "#040c18");
  grad.addColorStop(1, "#020609");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function drawPaths(ctx: CanvasRenderingContext2D, scene: SceneState, cx: number, cy: number): void {
  const { paths, camera } = scene;

  for (const path of paths) {
    if (path.nodes.length < 2) continue;

    for (let i = 0; i < path.nodes.length - 1; i++) {
      const nodeA = path.nodes[i];
      const nodeB = path.nodes[i + 1];
      if (!nodeA || !nodeB) continue;

      const pA = projectPoint(nodeA, camera, cx, cy);
      const pB = projectPoint(nodeB, camera, cx, cy);
      if (!pA || !pB) continue;

      const avgDepth = (pA.depth + pB.depth) * 0.5;
      const fade = depthFade(avgDepth);
      const alpha = path.opacity * fade;
      if (alpha < 0.012) continue;

      const avgScale = (pA.scale + pB.scale) * 0.5;
      const lw = path.thickness * clamp(avgScale / 85, 0.2, 3.5);

      if (path.active) {
        ctx.beginPath();
        ctx.moveTo(pA.sx, pA.sy);
        ctx.lineTo(pB.sx, pB.sy);
        ctx.strokeStyle = rgba(path.color, alpha * 0.18);
        ctx.lineWidth = lw * 5;
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.moveTo(pA.sx, pA.sy);
      ctx.lineTo(pB.sx, pB.sy);
      ctx.strokeStyle = rgba(path.color, alpha);
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }
}

function drawSignals(
  ctx: CanvasRenderingContext2D,
  scene: SceneState,
  cx: number,
  cy: number,
): void {
  const { signals, pathMap, camera } = scene;

  for (const sig of signals) {
    if (sig.state === "paused") continue;
    const path = pathMap.get(sig.pathId);
    if (!path || path.nodes.length < 2) continue;

    const color = sig.direction === 1 ? sig.colorFwd : sig.colorBwd;
    const headPos = getSignalPos(sig, path);
    const headProj = projectPoint(headPos, camera, cx, cy);
    if (!headProj) continue;

    const fade = depthFade(headProj.depth);
    const segIdx = clamp(sig.segIndex, 0, path.segLengths.length - 1);
    const segLen = path.segLengths[segIdx] || 80;
    const tailWorldLen = segLen * sig.tailLength;

    const tail = getTailPoints(sig, path, tailWorldLen);
    if (tail.length < 2) continue;

    const proj: (Projected | null)[] = [];
    for (const tp of tail) proj.push(projectPoint(tp, camera, cx, cy));

    for (let i = 0; i < proj.length - 1; i++) {
      const pA = proj[i];
      const pB = proj[i + 1];
      if (!pA || !pB) continue;
      const t = 1 - i / proj.length;
      const alpha = t * fade;
      const lw = clamp(pA.scale / 75, 0.4, 4);

      ctx.beginPath();
      ctx.moveTo(pA.sx, pA.sy);
      ctx.lineTo(pB.sx, pB.sy);
      ctx.strokeStyle = rgba(color, alpha * 0.28);
      ctx.lineWidth = lw * 6;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(pA.sx, pA.sy);
      ctx.lineTo(pB.sx, pB.sy);
      ctx.strokeStyle = rgba(color, alpha * 0.9);
      ctx.lineWidth = lw;
      ctx.stroke();
    }

    const dotR = clamp(headProj.scale / 55, 1, 5);
    ctx.beginPath();
    ctx.arc(headProj.sx, headProj.sy, dotR * 3, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, fade * 0.14);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(headProj.sx, headProj.sy, dotR, 0, Math.PI * 2);
    ctx.fillStyle = rgba(color, fade * 0.95);
    ctx.fill();
  }
}

function drawImpactEffects(
  ctx: CanvasRenderingContext2D,
  scene: SceneState,
  cx: number,
  cy: number,
): void {
  const { impacts, camera } = scene;

  for (const impact of impacts) {
    const proj = projectPoint(impact.pos, camera, cx, cy);
    if (!proj) continue;
    const t = 1 - impact.age / impact.maxAge;
    const fade = depthFade(proj.depth);
    const r = clamp(proj.scale / 38, 2, 18) * (1 + (1 - t) * 4);

    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy, r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(impact.color, t * fade * 0.7);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(proj.sx, proj.sy, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = rgba(impact.color, t * fade);
    ctx.fill();
  }
}

function render(ctx: CanvasRenderingContext2D, scene: SceneState, w: number, h: number): void {
  drawBackground(ctx, w, h);
  const cx = w / 2,
    cy = h / 2;
  drawPaths(ctx, scene, cx, cy);
  drawSignals(ctx, scene, cx, cy);
  drawImpactEffects(ctx, scene, cx, cy);
}

// ─── Input ────────────────────────────────────────────────────────────────────

function setupInput(canvas: HTMLCanvasElement, scene: SceneState): () => void {
  const { camera, input } = scene;
  let lastTouchDist = 0;

  function onMouseDown(e: MouseEvent): void {
    input.lastX = e.clientX;
    input.lastY = e.clientY;
    if (e.button === 2 || e.shiftKey) input.panning = true;
    else input.rotating = true;
    e.preventDefault();
  }

  function onMouseUp(): void {
    input.rotating = false;
    input.panning = false;
  }

  function onMouseMove(e: MouseEvent): void {
    const dx = e.clientX - input.lastX;
    const dy = e.clientY - input.lastY;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
    if (input.rotating) {
      camera.yaw -= dx * 0.005;
      camera.pitch = clamp(camera.pitch + dy * 0.005, -1.3, 1.3);
    } else if (input.panning) {
      camera.panX += (dx / camera.zoom) * 0.6;
      camera.panY += (dy / camera.zoom) * 0.6;
    }
  }

  function onWheel(e: WheelEvent): void {
    camera.zoom = clamp(camera.zoom * (1 - e.deltaY * 0.0009), 0.15, 6);
    e.preventDefault();
  }

  function onContextMenu(e: Event): void {
    e.preventDefault();
  }

  function onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (!touch) return;
      input.rotating = true;
      input.lastX = touch.clientX;
      input.lastY = touch.clientY;
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      if (!t0 || !t1) return;
      input.rotating = false;
      lastTouchDist = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    }
    e.preventDefault();
  }

  function onTouchEnd(): void {
    input.rotating = false;
  }

  function onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 1 && input.rotating) {
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - input.lastX;
      const dy = touch.clientY - input.lastY;
      camera.yaw += dx * 0.005;
      camera.pitch = clamp(camera.pitch + dy * 0.005, -1.3, 1.3);
      input.lastX = touch.clientX;
      input.lastY = touch.clientY;
    } else if (e.touches.length === 2) {
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      if (!t0 || !t1) return;
      const d = Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
      camera.zoom = clamp(camera.zoom * (d / lastTouchDist), 0.15, 6);
      lastTouchDist = d;
    }
    e.preventDefault();
  }

  canvas.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd);
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });

  return () => {
    canvas.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mouseup", onMouseUp);
    window.removeEventListener("mousemove", onMouseMove);
    canvas.removeEventListener("wheel", onWheel);
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("touchend", onTouchEnd);
    canvas.removeEventListener("touchmove", onTouchMove);
  };
}

// ─── Main loop ────────────────────────────────────────────────────────────────

export function main(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = 0,
    h = 0;

  function resize(): void {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  resize();
  window.addEventListener("resize", resize);

  const scene = generateScene();
  const cleanupInput = setupInput(canvas, scene);

  let rafId: number;
  let prevTime = 0;
  const AUTO_ROTATE_SPEED = 0.022;

  function loop(timestamp: number): void {
    const dt = Math.min((timestamp - prevTime) / 1000, 0.05);
    prevTime = timestamp;
    scene.time += dt;

    if (!scene.input.rotating && !scene.input.panning) {
      scene.camera.yaw += AUTO_ROTATE_SPEED * dt;
    }

    updateSignals(scene, dt);
    render(ctx, scene, w, h);
    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame((t: number) => {
    prevTime = t;
    loop(t);
  });

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", resize);
    cleanupInput();
  };
}
