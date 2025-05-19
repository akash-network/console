# Akash Console

- [How to run](#how-to-run)
- [Environment Variables](#environment-variables)
- [Feature flags](#feature-flags)

## How to run

1. Make sure you have a valid [Akash database](/README.md#how-to-run) first.
2. Make sure you have a valid User database. If the user database is empty, the necessary tables will be created automatically.
3. Run `npm install` to install dependencies.
4. Start the app with `npm run dev`.

The website should be accessible: [http://localhost:3000/](http://localhost:3000/)

## Feature flags
This app uses [Unleash](https://www.getunleash.io/) for feature flagging. Locally, feature flagging can be bypassed by setting the environment variable `NEXT_PUBLIC_UNLEASH_ENABLE_ALL=true` in your `.env.local` file. This disables remote evaluation and treats all flags as enabled, which is useful for local development.
Please use the patched `useFlag` hook provided in this codebase to ensure consistent behavior when bypassing remote flag checks.