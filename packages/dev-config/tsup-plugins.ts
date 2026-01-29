import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Options } from "tsup"; // eslint-disable-line import-x/no-extraneous-dependencies

type Plugin = Required<Options>["plugins"][number];
type EsBuildPlugin = Required<Options>["esbuildPlugins"][number];

export const copyDrizzlePlugin: Plugin = {
  name: "copy-drizzle",
  async buildEnd() {
    const drizzleDir = "drizzle";
    const destDir = join("dist", drizzleDir);

    if (existsSync(drizzleDir)) {
      await fs.cp(drizzleDir, destDir, { recursive: true });
    }
  }
};

const prependEntrySideEffectsEsBuildPlugin = (options: { cwd: string; require: string[] }): EsBuildPlugin => ({
  name: "prepend-entry-side-effects",
  setup(build) {
    build.onEnd(async result => {
      const meta = result?.metafile;
      if (!meta) return;

      const SENTINEL = "// __PREPEND_ENTRY_SIDE_EFFECTS__\n";
      const prefix = SENTINEL + options.require.map(moduleName => `require("${moduleName}");`).join("\n") + "\n";

      const outputFiles = (result.outputFiles || []).reduce(
        (acc, file) => acc.set(file.path, file),
        new Map<string, Exclude<typeof result.outputFiles, undefined>[number]>()
      );
      for (const [outFile, outInfo] of Object.entries(meta.outputs)) {
        if (!outInfo.entryPoint) continue;

        const entryOutputPath = join(options.cwd, outFile);
        const inMemoryFile = outputFiles.get(entryOutputPath);
        const src = inMemoryFile ? inMemoryFile.text : (await fs.readFile(entryOutputPath, "utf8")).toString();
        if (!src.startsWith(SENTINEL)) {
          if (inMemoryFile) {
            inMemoryFile.contents = Buffer.from(prefix + src);
          } else {
            await fs.writeFile(entryOutputPath, prefix + src, "utf8");
          }
        }
      }
    });
  }
});

export const applyDefaults = async ({ packageJson, prependEffectsToEntries, ...options }: ApplyDefaultsOptions): Promise<Options> => {
  const { noExternal, external } = await getExternalConfig(packageJson);

  return {
    sourcemap: true,
    clean: true,
    outDir: "dist",
    splitting: true,
    bundle: true,
    platform: "node",
    format: ["cjs"],
    ...options,
    noExternal: [...noExternal, ...(options.noExternal ?? [])],
    external: [...external, ...(options.external ?? [])],
    define: {
      ...options.define,
      "process.env.APP_VERSION": JSON.stringify(packageJson.version)
    },
    esbuildOptions(options) {
      options.metafile = options.metafile || !!prependEffectsToEntries;
    },
    esbuildPlugins: [
      prependEffectsToEntries &&
        prependEntrySideEffectsEsBuildPlugin({
          require: prependEffectsToEntries,
          cwd: process.cwd()
        }),
      ...(options.esbuildPlugins ?? [])
    ].filter(Boolean) as EsBuildPlugin[],
    swc: {
      jsc: {
        keepClassNames: true,
        ...options.swc?.jsc,
        transform: {
          useDefineForClassFields: false,
          ...options.swc?.jsc?.transform
        }
      }
    } as Options["swc"]
  };
};

interface ApplyDefaultsOptions extends Options {
  packageJson: Record<string, any>;
  prependEffectsToEntries?: string[];
}

async function getExternalConfig(packageJson: Record<string, any>): Promise<Required<Pick<Options, "noExternal" | "external">>> {
  const internalPackages = Object.keys(packageJson.dependencies).filter(
    name => name !== "@akashnetwork/env-loader" && name.startsWith("@akashnetwork/") && packageJson.dependencies[name] === "*"
  );

  const externalDeps = new Set<string>();
  await Promise.all(
    internalPackages.map(async internalPackageName => {
      const pkgJsonPath = fileURLToPath(import.meta.resolve(`${internalPackageName}/package.json`));
      const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, "utf8"));
      const deps = { ...pkgJson.dependencies, ...pkgJson.peerDependencies };
      Object.keys(deps).forEach(dep => {
        if (internalPackages.includes(dep)) return;
        if (isInternalPackageDependency(internalPackageName, dep)) {
          // if package is not hoisted, we need to bundle it inside the app
          // otherwise this package won't be found in runtime
          console.warn(
            `\x1b[33mWARN\x1b[0m: Bundling "${dep}" internal package dependency of "${internalPackageName}" inside app. Use "npm ls ${dep}" to check why it's not hoisted.`
          );
        } else {
          externalDeps.add(dep);
        }
      });
    })
  );

  return { noExternal: internalPackages, external: [...externalDeps] };
}

function isInternalPackageDependency(packageName: string, dependency: string): boolean {
  const pathToPackage = import.meta.resolve(join(packageName, "package.json"));
  const possiblyInternalPackagePath = fileURLToPath(import.meta.resolve(join(pathToPackage, "..", "node_modules", dependency)));
  return existsSync(possiblyInternalPackagePath);
}
