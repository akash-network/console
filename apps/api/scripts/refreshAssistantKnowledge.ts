import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { curateAkashSkill, renderKnowledgeModule } from "@src/feedback/lib/akash-skill-curation/akash-skill-curation";
import { AKASH_SKILL_CURATION_MANIFEST as manifest } from "@src/feedback/lib/akash-skill-curation/akash-skill-curation-manifest";

const OUTPUT_PATH = "src/feedback/lib/assistant-knowledge/akash-skill-knowledge.gen.ts";

async function fetchSkillFile(path: string): Promise<string> {
  const response = await fetch(`https://raw.githubusercontent.com/${manifest.repository}/${manifest.commit}/${path}`);
  if (!response.ok) throw new Error(`Could not fetch ${path} at ${manifest.commit}: HTTP ${response.status}`);

  return response.text();
}

async function readSkillFiles(localCheckout: string | undefined): Promise<Map<string, string>> {
  const paths = manifest.files.map(({ path }) => path);
  const contents = await Promise.all(paths.map(path => (localCheckout ? readFileSync(join(localCheckout, path), "utf8") : fetchSkillFile(path))));

  return new Map(paths.map((path, index) => [path, contents[index]]));
}

async function main() {
  const localCheckout = process.argv[2];
  const files = await readSkillFiles(localCheckout);
  const documents = curateAkashSkill(manifest, path => files.get(path) ?? "");

  writeFileSync(OUTPUT_PATH, renderKnowledgeModule(manifest, documents));
  execFileSync("npx", ["prettier", "--write", OUTPUT_PATH], { stdio: "inherit" });

  const origin = localCheckout ? `the local checkout ${localCheckout}` : `${manifest.repository} ${manifest.version} (${manifest.commit})`;
  process.stdout.write(`Wrote ${documents.length} documents from ${origin} to ${OUTPUT_PATH}\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
