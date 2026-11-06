import { tokenize } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge";
import type { KnowledgeDocument } from "@src/feedback/lib/assistant-knowledge/assistant-knowledge-pack";

export interface SkillSectionSelection {
  heading: string;
  title: string;
  omit?: string[];
  consoleNote?: string;
}

export interface SkillFileSelection {
  path: string;
  id: string;
  title: string;
  sections: SkillSectionSelection[];
}

export interface SkillCorrection {
  find: string | RegExp;
  replace: string;
}

export interface SkillGuard {
  pattern: RegExp;
  reason: string;
}

export interface SkillCurationManifest {
  repository: string;
  version: string;
  commit: string;
  license: string;
  maxChunkLength: number;
  files: SkillFileSelection[];
  corrections: SkillCorrection[];
  guards: SkillGuard[];
}

interface MarkdownLine {
  text: string;
  headingLevel: number;
}

function parseLines(markdown: string): MarkdownLine[] {
  let isInFence = false;

  return markdown.split("\n").map(text => {
    if (/^\s*(```|~~~)/.test(text)) {
      isInFence = !isInFence;
      return { text, headingLevel: 0 };
    }

    const heading = isInFence ? null : /^(#{1,6}) /.exec(text);
    return { text, headingLevel: heading ? heading[1].length : 0 };
  });
}

function sectionEnd(lines: MarkdownLine[], start: number): number {
  const level = lines[start].headingLevel;
  const end = lines.findIndex((line, index) => index > start && line.headingLevel > 0 && line.headingLevel <= level);

  return end === -1 ? lines.length : end;
}

function withoutSection(lines: MarkdownLine[], heading: string): MarkdownLine[] {
  const start = lines.findIndex(line => line.headingLevel > 0 && line.text === heading);
  if (start === -1) throw new Error(`nested section "${heading}" not found`);

  return [...lines.slice(0, start), ...lines.slice(sectionEnd(lines, start))];
}

export function extractSection(markdown: string, heading: string, omit: string[] = []): string {
  const lines = parseLines(markdown);
  const start = lines.findIndex(line => line.headingLevel > 0 && line.text === heading);
  if (start === -1) throw new Error(`section "${heading}" not found`);

  const body = omit.reduce(withoutSection, lines.slice(start + 1, sectionEnd(lines, start)));
  return body
    .map(({ text }) => text)
    .join("\n")
    .trim();
}

export function stripRelativeLinks(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\((?!https?:)[^)]*\)/g, "$1")
    .split("\n")
    .filter(line => !/^See\b/.test(line))
    .join("\n");
}

export function applyCorrections(markdown: string, corrections: SkillCorrection[]): string {
  return corrections.reduce((corrected, { find, replace }) => corrected.replaceAll(find, replace), markdown);
}

export function findGuardViolations(markdown: string, guards: SkillGuard[]): string[] {
  return guards.filter(({ pattern }) => pattern.test(markdown)).map(({ reason }) => reason);
}

function curateSection(manifest: SkillCurationManifest, markdown: string, section: SkillSectionSelection): string {
  const extracted = extractSection(markdown, section.heading, section.omit);
  const corrected = applyCorrections(stripRelativeLinks(extracted), manifest.corrections);
  const withNote = section.consoleNote ? `${corrected}\n\nIn Console: ${section.consoleNote}` : corrected;

  return withNote.replace(/\n{3,}/g, "\n\n").trim();
}

function sectionProblems(manifest: SkillCurationManifest, body: string): string[] {
  const problems = findGuardViolations(body, manifest.guards);
  if (/^## /m.test(body)) problems.push("contains a second-level heading, which would split the chunk");
  if (body.length > manifest.maxChunkLength) problems.push(`is ${body.length} characters, over the ${manifest.maxChunkLength} limit`);
  if (body.length === 0) problems.push("is empty");

  return problems;
}

export function curateAkashSkill(manifest: SkillCurationManifest, readFile: (path: string) => string): KnowledgeDocument[] {
  const problems: string[] = [];

  const documents = manifest.files.map(file => {
    const markdown = readFile(file.path);
    const chunkIds = new Set<string>();

    const chunks = file.sections.map(section => {
      const where = `${file.path} ${section.heading}`;
      const chunkId = tokenize(section.title).join("-");
      if (chunkIds.has(chunkId)) problems.push(`${where}: title "${section.title}" repeats a chunk id in ${file.id}`);
      chunkIds.add(chunkId);

      try {
        const body = curateSection(manifest, markdown, section);
        problems.push(...sectionProblems(manifest, body).map(problem => `${where}: ${problem}`));
        return `## ${section.title}\n${body}`;
      } catch (error) {
        problems.push(`${where}: ${(error as Error).message}`);
        return "";
      }
    });

    return {
      id: file.id,
      title: file.title,
      source: `${manifest.repository} ${manifest.version} (${manifest.license}): ${file.path}`,
      markdown: `\n${chunks.join("\n\n")}\n`
    };
  });

  if (problems.length > 0) throw new Error(`The Akash skill cannot be curated as configured:\n- ${problems.join("\n- ")}`);
  return documents;
}

function templateLiteralOf(text: string): string {
  return `\`${text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\``;
}

export function renderKnowledgeModule(manifest: SkillCurationManifest, documents: KnowledgeDocument[]): string {
  const source = { repository: manifest.repository, version: manifest.version, commit: manifest.commit, license: manifest.license };
  const renderedDocuments = documents.map(document =>
    [
      "  {",
      `    id: ${JSON.stringify(document.id)},`,
      `    title: ${JSON.stringify(document.title)},`,
      `    source: ${JSON.stringify(document.source)},`,
      `    markdown: ${templateLiteralOf(document.markdown)}`,
      "  }"
    ].join("\n")
  );

  return [
    'import type { KnowledgeDocument } from "./assistant-knowledge-pack";',
    "",
    "/** Generated by `npm run knowledge:refresh` from the Akash skill; change the curation manifest instead of this file. */",
    `export const AKASH_SKILL_KNOWLEDGE_SOURCE = ${JSON.stringify(source, null, 2).replace(/"(\w+)":/g, "$1:")} as const;`,
    "",
    "export const AKASH_SKILL_KNOWLEDGE_DOCUMENTS: KnowledgeDocument[] = [",
    renderedDocuments.join(",\n"),
    "];",
    ""
  ].join("\n");
}
