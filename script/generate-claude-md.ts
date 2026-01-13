#!/usr/bin/env node

import { execSync } from "child_process";
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

// Configuration
const REPO = process.env.GITHUB_REPOSITORY || "akash-network/console";
const CATEGORY_NAME = "Contribution RFC";
const LABEL_NAME = "RFC:Landed";
const GUIDELINES_DIR = ".claude/instructions";
const OUTPUT_FILE = "CLAUDE.md";

// Colors for output
const colors = {
  red: "\x1b[0;31m",
  green: "\x1b[0;32m",
  yellow: "\x1b[1;33m",
  reset: "\x1b[0m"
};

function log(level: "INFO" | "WARN" | "ERROR", message: string): void {
  const color = level === "INFO" ? colors.green : level === "WARN" ? colors.yellow : colors.red;
  console.log(`${color}[${level}]${colors.reset} ${message}`);
}

// Convert RFC title to filename
function titleToFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// Extract AI Instructions section from discussion body
function extractAIInstructions(body: string): string | null {
  const lines = body.split("\n");
  let found = false;
  const content: string[] = [];

  for (const line of lines) {
    if (line.match(/^##\s*AI\s*Instructions?/)) {
      found = true;
      continue;
    }
    if (found && (/^<!--\s*END\s*AI\s*INSTRUCTIONS\s*-->/.test(line) || line.startsWith("## "))) {
      break;
    }
    if (found) {
      // reduce heading level by 1
      content.push(line.startsWith("#") ? line.slice(1) : line);
    }
  }

  const result = content.join("\n").trim();
  return result || null;
}

// Execute gh CLI command
function ghCommand(args: string[]): string {
  try {
    return execSync(`gh ${args.join(" ")}`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    }).trim();
  } catch (error: any) {
    log("ERROR", `gh command failed: ${error.message}`);
    throw error;
  }
}

interface Discussion {
  title: string;
  body: string;
  labels: { nodes: Array<{ name: string }> };
}

interface DiscussionsResponse {
  data: {
    repository: {
      discussionCategories: {
        nodes: Array<{ id: string; name: string }>;
      };
      discussions: {
        nodes: Discussion[];
      };
    };
  };
}

function main(): void {
  log("INFO", "Starting CLAUDE.md generation...");

  // Check if gh CLI is available
  try {
    execSync("gh --version", { stdio: "ignore" });
  } catch {
    log("ERROR", "gh CLI is not installed. Please install it first.");
    process.exit(1);
  }

  // Create guidelines directory if it doesn't exist
  if (!existsSync(GUIDELINES_DIR)) {
    mkdirSync(GUIDELINES_DIR, { recursive: true });
  }

  const [owner, repo] = REPO.split("/");

  // Get the category ID for "Contribution RFC"
  log("INFO", `Fetching category ID for '${CATEGORY_NAME}'...`);

  const categoryQuery = gql`
    query ($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        discussionCategories(first: 100) {
          nodes {
            id
            name
          }
        }
      }
    }
  `;

  const categoryResult: DiscussionsResponse = JSON.parse(
    ghCommand(["api", "graphql", "-f", `query='${categoryQuery}'`, "-F", `owner=${owner}`, "-F", `repo=${repo}`])
  );

  const category = categoryResult.data.repository.discussionCategories.nodes.find(c => c.name === CATEGORY_NAME);

  if (!category) {
    log("ERROR", `Could not find category '${CATEGORY_NAME}'`);
    process.exit(1);
  }

  log("INFO", `Found category ID: ${category.id}`);

  // Fetch all discussions with RFC:Landed label
  log("INFO", `Fetching discussions with label '${LABEL_NAME}'...`);

  const discussionsQuery = gql`
    query ($owner: String!, $repo: String!, $categoryId: ID!) {
      repository(owner: $owner, name: $repo) {
        discussions(first: 100, categoryId: $categoryId) {
          nodes {
            title
            body
            labels(first: 10) {
              nodes {
                name
              }
            }
          }
        }
      }
    }
  `;

  const discussionsResult: DiscussionsResponse = JSON.parse(
    ghCommand(["api", "graphql", "-f", `query='${discussionsQuery}'`, "-F", `owner=${owner}`, "-F", `repo=${repo}`, "-F", `categoryId=${category.id}`])
  );

  const discussions = discussionsResult.data.repository.discussions.nodes || [];

  // Track existing files to clean up removed RFCs
  const existingFiles = existsSync(GUIDELINES_DIR)
    ? readdirSync(GUIDELINES_DIR)
        .filter(f => f.endsWith(".md") && f !== "README.md")
        .map(f => join(GUIDELINES_DIR, f))
    : [];

  // Process each discussion
  log("INFO", "Processing discussions...");
  const processedFiles: string[] = [];
  let claudeContent = "# Contribution Guidelines\n\nThis file aggregates all RFC (Request for Comments) contribution guidelines that have landed.\n\n";
  let rfcCount = 0;

  for (const discussion of discussions) {
    const hasLabel = discussion.labels.nodes.some(l => l.name === LABEL_NAME);

    if (hasLabel) {
      log("INFO", `Processing RFC: ${discussion.title}`);

      // Extract AI Instructions section
      const aiInstructions = extractAIInstructions(discussion.body);

      if (!aiInstructions) {
        log("WARN", `No '## AI Instructions' section found in '${discussion.title}'. Skipping...`);
        continue;
      }

      // Generate filename
      const filename = `${titleToFilename(discussion.title)}.md`;
      const filepath = join(GUIDELINES_DIR, filename);
      processedFiles.push(filepath);

      writeAiInstruction(filepath, aiInstructions);

      log("INFO", `Created/Updated: ${filepath}`);

      // Add to CLAUDE.md content
      claudeContent += `\n## ${discussion.title}\n\nSee detailed guidelines:\n@./${GUIDELINES_DIR}/${filename}\n`;
      rfcCount++;
    }
  }

  // Remove files for RFCs that no longer have RFC:Landed label
  for (const existingFile of existingFiles) {
    if (!processedFiles.includes(existingFile)) {
      log("INFO", `Removing obsolete file: ${existingFile}`);
      unlinkSync(existingFile);
    }
  }

  // Generate root CLAUDE.md
  log("INFO", `Generating root ${OUTPUT_FILE}...`);
  writeFileSync(OUTPUT_FILE, claudeContent, "utf-8");

  log("INFO", `Successfully generated ${OUTPUT_FILE} with ${rfcCount} RFC(s)`);
}

function gql(strings: TemplateStringsArray, ...values: string[]): string {
  return strings
    .reduce((acc, str, i) => acc + str + (values[i] || ""), "")
    .replace(/\s+/g, " ")
    .trim();
}

function writeAiInstruction(filepath: string, aiInstructions: string): void {
  writeFileSync(filepath, aiInstructions, "utf-8");
}

main();
