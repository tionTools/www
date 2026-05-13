<template>
  <canvas ref="canvasRef" id="canvas"></canvas>
</template>

<script setup lang="ts">
import { main, v3, rng, snap, clamp, pickRandom, buildPath } from '@/lib/scene'
import type { SceneData, Path, Signal, Vec3 } from '@/lib/scene'
import { useTemplateRef, onMounted, onUnmounted } from 'vue'

const GRID = 50
const W = 520
const H = 160
const D = 520

const infraColors: [string, ...string[]] = ['#0a2040', '#0d2a50', '#091a34', '#0f2244', '#071528']

const activeColors: [string, ...string[]] = [
  '#00e5ff',
  '#18ffff',
  '#00bcd4',
  '#4dd0e1',
  '#76ff03',
  '#69f000',
  '#00e676',
  '#1de9b6',
]

const particleColor = '#8ab4cc'

function makeCircuitPath(active: boolean): Vec3[] {
  const nodes: Vec3[] = []
  const cx = snap(rng(-W / 2, W / 2), GRID)
  const cy = snap(rng(-H / 2, H / 2), GRID / 2)
  const cz = snap(rng(-D / 2, D / 2), GRID)
  nodes.push(v3(cx, cy, cz))

  const steps = active ? Math.floor(rng(2, 7)) : Math.floor(rng(1, 5))
  for (let s = 0; s < steps; s++) {
    const axis = Math.floor(rng(0, 3))
    const mag = snap(rng(GRID, GRID * (active ? 4 : 5)), GRID)
    const sign = Math.random() < 0.5 ? 1 : -1
    const prev = nodes.at(-1)
    if (!prev) continue
    let nx = prev.x,
      ny = prev.y,
      nz = prev.z
    if (axis === 0) nx = clamp(nx + mag * sign, -W / 2, W / 2)
    else if (axis === 1) ny = clamp(ny + mag * sign * 0.4, -H / 2, H / 2)
    else nz = clamp(nz + mag * sign, -D / 2, D / 2)
    if (nx !== prev.x || ny !== prev.y || nz !== prev.z) nodes.push(v3(nx, ny, nz))
  }

  if (nodes.length < 2) {
    const first = nodes[0]
    if (first) nodes.push(v3(first.x + GRID, first.y, first.z))
  }

  return nodes
}

function generateSceneData(): SceneData {
  const paths: Path[] = []
  let id = 0

  for (let i = 0; i < 110; i++) {
    const nodes = makeCircuitPath(false)
    paths.push(
      buildPath(id++, nodes, pickRandom(infraColors), rng(0.3, 0.9), rng(0.1, 0.32), false),
    )
  }

  for (let i = 0; i < 55; i++) {
    const nodes = makeCircuitPath(true)
    paths.push(
      buildPath(id++, nodes, pickRandom(activeColors), rng(0.4, 1.4), rng(0.4, 0.85), true),
    )
  }

  for (let i = 0; i < 40; i++) {
    const ox = rng(-W / 2, W / 2)
    const oy = rng(-H / 2, H / 2)
    const oz = rng(-D / 2, D / 2)
    const angle = rng(0, Math.PI * 2)
    const tilt = rng(-0.6, 0.6)
    const len = rng(30, 180)
    paths.push(
      buildPath(
        id++,
        [
          v3(ox, oy, oz),
          v3(ox + Math.cos(angle) * len, oy + tilt * len * 0.4, oz + Math.sin(angle) * len),
        ],
        particleColor,
        rng(0.2, 0.7),
        rng(0.08, 0.22),
        false,
        true,
      ),
    )
  }

  const signals: Signal[] = []
  let sid = 0
  for (const path of paths) {
    if (!path.active || path.nodes.length < 2) continue
    if (Math.random() > 0.72) continue
    signals.push({
      id: sid++,
      pathId: path.id,
      segIndex: Math.floor(rng(0, path.nodes.length - 1)),
      progress: Math.random(),
      direction: 1,
      speed: rng(35, 130),
      colorFwd: path.color,
      colorBwd: path.color,
      tailLength: rng(0.07, 0.28),
      pauseDuration: rng(0.1, 0.7),
      pauseTime: 0,
      state: 'moving',
    })
  }

  return { paths, signals }
}

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')
let cleanup: () => void

onMounted(() => {
  const data = generateSceneData()
  console.log(data)

  // const paths2: Path[] = [
  //   {
  //     id: 0,
  //     nodes: [
  //       { x: -100, y: 0, z: 50 },
  //       { x: 0, y: 0, z: 50 },
  //       { x: 0, y: 0, z: -100 },
  //     ],
  //     segLengths: [100, 150],
  //     totalLength: 250,
  //     color: '#ffffff',
  //     thickness: 0.6,
  //     opacity: 0.2,
  //     active: false,
  //     diagonal: false,
  //   },
  //   {
  //     id: 1,
  //     nodes: [
  //       { x: -200, y: 0, z: 0 },
  //       { x: -100, y: 0, z: 0 },
  //       { x: -100, y: 40, z: 0 },
  //       { x: 50, y: 40, z: 0 },
  //     ],
  //     segLengths: [100, 40, 150],
  //     totalLength: 290,
  //     color: '#ffffff',
  //     thickness: 1.0,
  //     opacity: 0.7,
  //     active: true,
  //     diagonal: false,
  //   },
  //   {
  //     id: 2,
  //     nodes: [
  //       { x: -60, y: -30, z: 80 },
  //       { x: 20, y: 10, z: -40 },
  //     ],
  //     segLengths: [149.7],
  //     totalLength: 149.7,
  //     color: '#ffffff',
  //     thickness: 0.4,
  //     opacity: 0.15,
  //     active: false,
  //     diagonal: true,
  //   },
  // ]
  const paths: Path[] = [
    buildPath(0, [v3(-100, 0, 50), v3(0, 0, 50), v3(0, 0, -100)], '#0a2040', 0.6, 0.2, false),
    buildPath(
      1,
      [v3(-200, 0, 0), v3(-100, 0, 0), v3(-100, 40, 0), v3(50, 40, 0)],
      '#00e5ff',
      1.0,
      0.7,
      true,
    ),
    buildPath(2, [v3(-60, -30, 80), v3(20, 10, -40)], '#8ab4cc', 0.4, 0.15, false, true),
  ]
  const signals: Signal[] = [
    {
      id: 0,
      pathId: 1, // по какому пути бежит (path.id)
      segIndex: 0, // на каком отрезке сейчас находится
      progress: 0, // позиция на отрезке: 0.0 = начало, 1.0 = конец
      direction: 1, // 1 = вперёд, -1 = назад
      speed: 80, // юнитов в секунду
      colorFwd: '#00e5ff', // цвет при движении вперёд
      colorBwd: '#ed7547', // цвет при движении назад
      tailLength: 0.15, // длина хвоста: доля от длины отрезка (0.0–1.0)
      pauseDuration: 0.3, // секунд паузы после отскока от конца
      pauseTime: 0, // внутренний таймер паузы, всегда 0 при создании
      state: 'moving', // 'moving' | 'paused' | 'impact'
    },
  ]

  const newPath = {
    paths: paths,
    signals: signals,
  }
  cleanup = main(canvasRef.value!, newPath)
})

onUnmounted(() => {
  cleanup()
})
</script>

<style scope>
canvas {
  display: block;
  cursor: grab;
}
canvas:active {
  cursor: grabbing;
}
</style>
