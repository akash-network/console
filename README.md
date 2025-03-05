<div align="left">

  <a href="https://aimeos.org/">
    <img src="./apps/deploy-web/public/android-chrome-192x192.png" alt="Akash logo" title="Akash Console" align="left" height="40" />
  </a>

  # Akash Console

  **Akash Console** is a powerful application that allows you to deploy any [Docker container](https://www.docker.com/) on the [Akash Network](https://akash.network) with just a few clicks. 🚀

[![version](https://img.shields.io/github/stars/akash-network/console)](https://github.com/akash-network/console/stargazers)
  [![license](https://img.shields.io/github/license/akash-network/console)](https://github.com/akash-network/console/blob/main/LICENSE)
  [![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/akashnet_)](https://x.com/akashnet_)
  [![Discord](https://img.shields.io/badge/discord-join-7289DA.svg?logo=discord&longCache=true&style=flat)](https://discord.gg/akash)
</div>

## Table of Contents

- [Quick Start](#quick-start)
- [Apps Configuration](./doc/apps-configuration.md)
- [Services](#services)
- [Running the Application](#running-the-application)
- [Manual Database Restoration](#manual-database-restoration)
- [Database Structure](./doc/database-structure.md)
- [Release Workflow](./doc/release-workflow.md)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

To get started with Akash Console, follow these steps:

```bash
git clone git@github.com:akash-network/console.git ./akash-console
cd akash-console
npm run dc:up:dev -- deploy-web
```

This will start the deploy-web service in development mode with all the necessary dependencies (API, indexer, PostgreSQL). It will also import a backup of the sandbox database by default to speed up the process.

## Applications

All services are Node.js applications written in TypeScript and deployed using Docker. Both databases are PostgreSQL.

- [Console](./apps/deploy-web/): The main website for deploying on Akash, built using the Next.js framework. Data is fetched from a combination of our API and Akash nodes (REST).
  - [console.akash.network](https://console.akash.network)
- [Stats](./apps/stats/): The stats website built using Next.js, displaying the usage data of the Akash Network from the Indexer database.
  - [stats.akash.network](https://stats.akash.network)
- [Api](./apps/api/): Provides data to the deploy website, fetching from our Indexer database.
  - [console-api.akash.network](https://console-api.akash.network/v1/swagger)
- [Indexer](./apps/indexer/): Fetches the latest blocks from RPC nodes and saves blocks & stats to our Indexer Database. For details on how the indexer works, see the [Indexer README](./indexer/README.md).
- [Provider Proxy](./apps/provider-proxy/): Used in the deploy website to proxy requests to providers. This is necessary since it's not possible to use the cert authentication system from the browser.

## Running the Application

This document provides instructions on how to set up and run the application, including steps for manual database restoration and using Docker Compose for ease of setup.

### Using Docker and Docker Compose
This project's service are deployed using Docker and Docker Compose. The following sections provide instructions for setting up and running the application using Docker Compose.
All the Dockerfiles are using multi-stage builds to optimize the image build processes. Same files are used to build both development and production images.

There are 3 docker-compose files:
- **docker-compose.build.yml:** Base file solely building production images for the services. It can be used to verify the same build process as in CICD.
- **docker-compose.prod.yml:** This file is used to run the services in production mode. It also includes the database service which would fetch a remote backup and import it on init.
- **docker-compose.yml:** The default file to run all the services in development mode with features like hot-reload.

Some commands are added to package.json for convenience.

```shell
npm run dc:build # Build the production images
npm run dc:up:prod # Run the services in production mode
npm run dc:up:dev # Run the services in development mode
npm run dc:down # Stop the services referencing any possible service
```

Note: you may pass any `docker compose` related arguments to the above commands. E.g. to only start `deploy-web` service in development mode:
```shell
npm run dc:up:dev -- deploy-web
```
This would also properly spin up all the dependencies like the `api`.
### Using Turbo Repo
Another way to run apps in dev mode is using turbo repo setup. Some available commands are:
```shell
npm run console:dev # run console ui in dev mode with dependencies
npm run stats:dev # run stats ui in dev mode with dependencies
npm run api:dev # run api in dev mode with dependencies
npm run indexer:dev # run indexer in dev mode with dependencies
```

Note the above commands still depend on docker to run postgres database. If you need to run them without db you can use the following commands:
```shell
npm run console:dev:no-db # run console ui in dev mode with dependencies but without postgres in docker
npm run stats:dev:no-db # run stats ui in dev mode with dependencies but without postgres in docker
```

## Manual Database Restoration

Due to the extensive time required to index Akash from block #1, it's recommended to initialize your database using an existing backup for efficiency. This approach is particularly beneficial for development purposes.

### Available Backups

- **Mainnet Database (~30 GB):** [console-akash-mainnet.sql.gz](https://storage.googleapis.com/console-postgresql-backups/console-akash-mainnet.sql.gz)
  - Suitable for scenarios requiring complete data.
- **Sandbox Database (< 300 MB):** [console-akash-sandbox.sql.gz](https://storage.googleapis.com/console-postgresql-backups/console-akash-sandbox.sql.gz)
  - Ideal for most development needs, although it may lack recent chain updates.

### Restoration Steps

1. Create a PostgreSQL database.
2. Restore the database using `psql`. Ensure PostgreSQL tools are installed on your system.

For a .sql.gz file:
```sh
gunzip -c /path/to/console-akash-sandbox.sql.gz | psql --host "localhost" --port "5432" --username "postgres" --dbname "console-akash"
```
After restoring the database, you can proceed with the specific project's README instructions for further setup and running the application.

## Services

This project is structured as a monorepo, allowing us to manage multiple related applications and shared packages in a single repository.

![Dataflow between services](infra.drawio.png)

## Shared Packages

We utilize a `/packages` folder to define reusable packages that can be shared between applications. This approach promotes code reuse, maintainability, and consistency across our services. Some examples of shared packages include:

- Common utilities
- Shared types and interfaces
- Reusable UI components
- Shared configuration files

By leveraging this monorepo structure with shared packages, we can efficiently manage dependencies, streamline development workflows, and ensure consistency across our various applications.

For more information on how to use or contribute to shared packages, please refer to the code within each package in the `/packages` directory.

## Contributing

If you'd like to contribute to the development of Akash Console, please refer to the guidelines outlined in the [CONTRIBUTING.md](./CONTRIBUTING.md) file.

test changes3

## License

This project is licensed under the [Apache License 2.0](./LICENSE).
