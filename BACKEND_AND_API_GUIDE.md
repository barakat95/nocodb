# NocoDB Backend Architecture & API Integration Guide

## Table of Contents

1. [Backend Architecture Overview](#backend-architecture-overview)
2. [How Backend Code is Structured](#how-backend-code-is-structured)
3. [API Integration Methods](#api-integration-methods)
4. [Authentication](#authentication)
5. [API Versions & Endpoints](#api-versions--endpoints)
6. [Examples](#examples)

---

## Backend Architecture Overview

NocoDB uses **NestJS** (a Node.js framework) as its backend framework. The backend is located in `packages/nocodb/`.

### Key Components:

1. **Entry Point**: `packages/nocodb/src/main.ts`

   - Express server initialization
   - Starts on port 8080 (or `process.env.PORT`)
   - Initializes NocoDB application

2. **Module System**: NestJS modules organize the application

   - `AppModule` (`src/app.module.ts`) - Root module
   - `NocoModule` (`src/modules/noco.module.ts`) - Main NocoDB module
   - `AuthModule` - Authentication module

3. **Architecture Pattern**: MVC-like with NestJS decorators
   - **Controllers** - Handle HTTP requests
   - **Services** - Business logic
   - **Guards** - Authentication & authorization
   - **Middleware** - Request processing

---

## How Backend Code is Structured

### 1. Controllers (`src/controllers/`)

Controllers define API endpoints using NestJS decorators:

```typescript
@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get(['/api/v1/db/meta/projects/:baseId/tables', '/api/v2/meta/bases/:baseId/tables'])
  @Acl('tableList')
  async tableList(@Param('baseId') baseId: string, @Request() req) {
    return new PagedResponseImpl(
      await this.tablesService.getAccessibleTables(context, { baseId, ... })
    );
  }
}
```

**Key Decorators:**

- `@Controller()` - Marks class as controller
- `@Get()`, `@Post()`, `@Put()`, `@Delete()`, `@Patch()` - HTTP methods
- `@UseGuards()` - Authentication/authorization guards
- `@Acl()` - Access control level permissions
- `@Param()`, `@Body()`, `@Query()` - Extract request data

### 2. Services (`src/services/`)

Services contain business logic:

```typescript
@Injectable()
export class TablesService {
  constructor(
    protected readonly metaDiffService: MetaDiffsService,
    protected readonly columnsService: ColumnsService,
  ) {}

  async tableCreate(context: NcContext, param: {
    baseId: string;
    table: TableReqType;
    user: UserType;
  }) {
    // Business logic here
    const model = await Model.create(context, { ... });
    return model;
  }
}
```

**Key Features:**

- `@Injectable()` - Dependency injection
- Services are injected into controllers via constructor
- Handle database operations, validation, business rules

### 3. Guards (`src/guards/`)

Guards handle authentication and authorization:

- `GlobalGuard` - Validates JWT tokens and API tokens
- `MetaApiLimiterGuard` - Rate limiting for meta APIs

### 4. Middleware (`src/middlewares/`)

Middleware processes requests before they reach controllers:

- `GlobalMiddleware` - General request processing
- `ExtractIdsMiddleware` - Extracts IDs from request for ACL
- `JsonBodyMiddleware` - Parses JSON bodies

### 5. Models (`src/models/`)

Database models using TypeORM-like patterns:

```typescript
export class Model extends BaseModel {
  static async get(context: NcContext, id: string) {
    // Database query logic
  }
}
```

---

## API Integration Methods

### Method 1: Using NocoDB SDK (Recommended)

The SDK provides a type-safe, easy-to-use interface:

#### Installation

```bash
npm install nocodb-sdk
# or
pnpm add nocodb-sdk
```

#### Basic Usage

```typescript
import { Api } from "nocodb-sdk";

// Initialize SDK with authentication token
const api = new Api({
  baseURL: "http://localhost:8080",
  headers: {
    "xc-auth": "your-jwt-token-here",
  },
});

// Or with API token
const api = new Api({
  baseURL: "http://localhost:8080",
  headers: {
    "xc-token": "your-api-token-here",
  },
});

// Example: List tables
const tables = await api.dbTable.list("baseId");

// Example: Create a record
const record = await api.dbTableRow.create("baseId", "tableName", {
  Name: "John Doe",
  Email: "john@example.com",
});

// Example: List records
const records = await api.dbTableRow.list("baseId", "tableName", {
  limit: 10,
  offset: 0,
});
```

#### SDK Features

- Type-safe API calls
- Automatic token refresh handling
- Built-in error handling
- Support for all NocoDB operations (CRUD, meta operations, etc.)

### Method 2: Direct HTTP Requests

You can make direct HTTP requests using `axios`, `fetch`, or any HTTP client:

#### Authentication Headers

```typescript
// JWT Token (from user login)
headers: {
  'xc-auth': 'jwt-token-here'
}

// API Token (from base settings)
headers: {
  'xc-token': 'api-token-here'
}

// For shared bases
headers: {
  'xc-shared-base-id': 'shared-base-id'
}
```

#### Example with Axios

```typescript
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080",
  headers: {
    "xc-auth": "your-token-here",
  },
});

// List tables
const response = await api.get("/api/v1/db/meta/projects/:baseId/tables");

// Create record
const response = await api.post("/api/v1/db/data/noco/:baseId/:tableName", {
  Name: "John Doe",
  Email: "john@example.com",
});

// Update record
const response = await api.patch(
  "/api/v1/db/data/noco/:baseId/:tableName/:rowId",
  {
    Name: "Jane Doe",
  }
);

// Delete record
const response = await api.delete(
  "/api/v1/db/data/noco/:baseId/:tableName/:rowId"
);
```

#### Example with Fetch

```typescript
const response = await fetch(
  "http://localhost:8080/api/v1/db/meta/projects/:baseId/tables",
  {
    method: "GET",
    headers: {
      "xc-auth": "your-token-here",
      "Content-Type": "application/json",
    },
  }
);

const data = await response.json();
```

---

## Authentication

### 1. User Authentication (JWT Token)

#### Login

```typescript
// Using SDK
const response = await api.auth.signIn({
  email: "user@example.com",
  password: "password",
});
const token = response.token;

// Using HTTP
const response = await axios.post(
  "http://localhost:8080/api/v1/auth/user/signin",
  {
    email: "user@example.com",
    password: "password",
  }
);
const token = response.data.token;
```

#### Using JWT Token

```typescript
// Add to headers
headers: {
  'xc-auth': token
}
```

### 2. API Token Authentication

API tokens are scoped to a specific base and provide programmatic access.

#### Create API Token

```typescript
// Using SDK
const { token } = await api.apiTokens.create({
  description: "My API Token",
});

// Using HTTP
const response = await axios.post(
  "/api/v1/db/meta/projects/:baseId/api-tokens",
  { description: "My API Token" },
  { headers: { "xc-auth": jwtToken } }
);
```

#### Use API Token

```typescript
headers: {
  'xc-token': apiToken
}
```

### 3. Shared Base Access

For public/shared bases:

```typescript
headers: {
  'xc-shared-base-id': 'shared-base-id'
  // Note: No auth token needed for public shared bases
}
```

---

## API Versions & Endpoints

NocoDB supports multiple API versions:

### API v1 (Legacy)

- Base path: `/api/v1/`
- Example: `/api/v1/db/meta/projects/:baseId/tables`

### API v2 (Current)

- Base path: `/api/v2/`
- Example: `/api/v2/meta/bases/:baseId/tables`

### API v3 (Latest)

- Base path: `/api/v3/`
- Example: `/api/v3/meta/workspaces/:workspaceId/bases`

### Main API Categories

#### 1. Meta APIs (Schema Management)

- **Bases**: `/api/v2/meta/bases`
- **Tables**: `/api/v2/meta/bases/:baseId/tables`
- **Columns**: `/api/v2/meta/tables/:tableId/columns`
- **Views**: `/api/v2/meta/tables/:tableId/views`
- **Filters**: `/api/v2/meta/views/:viewId/filters`
- **Sorts**: `/api/v2/meta/views/:viewId/sorts`

#### 2. Data APIs (CRUD Operations)

- **List Records**: `GET /api/v1/db/data/noco/:baseId/:tableName`
- **Create Record**: `POST /api/v1/db/data/noco/:baseId/:tableName`
- **Read Record**: `GET /api/v1/db/data/noco/:baseId/:tableName/:rowId`
- **Update Record**: `PATCH /api/v1/db/data/noco/:baseId/:tableName/:rowId`
- **Delete Record**: `DELETE /api/v1/db/data/noco/:baseId/:tableName/:rowId`

#### 3. Auth APIs

- **Sign In**: `POST /api/v1/auth/user/signin`
- **Sign Up**: `POST /api/v1/auth/user/signup`
- **Token Refresh**: `POST /api/v1/auth/token/refresh`

#### 4. API Token Management

- **List Tokens**: `GET /api/v2/meta/bases/:baseId/api-tokens`
- **Create Token**: `POST /api/v2/meta/bases/:baseId/api-tokens`
- **Delete Token**: `DELETE /api/v2/meta/bases/:baseId/api-tokens/:tokenId`

### API Documentation

Swagger/OpenAPI documentation is available:

- Swagger JSON: `packages/nocodb/src/schema/swagger.json`
- Swagger v2 JSON: `packages/nocodb/src/schema/swagger-v2.json`
- Swagger v3 JSON: `packages/nocodb/src/schema/swagger-v3.json`

Access API docs at: `http://localhost:8080/api-docs` (if enabled)

---

## Examples

### Complete Integration Example (SDK)

```typescript
import { Api } from "nocodb-sdk";

async function example() {
  // 1. Initialize SDK
  const api = new Api({
    baseURL: "http://localhost:8080",
  });

  // 2. Authenticate
  const authResponse = await api.auth.signIn({
    email: "user@example.com",
    password: "password",
  });

  // 3. Update API instance with token
  api.instance.defaults.headers["xc-auth"] = authResponse.token;

  // 4. Get bases
  const bases = await api.base.list();

  // 5. Get tables in a base
  const tables = await api.dbTable.list(bases.list[0].id);

  // 6. Create a record
  const newRecord = await api.dbTableRow.create(
    bases.list[0].id,
    tables.list[0].table_name,
    {
      Name: "John Doe",
      Email: "john@example.com",
      Age: 30,
    }
  );

  // 7. List records with filters
  const records = await api.dbTableRow.list(
    bases.list[0].id,
    tables.list[0].table_name,
    {
      where: "(Name,eq,John Doe)",
      limit: 10,
      offset: 0,
    }
  );

  // 8. Update a record
  await api.dbTableRow.update(
    bases.list[0].id,
    tables.list[0].table_name,
    newRecord.Id,
    {
      Age: 31,
    }
  );

  // 9. Delete a record
  await api.dbTableRow.delete(
    bases.list[0].id,
    tables.list[0].table_name,
    newRecord.Id
  );
}
```

### Complete Integration Example (HTTP)

```typescript
import axios from "axios";

async function example() {
  const baseURL = "http://localhost:8080";

  // 1. Login
  const loginResponse = await axios.post(`${baseURL}/api/v1/auth/user/signin`, {
    email: "user@example.com",
    password: "password",
  });
  const token = loginResponse.data.token;

  // 2. Create axios instance with auth
  const api = axios.create({
    baseURL,
    headers: {
      "xc-auth": token,
      "Content-Type": "application/json",
    },
  });

  // 3. Get bases
  const basesResponse = await api.get("/api/v1/db/meta/projects");
  const baseId = basesResponse.data.list[0].id;

  // 4. Get tables
  const tablesResponse = await api.get(
    `/api/v1/db/meta/projects/${baseId}/tables`
  );
  const tableName = tablesResponse.data.list[0].table_name;

  // 5. Create record
  const createResponse = await api.post(
    `/api/v1/db/data/noco/${baseId}/${tableName}`,
    {
      Name: "John Doe",
      Email: "john@example.com",
    }
  );

  // 6. List records
  const listResponse = await api.get(
    `/api/v1/db/data/noco/${baseId}/${tableName}`,
    {
      params: {
        limit: 10,
        offset: 0,
      },
    }
  );

  // 7. Update record
  const recordId = createResponse.data.Id;
  await api.patch(`/api/v1/db/data/noco/${baseId}/${tableName}/${recordId}`, {
    Name: "Jane Doe",
  });

  // 8. Delete record
  await api.delete(`/api/v1/db/data/noco/${baseId}/${tableName}/${recordId}`);
}
```

### Error Handling

```typescript
try {
  const response = await api.dbTableRow.create(baseId, tableName, data);
} catch (error) {
  if (error.response) {
    // API responded with error
    console.error("Status:", error.response.status);
    console.error("Message:", error.response.data.msg);
  } else if (error.request) {
    // Request made but no response
    console.error("No response received");
  } else {
    // Error setting up request
    console.error("Error:", error.message);
  }
}
```

---

## Development Tips

1. **Start Backend**: `pnpm --filter=nocodb run start` or `pnpm start:backend`
2. **API Base URL**: Default is `http://localhost:8080`
3. **CORS**: Enabled by default for development
4. **Rate Limiting**: Meta APIs have rate limiting via `MetaApiLimiterGuard`
5. **Logging**: Check console for request/response logs
6. **Testing**: See `tests/playwright/` for integration test examples

---

## Additional Resources

- **SDK Documentation**: `packages/nocodb-sdk/README.md`
- **API Schema**: `packages/nocodb/src/schema/`
- **Controller Examples**: `packages/nocodb/src/controllers/`
- **Service Examples**: `packages/nocodb/src/services/`
- **Test Examples**: `tests/playwright/`

---

## Summary

- **Backend Framework**: NestJS with Express
- **Architecture**: Controllers → Services → Models
- **Integration**: Use SDK (recommended) or direct HTTP requests
- **Authentication**: JWT tokens (user) or API tokens (programmatic)
- **API Versions**: v1 (legacy), v2 (current), v3 (latest)
- **Base URL**: `http://localhost:8080` (default)

For more details, check the Swagger documentation files or explore the controller/service implementations in the codebase.

---

## Related Documentation

- **Frontend Guide**: See `FRONTEND_AND_FEATURE_EDITING_GUIDE.md` for frontend architecture and how the frontend integrates with these APIs
