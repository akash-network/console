import { createHash } from "node:crypto";

import type { Template } from "@src/template/types/template";
import {
  MAX_TEMPLATE_CATEGORIES,
  MAX_TEMPLATE_README_LENGTH,
  MAX_TEMPLATE_SUMMARY_LENGTH,
  MAX_TEMPLATE_TITLE_LENGTH,
  type TemplateIcon
} from "@src/template-marketplace/lib/template-catalog/template-catalog";

export const IMPORTED_TEMPLATE_ICON: TemplateIcon = "box";

export const MAX_IMPORTED_CATEGORY_LENGTH = 64;

export type GalleryTemplate = Pick<Template, "id" | "name" | "summary" | "readme" | "deploy" | "githubUrl">;

export type GalleryListing = { id: string; categories: string[] };

export type ImportedTemplateContent = {
  importedRef: string;
  title: string;
  summary: string | null;
  categories: string[];
  sdl: string;
  readme: string | null;
  contentHash: string;
};

export type ImportedTemplateState = {
  title: string;
  summary: string | null;
  categories: string[];
  isListed: boolean;
  importedContentHash: string | null;
  /** Staff chose the categories, which the gallery's must then never replace. */
  hasStaffCategories: boolean;
};

export type ImportedTemplateSettings = Partial<Pick<ImportedTemplateState, "title" | "summary" | "categories" | "isListed">>;

export type ImportedTemplateChanges = { settings: ImportedTemplateSettings; hasNewContent: boolean };

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/g;

// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS_BUT_LINE_BREAKS_AND_TABS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/g;

const COMMIT_OF_GITHUB_URL = /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\/([^/]+)\//;

function singleLine(text: string, maxLength: number): string {
  return text.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim().slice(0, maxLength).trim();
}

function readableReadme(readme: string): string | null {
  return readme.replace(CONTROL_CHARACTERS_BUT_LINE_BREAKS_AND_TABS, "").slice(0, MAX_TEMPLATE_README_LENGTH) || null;
}

function readableCategories(categories: string[]): string[] {
  const named = categories.map(category => singleLine(category, MAX_IMPORTED_CATEGORY_LENGTH)).filter(Boolean);

  return [...new Set(named)].slice(0, MAX_TEMPLATE_CATEGORIES);
}

/** The gallery pins every relative readme link to the commit it was built from, so that commit is left out or each upstream commit would read as a change to every template. */
function withoutBuildCommit(readme: string | null, githubUrl: string): string | null {
  const commit = COMMIT_OF_GITHUB_URL.exec(githubUrl)?.[1];

  return readme && commit ? readme.split(commit).join("") : readme;
}

export function hashImportedContent({ sdl, readme, githubUrl }: { sdl: string; readme: string | null; githubUrl: string }): string {
  return createHash("sha256")
    .update(JSON.stringify([sdl, withoutBuildCommit(readme, githubUrl)]))
    .digest("hex");
}

/** Holds gallery text to the limits and characters a publisher's own text is held to, so an imported template shows like any other. */
export function toImportedTemplate(template: GalleryTemplate, categories: string[]): ImportedTemplateContent {
  const readme = readableReadme(template.readme);

  return {
    importedRef: template.id,
    title: singleLine(template.name, MAX_TEMPLATE_TITLE_LENGTH) || singleLine(template.id, MAX_TEMPLATE_TITLE_LENGTH),
    summary: singleLine(template.summary, MAX_TEMPLATE_SUMMARY_LENGTH) || null,
    categories: readableCategories(categories),
    sdl: template.deploy,
    readme,
    contentHash: hashImportedContent({ sdl: template.deploy, readme, githubUrl: template.githubUrl })
  };
}

function hasSameCategories(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((category, index) => category === right[index]);
}

/** Answers only what differs, so a run over an unchanged gallery writes nothing. */
export function findImportedTemplateChanges(stored: ImportedTemplateState, next: ImportedTemplateContent): ImportedTemplateChanges {
  return {
    settings: {
      ...(stored.title !== next.title && { title: next.title }),
      ...(stored.summary !== next.summary && { summary: next.summary }),
      ...(!stored.hasStaffCategories && !hasSameCategories(stored.categories, next.categories) && { categories: next.categories }),
      ...(!stored.isListed && { isListed: true })
    },
    hasNewContent: stored.importedContentHash !== next.contentHash
  };
}

export function hasImportedTemplateChanges({ settings, hasNewContent }: ImportedTemplateChanges): boolean {
  return hasNewContent || Object.keys(settings).length > 0;
}

/** A template listed under several categories is one template, which takes them all in the gallery's order. */
export function listGalleryTemplates(categories: { title: string; templates: { id: string }[] }[]): GalleryListing[] {
  const listings = new Map<string, GalleryListing>();

  for (const { title, templates } of categories) {
    for (const { id } of templates) {
      const listing = listings.get(id) ?? { id, categories: [] };
      listing.categories.push(title);
      listings.set(id, listing);
    }
  }

  return [...listings.values()];
}
