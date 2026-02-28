# Page snapshot

```yaml
- generic [ref=e2]:
  - text: "error: duplicate key value violates unique constraint \"workpacks_work_order_number_unique\""
  - text: at C:\GMO\Projects\jupiter\node_modules\pg-pool\index.js:45:11
  - text: at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
  - text: at async WorkpackService.create (C:\GMO\Projects\jupiter\src\modules\workpacks\workpack.service.ts:8:22)
  - text: at async handleCreate (C:\GMO\Projects\jupiter\src\modules\workpacks\workpack.controller.ts:135:5)
```