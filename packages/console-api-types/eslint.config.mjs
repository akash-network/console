import tsConfig from "@akashnetwork/dev-config/eslint/typescript.mjs";

export default [...tsConfig, { ignores: ["src/schema.d.ts", "src/operations.gen.ts"] }];
