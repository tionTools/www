<template>
  <canvas ref="canvasRef" id="canvas"></canvas>
</template>

<script setup lang="ts">
import { main } from '@/lib/scene'
import { useTemplateRef, onMounted, onUnmounted } from 'vue'

const canvasRef = useTemplateRef<HTMLCanvasElement>('canvasRef')

let cleanup: () => void

onMounted(() => {
  cleanup = main(canvasRef.value!)
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
