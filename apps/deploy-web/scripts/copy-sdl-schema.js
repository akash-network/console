/**
 * Copies sdl-schema.yaml from @akashnetwork/chain-sdk into public/ for monaco-yaml.
 * Needed because `next dev --turbopack` ignores the webpack CopyPlugin in next.config.js;
 * prod `next build` still copies via that plugin, which imports the source path from here.
 */
const path = require("path");
const fs = require("fs");

const sdlSchemaSourcePath = path.join(require.resolve("@akashnetwork/chain-sdk"), "..", "..", "sdl-schema.yaml");

if (require.main === module) {
  fs.copyFileSync(sdlSchemaSourcePath, path.join(__dirname, "..", "public", "sdl-schema.yaml"));
}

module.exports = { sdlSchemaSourcePath };
