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

When running the api locally the following environment variables can be set in a `.env.local` file.

It is possible to run the website locally without any environment variables, but the login feature will be unavailable.

|Name|Value|Note|
|-|-|-
|NEXT_PUBLIC_GA_MEASUREMENT_ID|ex: `G-87H3KK3D`|Google Analytics ID
|NEXT_PUBLIC_SENTRY_DSN|ex: `"https://1234...789@z645.ingest.sentry.io/1234"`|[Sentry DSN](https://docs.sentry.io/product/sentry-basics/dsn-explainer/) used when initializing Sentry in [sentry.client.config.js](./sentry.client.config.js) and [sentry.server.config.js](./sentry.server.config.js)
|AUTH0_SECRET||
|AUTH0_BASE_URL||
|AUTH0_ISSUER_BASE_URL||
|AUTH0_CLIENT_ID||
|AUTH0_CLIENT_SECRET||
|AUTH0_AUDIENCE||
|AUTH0_SCOPE||
|AUTH0_M2M_DOMAIN||
|AUTH0_M2M_CLIENT_ID||
|AUTH0_M2M_CLIENT_SECRET||