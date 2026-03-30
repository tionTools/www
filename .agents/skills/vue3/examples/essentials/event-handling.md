## Instructions

- Use @ for event binding.
- Use event modifiers to prevent or stop events.
- Keep handlers concise and focused.

### Example

```vue
<script setup>
import { ref } from 'vue'

const count = ref(0)

// Handle click events
function increment() {
  count.value += 1
}
</script>

<template>
  <button @click="increment">{{ count }}</button>
</template>
```

Reference: https://vuejs.org/guide/essentials/event-handling.html
