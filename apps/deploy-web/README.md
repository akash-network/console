# Akash Console

- [How to run](#how-to-run)
- [Environment Variables](#environment-variables)

## How to run

1. Make sure you have a valid [Akash database](/README.md#how-to-run) first.
2. Make sure you have a valid User database. If the user database is empty, the necessary tables will be created automatically.
3. Run `npm install` to install dependencies.
4. Start the app with `npm run dev`.

The website should be accessible: [http://localhost:3000/](http://localhost:3000/)

## Environment Variables

### Overview
Environment variables in this Next.js app follow the standard Next.js behavior, as documented in the [Next.js environment variables documentation](https://nextjs.org/docs/basic-features/environment-variables). This means that files like `.env.local` or `.env.production` will be automatically loaded based on the environment in which the app is running.

However, we have extended this functionality to support more granular environment-specific configurations. Environment variables are stored in the `./env` directory, where multiple `.env` files exist for different deployment environments (stages):

- `.env` - Loaded for any environment
- `.env.production` - Loaded for the production stage
- `.env.staging` - Loaded for the staging stage

### How Environment Variables Are Loaded
We use **dotenvx** to manage and load environment variables. This allows us to take advantage of its features, such as **variable interpolation** (i.e., using other environment variables within variable values).

### Validation with Zod
Environment variables are validated using **Zod** schemas, ensuring that all required variables are present and have valid values. The validation logic can be found in the file `src/config/env-config.schema.ts`.

We use two separate Zod schemas:
- **Static Build-Time Schema**: Validates variables at build time. If any variables are missing or invalid during the build process, the build will fail.
- **Dynamic Server Runtime Schema**: Validates variables at server startup. If any variables are missing or invalid at this stage, the server will fail to start.

This validation ensures that both build and runtime configurations are secure and complete before the app runs.

### App Configuration
App configurations, including environment variables, are located in the `src/config` directory. In our setup:
- **Environment configs** are handled separately from **hardcoded configs**.
- Hardcoded configs are organized by domain to maintain a clear structure and separation of concerns.

### Sample Environment Variables
All environment variables required for the app, along with their expected structure and types, can be found in the `env/.env.sample` file. This sample file serves as a template for setting up your environment variables and ensures that all necessary variables are accounted for in each environment.

By organizing environment variables and configuration this way, we ensure a consistent, safe, and scalable approach to managing different deployment environments.

FOO