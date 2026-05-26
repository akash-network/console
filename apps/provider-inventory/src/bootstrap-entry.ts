// !!! WARNING: we need this file to ensure that providers and model schemas are loaded before the entry point.
// To preserve the order of app related side-effects, use dynamic imports. But ideally, just get rid of them.
import "reflect-metadata";
import "@akashnetwork/env-loader";

export async function bootstrapEntry<T>(loadEntry: () => Promise<T>): Promise<T> {
  await import("./providers/index.ts");
  return await loadEntry();
}
