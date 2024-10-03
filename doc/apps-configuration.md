# Environment Variables & Configuration

## Overview

Both the **Next.js frontend** and **Node.js backend** applications use environment variables to manage configuration. This guide provides a unified approach to managing these variables, along with **Zod**-based validation for ensuring correctness across both apps.

### Environment Files

We use `.env*` files for managing environment variables, with a consistent loading order across both applications. These files help separate environment-specific configurations from sensitive information.

### Next.js Environment Variables Behavior

In addition to the logic described below environment variables in the **Next.js app** follow the standard Next.js behavior, as documented in the [Next.js environment variables documentation](https://nextjs.org/docs/basic-features/environment-variables). This means that files like `.env.local` or `.env.production` will be automatically loaded based on the environment in which the app is running, ensuring smooth transitions between development, staging, and production environments.

### Loading Order

The environment variables are loaded in the following order for both **Next.js** and **Node.js** applications:

1. **System Environment Variables**: Variables set in the system environment (e.g., through CI/CD pipelines) take the highest precedence and are never overridden by values from `.env` files.
2. **`env/.env.local`**: Contains sensitive values specific to local development. This file is not tracked by Git and should contain secrets for local use.
3. **`env/.env`**: Contains default values applicable to all environments. This file is included in version control and should not contain sensitive data.
4. **`env/.env.${DEPLOYMENT_ENV}`**: Contains values specific to the deployment environment (e.g., production, staging). This file is loaded based on the `DEPLOYMENT_ENV` variable.
5. **`env/.env.${NETWORK}`**: Contains values specific to the network environment (e.g., mainnet, testnet). This file is loaded based on the `NETWORK` variable.

### Variable Precedence

- Variables loaded from higher-priority sources (like system environment variables or `.env.local`) will override those defined in lower-priority files (such as `.env` or `.env.production`).

### Configuration Structure

All application configurations should be organized and stored in specific files within the app directories:

- **Configuration Files**:
  - Configurations must be placed in `apps/*/config/<module>.config.ts` files for each module-specific configuration.
  - Environment variables should retain their original **SCREAMING_CASE** names and be parsed/validated directly using **Zod** schemas, without renaming.

- **Split by Domain**:
  - Configurations should be **split by application domain**. This helps maintain clarity and separation of concerns, with configurations logically grouped based on the features or domains they pertain to (e.g., database, authentication, API endpoints).

### Environment Variables

- **Separation of Environment Variables**:
  - Environment variables must be separated from hardcoded configuration values to keep sensitive or environment-specific data outside of the codebase.
  - Use `.env*` files as described in the **Loading Order** section, and ensure all environment variables are **validated** using schemas before they are used within the application.

### Zod-Based Validation

Both the **Next.js** and **Node.js** apps use **Zod** schemas to validate environment variables, ensuring that all required variables are present and have valid values. Validation is applied at two stages:

- **Build-Time Validation** (Next.js only): In the **Next.js** app, variables are validated at build time using **Zod** schemas defined in the `src/config/env-config.schema.ts` file. If any required variables are missing or invalid, the build will fail.
  
- **Runtime Validation** (All Apps): Both **Next.js** and **Node.js** applications perform **runtime validation** when the server starts. This ensures that all critical environment variables are present and valid before the server launches. If any required variables are missing or incorrect, the server will fail to start.

### Example of Environment Variable Validation with Zod

```typescript
// apps/config/env.config.ts
import { z } from "zod";

// Define the schema for environment variables
const envSchema = z.object({
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional().default("info"),
  DATABASE_HOST: z.string(),
  DATABASE_USER: z.string(),
  SECRET_KEY: z.string(),
});

// Parse and validate the environment variables
export const envConfig = envSchema.parse(process.env);

// Access the variables
console.log(envConfig.LOG_LEVEL);
console.log(envConfig.DATABASE_HOST);
```

### Sample Environment Variables

Here’s an example `.env` file that corresponds to the validation schema above:

```bash
# .env (shared across environments)
LOG_LEVEL=info
DATABASE_HOST=https://db.example.com
DATABASE_USER=myUser
SECRET_KEY=MY_SECRET_KEY

# .env.local (development-specific, not included in version control)
DATABASE_HOST=http://localhost:5432
DATABASE_USER=localUser
SECRET_KEY=LOCAL_SECRET_KEY

# .env.production (production-specific)
DATABASE_HOST=https://prod-db.example.com
SECRET_KEY=PROD_SECRET_KEY
```

### Sample Environment Variables Template

A template for setting up the required environment variables is provided in the `env/.env.sample` file for both types of applications. This file contains examples of all the necessary environment variables.

By following this approach, we ensure a secure, scalable, and consistent configuration process for managing environment variables in both **Next.js** and **Node.js** applications, with robust validation through **Zod** and clear separation of configurations by application domain.

### Disclaimer

If you find any inconsistencies in the codebase compared to this documentation, please raise an issue or create a pull request to update the codebase accordingly. This documentation serves as the source of truth for managing environment variables and configurations across the applications.

