#!/usr/bin/env node

const { execSync } = require("child_process");

try {
  console.log("🧪 Running UI tests and checking coverage...");

  // Run Jest with coverage options, collecting coverage only for components and hooks
  const result = execSync(
    'npx jest --coverage --collectCoverageFrom="src/components/**/*.{ts,tsx}" --collectCoverageFrom="src/hooks/**/*.{ts,tsx}" --coverageThreshold=\'{"global":{"statements":70,"branches":70,"functions":70,"lines":70}}\' --passWithNoTests',
    { encoding: "utf8" }
  );

  console.log(result);
  console.log("✅ Tests passed and coverage thresholds met!");
  process.exit(0);
} catch (error) {
  console.log(error.stdout);
  console.log("❌ Tests failed or coverage thresholds not met!");
  process.exit(1);
}
