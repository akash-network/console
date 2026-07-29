/**
 * Copies sdl-schema.yaml from @akashnetwork/chain-sdk into public/ for monaco-yaml.
 * Needed because `next dev --turbopack` ignores the webpack CopyPlugin in next.config.js
 * (prod `next build` still runs it). Keep the source path in sync with that plugin.
 */
const path = require("path");
const fs = require("fs");

fs.copyFileSync(path.join(require.resolve("@akashnetwork/chain-sdk"), "..", "..", "sdl-schema.yaml"), path.join(__dirname, "..", "public", "sdl-schema.yaml"));
