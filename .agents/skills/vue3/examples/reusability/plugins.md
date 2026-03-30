## Instructions

- Expose install(app) on plugins.
- Register global components or provide values.
- Keep plugin APIs stable.

### Example

```ts
import type { App } from 'vue'

export default {
  install(app: App) {
    app.provide('apiBase', '/api')
  }
}
```

Reference: https://vuejs.org/guide/reusability/plugins.html
