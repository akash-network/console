# Code Generation in the Notifications App

## Overview

The Notifications application uses several code generation approaches to reduce boilerplate, ensure type safety, and maintain consistency across the codebase. This document outlines how to use these code generation tools.

## Swagger API Documentation Generation

### Usage

To generate Swagger documentation:

```bash
# Generate Swagger docs
npm run sdk:gen:swagger
```

This will:

1. Create the Swagger JSON file in the `/swagger` directory
2. The file can be used with Swagger UI or other OpenAPI tools

To view the API documentation during development:

1. Start the application normally
2. Navigate to `/api` in your browser

## OpenAPI SDK Generation

The generated SDKs are stored in common packages for reuse across the project:

- HTTP SDK: `packages/http-sdk/src/generated/NotificationSDK.ts`
- React Query SDK: `packages/react-query-sdk/src/notifications/`

### Client Usage

Generate TypeScript SDK clients from the API:

```bash
# Generate HTTP client SDK
npm run sdk:gen:http

# Generate React Query client SDK
npm run sdk:gen:react-query
```

### Using Generated React Query Hooks

First, create the API client in your application:

```typescript
// Import the SDK creator and dependencies
import { createAPIClient } from "@akashnetwork/react-query-sdk/notifications";
import { requestFn } from "@openapi-qraft/react";
import { QueryClient } from "@tanstack/react-query";

// Create a query client (or import your existing one)
const queryClient = new QueryClient();

// Initialize the API client
const api = createAPIClient({
  requestFn,
  queryClient,
  baseUrl: "http://localhost:3001" // Your API URL
});
```

Then use the API client in your components:

```typescript
// Example of querying and mutating data
function MyComponent() {
  // Use mutation hook
  const mutation = api.contactPoints.createContactPoint.useMutation();

  // Use query hook with dependencies
  api.contactPoints.getContactPoint.useQuery(
    {
      path: {
        id: mutation.data?.data?.id || ""
      }
    },
    {
      enabled: !!mutation.data?.data?.id // Only run when we have an ID
    }
  );

  // Trigger mutation
  const createContactPoint = () => {
    mutation.mutate({
      body: {
        data: {
          userId: "user-id",
          type: "email",
          config: {
            addresses: ["user@example.com"]
          }
        }
      }
    });
  };

  return (
    <button onClick={createContactPoint}>
      Create Contact Point
    </button>
  );
}
```
