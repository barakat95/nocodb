# NocoDB Frontend Architecture & Feature Editing Guide

## Table of Contents
1. [Frontend Architecture Overview](#frontend-architecture-overview)
2. [How Frontend Code is Structured](#how-frontend-code-is-structured)
3. [API Integration in Frontend](#api-integration-in-frontend)
4. [How to Edit Specific Features](#how-to-edit-specific-features)
5. [Development Workflow](#development-workflow)
6. [Examples](#examples)

---

## Frontend Architecture Overview

NocoDB frontend is built with **Nuxt 3** (Vue 3 framework) and is located in `packages/nc-gui/`.

### Key Technologies:

- **Framework**: Nuxt 3 (Vue 3)
- **State Management**: Pinia
- **UI Framework**: Ant Design Vue
- **Styling**: WindiCSS (Tailwind-like)
- **API Client**: NocoDB SDK (nocodb-sdk)
- **TypeScript**: Full TypeScript support
- **Routing**: Nuxt file-based routing

### Architecture Pattern:

```
Frontend Structure:
├── pages/          # File-based routing (Nuxt)
├── components/     # Vue components
├── composables/    # Reusable composition functions
├── store/          # Pinia stores (state management)
├── plugins/        # Nuxt plugins (initialization)
├── layouts/        # Layout components
├── utils/          # Utility functions
└── assets/         # Static assets (images, styles)
```

---

## How Frontend Code is Structured

### 1. Pages (`pages/`)

Nuxt uses file-based routing. Files in `pages/` automatically become routes:

```
pages/
├── index.vue                    → /
├── signin.vue                   → /signin
├── index/
│   └── [typeOrId]/
│       └── [baseId]/
│           └── index.vue       → /index/:typeOrId/:baseId
```

**Example Page:**
```vue
<script setup lang="ts">
// Pages are Vue components
const route = useRoute()
const { api } = useApi()

// Fetch data on page load
const bases = await api.base.list()
</script>

<template>
  <div>
    <h1>Dashboard</h1>
    <!-- Page content -->
  </div>
</template>
```

### 2. Components (`components/`)

Vue components organized by feature:

```
components/
├── smartsheet/      # Main spreadsheet view components
├── dashboard/       # Dashboard components
├── cell/            # Cell renderers for different data types
├── dlg/             # Dialog/modal components
├── general/         # General reusable components
└── ...
```

**Component Structure:**
```vue
<script setup lang="ts">
// Component props
const props = defineProps<{
  modelValue: boolean
  tableId: string
}>()

// Component emits
const emits = defineEmits(['update:modelValue'])

// Composables for API access
const { api, isLoading, error } = useApi()
const { token } = useGlobal()

// Reactive state
const data = ref(null)

// Methods
async function loadData() {
  try {
    data.value = await api.dbTable.read(props.tableId)
  } catch (e) {
    console.error(e)
  }
}

// Lifecycle
onMounted(() => {
  loadData()
})
</script>

<template>
  <div>
    <div v-if="isLoading">Loading...</div>
    <div v-else>{{ data }}</div>
  </div>
</template>
```

### 3. Composables (`composables/`)

Reusable composition functions (Vue 3 Composition API):

**Key Composables:**

- `useApi()` - API client with loading/error states
- `useGlobal()` - Global state (user, token, app info)
- `useMetas()` - Table metadata management
- `useViewData()` - View data operations
- `useSmartsheetStore()` - Spreadsheet state

**Example Composable:**
```typescript
// composables/useMyFeature.ts
export function useMyFeature() {
  const { api } = useApi()
  const data = ref(null)
  const isLoading = ref(false)

  async function fetchData(id: string) {
    isLoading.value = true
    try {
      data.value = await api.dbTable.read(id)
    } finally {
      isLoading.value = false
    }
  }

  return {
    data,
    isLoading,
    fetchData
  }
}
```

### 4. Stores (`store/`)

Pinia stores for global state management:

```typescript
// store/bases.ts
export const useBases = defineStore('basesStore', () => {
  const { $api } = useNuxtApp()
  
  const bases = ref<Map<string, NcProject>>(new Map())
  
  async function loadBases() {
    const response = await $api.base.list()
    // Update state
  }
  
  return {
    bases,
    loadBases
  }
})
```

**Using Stores:**
```vue
<script setup>
const baseStore = useBases()
const { bases } = storeToRefs(baseStore)

// Call store actions
await baseStore.loadBases()
</script>
```

### 5. Plugins (`plugins/`)

Nuxt plugins run on app initialization:

```typescript
// plugins/api.ts
export default defineNuxtPlugin((nuxtApp) => {
  const { api } = useApi()
  nuxtApp.provide('api', api)
})

// Usage: $api is available globally
```

### 6. Layouts (`layouts/`)

Layout components wrap pages:

```vue
<!-- layouts/base.vue -->
<template>
  <div class="layout">
    <Sidebar />
    <main>
      <slot /> <!-- Page content goes here -->
    </main>
  </div>
</template>
```

---

## API Integration in Frontend

### Method 1: Using `useApi()` Composable (Recommended)

The `useApi()` composable provides:
- API client instance
- Loading state
- Error handling
- Automatic token injection

```vue
<script setup lang="ts">
// Get API instance with loading/error states
const { api, isLoading, error } = useApi()

// Fetch data
const tables = ref([])

async function loadTables() {
  try {
    const response = await api.dbTable.list(baseId)
    tables.value = response.list
  } catch (e) {
    console.error('Error loading tables:', e)
  }
}

onMounted(() => {
  loadTables()
})
</script>

<template>
  <div>
    <div v-if="isLoading">Loading...</div>
    <div v-else-if="error">{{ error }}</div>
    <div v-else>
      <div v-for="table in tables" :key="table.id">
        {{ table.title }}
      </div>
    </div>
  </div>
</template>
```

### Method 2: Using Global `$api` Instance

The global API instance is available via `useNuxtApp()`:

```vue
<script setup>
const { $api } = useNuxtApp()

// Use directly
const tables = await $api.dbTable.list(baseId)
</script>
```

### Method 3: Direct HTTP with `$fetch` (Nuxt)

For custom endpoints or when SDK doesn't cover:

```typescript
const { token } = useGlobal()
const config = useRuntimeConfig()

const response = await $fetch('/api/v1/custom-endpoint', {
  baseURL: config.public.ncBackendUrl,
  method: 'POST',
  headers: {
    'xc-auth': token.value
  },
  body: {
    // request data
  }
})
```

### API Client Features

**Automatic Token Injection:**
- JWT tokens are automatically added via interceptors
- Token refresh is handled automatically
- Shared base tokens are handled separately

**Request Interceptors:**
```typescript
// Automatically adds:
// - xc-auth header (JWT token)
// - xc-gui header (identifies GUI requests)
// - xc-socket-id (for real-time updates)
```

**Response Interceptors:**
- Handles token refresh on 401 errors
- Extracts error messages
- Updates global loading state

---

## How to Edit Specific Features

### Step 1: Locate the Feature

**Finding Components:**
1. Check `components/` directory for feature-related components
2. Use file search: `Ctrl+P` in VS Code to search for component names
3. Check `pages/` for page-level features

**Common Feature Locations:**

| Feature | Location |
|---------|----------|
| Spreadsheet/Grid View | `components/smartsheet/` |
| Dashboard | `components/dashboard/` |
| Tables Management | `components/dashboard/TreeView/` |
| Forms | `components/smartsheet/forms/` |
| Kanban View | `components/smartsheet/kanban/` |
| Gallery View | `components/smartsheet/gallery/` |
| Cell Types | `components/cell/` |
| Dialogs/Modals | `components/dlg/` |
| Settings | `components/dashboard/settings/` |

### Step 2: Understand the Data Flow

**Typical Flow:**
```
User Action → Component → Composable/Store → API Call → Backend
                ↓
            Update UI State
```

**Example: Editing Table Creation**

1. **Find the component**: `components/dashboard/TreeView/Project/CreateNewMenu.vue`
2. **Find the API call**: Look for `api.dbTable.create()` or similar
3. **Find the store**: Check `store/` for related state management
4. **Trace the flow**: Component → Store → API → Backend

### Step 3: Make Your Changes

**Example: Adding a New Field to Table Creation**

```vue
<!-- components/dashboard/TreeView/Project/CreateNewMenu.vue -->
<script setup lang="ts">
const formData = ref({
  title: '',
  description: '', // ← Add new field
  // ... other fields
})

async function createTable() {
  await api.dbTable.create(baseId, {
    ...formData.value,
    // New field will be included
  })
}
</script>

<template>
  <a-form>
    <a-form-item label="Title">
      <a-input v-model="formData.title" />
    </a-form-item>
    
    <!-- Add new field -->
    <a-form-item label="Description">
      <a-input v-model="formData.description" />
    </a-form-item>
  </a-form>
</template>
```

### Step 4: Update Related Files

**If you modify:**
- **API calls**: Check if backend needs updates
- **Data structures**: Update TypeScript types
- **State management**: Update stores/composables
- **UI components**: Update related components

### Common Editing Scenarios

#### Scenario 1: Modify a Cell Renderer

**Location**: `components/cell/`

```vue
<!-- components/cell/Text.vue -->
<script setup lang="ts">
// Modify how text cells are rendered
const props = defineProps<{
  modelValue: any
  column: ColumnType
}>()

// Add custom logic
const displayValue = computed(() => {
  // Your custom formatting
  return props.modelValue?.toUpperCase()
})
</script>

<template>
  <div>{{ displayValue }}</div>
</template>
```

#### Scenario 2: Add a New View Type

1. Create component: `components/smartsheet/MyView/index.vue`
2. Register in view type enum
3. Add route handling in pages
4. Add view creation option

#### Scenario 3: Modify API Integration

**Update composable:**
```typescript
// composables/useMyFeature.ts
export function useMyFeature() {
  const { api } = useApi()
  
  async function customOperation(id: string, data: any) {
    // Use SDK
    return await api.dbTable.update(id, data)
    
    // Or use direct HTTP
    return await $fetch(`/api/v1/custom/${id}`, {
      method: 'POST',
      body: data
    })
  }
  
  return { customOperation }
}
```

#### Scenario 4: Add a New Dialog/Modal

```vue
<!-- components/dlg/MyDialog.vue -->
<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
}>()

const emits = defineEmits(['update:modelValue'])

const visible = computed({
  get: () => props.modelValue,
  set: (v) => emits('update:modelValue', v)
})

const { api } = useApi()

async function save() {
  await api.someEndpoint.create(data)
  visible.value = false
}
</script>

<template>
  <a-modal v-model:open="visible" title="My Dialog">
    <!-- Dialog content -->
  </a-modal>
</template>
```

---

## Development Workflow

### 1. Start Development Server

```bash
# From root directory
pnpm start:frontend

# Or from packages/nc-gui
cd packages/nc-gui
pnpm dev
```

Frontend runs on: `http://localhost:3000` (default)

### 2. Hot Module Replacement (HMR)

- Changes to Vue components auto-reload
- Changes to TypeScript files auto-reload
- No need to restart server

### 3. Debugging

**Browser DevTools:**
- Vue DevTools extension (recommended)
- Network tab for API calls
- Console for errors

**VS Code Debugging:**
```json
// .vscode/launch.json
{
  "type": "chrome",
  "request": "launch",
  "name": "Debug Frontend",
  "url": "http://localhost:3000",
  "webRoot": "${workspaceFolder}/packages/nc-gui"
}
```

### 4. Testing Changes

1. **Component Testing**: Check component in isolation
2. **Integration Testing**: Test with real API
3. **E2E Testing**: Use Playwright tests in `tests/playwright/`

### 5. Building for Production

```bash
cd packages/nc-gui
pnpm build
```

Output: `packages/nc-gui/.output/`

---

## Examples

### Example 1: Creating a New Component with API Integration

```vue
<!-- components/MyFeature/TableList.vue -->
<script setup lang="ts">
const { api, isLoading, error } = useApi()
const { base } = storeToRefs(useBase())

const tables = ref([])

async function loadTables() {
  try {
    const response = await api.dbTable.list(base.value.id)
    tables.value = response.list
  } catch (e) {
    message.error('Failed to load tables')
  }
}

onMounted(() => {
  loadTables()
})

async function createTable(title: string) {
  try {
    await api.dbTable.create(base.value.id, { title })
    await loadTables() // Refresh list
    message.success('Table created!')
  } catch (e) {
    message.error('Failed to create table')
  }
}
</script>

<template>
  <div>
    <a-button @click="createTable('New Table')">Create Table</a-button>
    
    <a-spin :spinning="isLoading">
      <a-list :data-source="tables">
        <template #renderItem="{ item }">
          <a-list-item>{{ item.title }}</a-list-item>
        </template>
      </a-list>
    </a-spin>
  </div>
</template>
```

### Example 2: Using Composables for Data Management

```typescript
// composables/useTableOperations.ts
export function useTableOperations() {
  const { api } = useApi()
  const { base } = storeToRefs(useBase())
  
  const tables = ref([])
  const isLoading = ref(false)
  
  async function loadTables() {
    isLoading.value = true
    try {
      const response = await api.dbTable.list(base.value.id)
      tables.value = response.list
    } finally {
      isLoading.value = false
    }
  }
  
  async function createTable(data: any) {
    await api.dbTable.create(base.value.id, data)
    await loadTables()
  }
  
  async function deleteTable(tableId: string) {
    await api.dbTable.delete(tableId)
    await loadTables()
  }
  
  return {
    tables,
    isLoading,
    loadTables,
    createTable,
    deleteTable
  }
}
```

**Using the Composable:**
```vue
<script setup>
const { tables, isLoading, createTable, deleteTable } = useTableOperations()

onMounted(() => {
  loadTables()
})
</script>
```

### Example 3: Modifying Existing Feature (Table Settings)

**Find the component:**
```bash
# Search for table settings
grep -r "table.*settings" components/
```

**Edit the component:**
```vue
<!-- components/dashboard/settings/base/index.vue -->
<script setup lang="ts">
// Add new setting
const newSetting = ref(false)

async function saveSettings() {
  await api.base.update(baseId, {
    // existing settings
    newSetting: newSetting.value // ← Add new setting
  })
}
</script>

<template>
  <a-form>
    <!-- Existing settings -->
    
    <!-- Add new setting -->
    <a-form-item label="New Setting">
      <a-switch v-model:checked="newSetting" />
    </a-form-item>
  </a-form>
</template>
```

### Example 4: Real-time Updates with Socket.IO

```vue
<script setup lang="ts">
const { $ncSocket } = useNuxtApp()
const meta = inject(MetaInj, ref())

// Listen for table updates
$ncSocket.on('table', (data) => {
  if (data.id === meta.value?.id) {
    // Update UI when table changes
    refreshTable()
  }
})

function refreshTable() {
  // Reload table data
}
</script>
```

### Example 5: Custom API Endpoint Integration

```typescript
// composables/useCustomApi.ts
export function useCustomApi() {
  const { token } = useGlobal()
  const config = useRuntimeConfig()
  
  async function customRequest(data: any) {
    return await $fetch('/api/v1/custom-endpoint', {
      baseURL: config.public.ncBackendUrl,
      method: 'POST',
      headers: {
        'xc-auth': token.value,
        'Content-Type': 'application/json'
      },
      body: data
    })
  }
  
  return { customRequest }
}
```

---

## Key Files Reference

### Important Directories:

- **`composables/useApi/`** - API client setup
- **`composables/useGlobal/`** - Global state management
- **`store/`** - Pinia stores
- **`components/smartsheet/`** - Main spreadsheet components
- **`components/cell/`** - Cell type renderers
- **`plugins/`** - App initialization

### Important Files:

- **`nuxt.config.ts`** - Nuxt configuration
- **`app.vue`** - Root component
- **`composables/useApi/index.ts`** - API composable
- **`composables/useApi/interceptors.ts`** - Request/response interceptors
- **`store/bases.ts`** - Base/project store
- **`composables/useMetas.ts`** - Table metadata management

---

## Tips & Best Practices

1. **Use Composables**: Extract reusable logic into composables
2. **Type Safety**: Use TypeScript types from `nocodb-sdk`
3. **Error Handling**: Always wrap API calls in try-catch
4. **Loading States**: Use `isLoading` from `useApi()` for better UX
5. **Reactive State**: Use `ref()` and `reactive()` for component state
6. **Store for Global State**: Use Pinia stores for shared state
7. **Component Organization**: Keep components focused and small
8. **API Caching**: Use composables like `useMetas()` that cache data

---

## Troubleshooting

### Issue: API calls not working
- Check if token is set: `const { token } = useGlobal()`
- Verify backend is running
- Check network tab in browser DevTools

### Issue: Component not updating
- Check if using `ref()` for reactive state
- Verify API response is being assigned correctly
- Check Vue DevTools for component state

### Issue: Type errors
- Run `pnpm install` to ensure types are installed
- Check `nocodb-sdk` types are imported correctly
- Verify TypeScript version compatibility

---

## Summary

- **Framework**: Nuxt 3 (Vue 3) with TypeScript
- **State**: Pinia stores + Composables
- **API**: NocoDB SDK via `useApi()` composable
- **Structure**: Pages → Components → Composables → API
- **Development**: HMR enabled, runs on port 3000
- **Editing**: Find component → Understand flow → Make changes → Test

For more details, explore the codebase and check the examples in `components/` and `composables/` directories.

---

## Related Documentation

- **Backend Guide**: See `BACKEND_AND_API_GUIDE.md` for backend architecture, API endpoints, and how the backend APIs work

