/**
 * Weekly Console Digest
 *
 * Fetches GitHub releases from the past week across all monorepo services,
 * uses AkashML (DeepSeek-V3.2) to produce a human-readable digest, then
 * posts to Slack with threaded replies per service area.
 *
 * Leverages the existing conventional-commit / semantic-release workflow
 * so there's zero extra burden on contributors.
 *
 * Required env vars:
 *   GITHUB_TOKEN          - GitHub token with repo read access
 *   AKASHML_API_KEY       - AkashML API key (api.akashml.com)
 *   SLACK_WEBHOOK_URL     - Slack incoming webhook URL (Option A)
 *   SLACK_BOT_TOKEN       - Slack bot token for threading (Option B)
 *   SLACK_CHANNEL_ID      - Slack channel ID for threading (Option B)
 *   REPO_OWNER            - GitHub org (default: "akash-network")
 *   REPO_NAME             - Repository name (default: "console")
 *   DAYS_BACK             - Days to look back (default: 7)
 *   DRY_RUN               - "true" to print instead of posting
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const REPO_OWNER = process.env.REPO_OWNER || "akash-network";
const REPO_NAME = process.env.REPO_NAME || "console";
const DAYS_BACK = parseInt(process.env.DAYS_BACK || "7", 10);
const DRY_RUN = process.env.DRY_RUN === "true";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const AKASHML_API_KEY = process.env.AKASHML_API_KEY;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL_ID = process.env.SLACK_CHANNEL_ID;

if (!Number.isFinite(DAYS_BACK) || DAYS_BACK <= 0) {
  throw new Error(
    `DAYS_BACK must be a positive integer (got: ${process.env.DAYS_BACK ?? "undefined"})`
  );
}
if (!GITHUB_TOKEN) throw new Error("GITHUB_TOKEN is required");
if (!AKASHML_API_KEY) throw new Error("AKASHML_API_KEY is required");
if (!DRY_RUN) {
  if (!SLACK_BOT_TOKEN && !SLACK_WEBHOOK_URL) {
    throw new Error("Provide SLACK_WEBHOOK_URL or SLACK_BOT_TOKEN + SLACK_CHANNEL_ID");
  }
  if (SLACK_BOT_TOKEN && !SLACK_CHANNEL_ID) {
    throw new Error("SLACK_CHANNEL_ID is required when using SLACK_BOT_TOKEN");
  }
}

const REPO_URL = `https://github.com/${REPO_OWNER}/${REPO_NAME}`;

// Known service scopes in the monorepo (tag prefix → display info)
const SERVICES = {
  "console-web": { emoji: "🌐", label: "Console Web" },
  "console-api": { emoji: "⚙️", label: "Console API" },
  "stats-web": { emoji: "📊", label: "Stats Web" },
  notifications: { emoji: "🔔", label: "Notifications" },
  "tx-signer": { emoji: "🔐", label: "TX Signer" },
  "provider-proxy": { emoji: "🔀", label: "Provider Proxy" },
  "provider-console": { emoji: "🖥️", label: "Provider Console" },
  indexer: { emoji: "🗂️", label: "Indexer" },
};

// ─── GitHub API ──────────────────────────────────────────────────────────────

async function githubFetch(endpoint) {
  const res = await fetch(`https://api.github.com${endpoint}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function fetchRecentReleases() {
  const since = new Date();
  since.setDate(since.getDate() - DAYS_BACK);

  let allReleases = [];
  let page = 1;
  let keepGoing = true;

  while (keepGoing) {
    const releases = await githubFetch(
      `/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=50&page=${page}`
    );

    if (releases.length === 0) break;

    for (const release of releases) {
      const publishedAt = new Date(release.published_at);
      if (publishedAt < since) {
        keepGoing = false;
        break;
      }
      allReleases.push(release);
    }

    page++;
    if (page > 10) {
      throw new Error(
        `Pagination cap (10) reached before ${DAYS_BACK} days were covered. ` +
        `Reduce DAYS_BACK or increase per_page.`
      );
    }
  }

  return allReleases;
}

function parseReleases(releases) {
  const serviceMap = {};
  const seenCommits = new Set();

  for (const release of releases) {
    const tagName = release.tag_name;
    const parts = tagName.split("/");
    const service = parts.length > 1 ? parts[0] : "unknown";
    const version = parts.length > 1 ? parts[1] : parts[0];

    if (!serviceMap[service]) {
      serviceMap[service] = {
        versions: [],
        changes: [],
        releaseUrls: [],
      };
    }

    serviceMap[service].versions.push(version);
    serviceMap[service].releaseUrls.push(release.html_url);

    if (release.body) {
      const lines = release.body.split("\n");
      let currentSection = "other";

      for (const line of lines) {
        if (line.match(/^###?\s*Features/i)) {
          currentSection = "feature";
          continue;
        }
        if (line.match(/^###?\s*Bug Fixes/i)) {
          currentSection = "bugfix";
          continue;
        }
        if (line.match(/^###?\s*Performance/i)) {
          currentSection = "performance";
          continue;
        }

        // Match conventional commit lines:
        // * **scope:** description ([hash](url))
        // * description (#issue) (hash)
        const changeMatch = line.match(
          /^\*\s+(?:\*\*([^*]+)\*\*:\s*)?(.+?)\s*(?:\(\[([a-f0-9]{7,40})\]\([^)]+\)\)|\(([a-f0-9]{7,40})\))/
        );
        if (changeMatch) {
          const scope = changeMatch[1] || null;
          let description = changeMatch[2].trim();
          const commitHash = changeMatch[3] || changeMatch[4];

          // Extract issue/PR references
          const issueRefs = [];
          const issuePattern = /\[#(\d+)\]\([^)]+\)/g;
          let match;
          while ((match = issuePattern.exec(description)) !== null) {
            issueRefs.push(parseInt(match[1]));
          }
          // Clean description
          description = description
            .replace(/\s*\(\[#\d+\]\([^)]+\)\)/g, "")
            .replace(/\s*\(\[[a-f0-9]+\]\([^)]+\)\)/g, "")
            .trim();

          // Deduplicate shared commits across service releases
          if (commitHash && seenCommits.has(commitHash)) continue;
          if (commitHash) seenCommits.add(commitHash);

          serviceMap[service].changes.push({
            type: currentSection,
            scope,
            description,
            commitHash,
            issues: issueRefs,
          });
        }
      }
    }
  }

  return serviceMap;
}

// ─── AkashML Analysis (DeepSeek-V3.2) ────────────────────────────────────────

async function analyzeReleasesWithAkashML(serviceMap) {
  const releaseData = Object.entries(serviceMap)
    .map(([service, data]) => {
      const serviceInfo = SERVICES[service] || {
        emoji: "📦",
        label: service,
      };
      const changes = data.changes
        .map((c) => {
          const scopeStr = c.scope ? `[${c.scope}] ` : "";
          const issueStr =
            c.issues.length > 0
              ? ` (refs: ${c.issues.map((i) => `#${i}`).join(", ")})`
              : "";
          return `  - [${c.type}] ${scopeStr}${c.description}${issueStr}`;
        })
        .join("\n");

      return `${serviceInfo.emoji} ${serviceInfo.label} (${data.versions.join(", ")})\n${changes || "  (release with shared dependency updates only)"}`;
    })
    .join("\n\n");

  const totalChanges = Object.values(serviceMap).reduce(
    (sum, s) => sum + s.changes.length,
    0
  );
  const totalReleases = Object.values(serviceMap).reduce(
    (sum, s) => sum + s.versions.length,
    0
  );

  const systemPrompt = `You are an engineering lead writing a weekly digest for the akash-network/console monorepo. This is a TypeScript/Next.js monorepo deployed on Akash Network, with services: Console Web (main deploy UI), Console API, Stats Web, Notifications, TX Signer, Provider Proxy, Provider Console, and Indexer.

Your digest should make ALL types of work visible — especially architecture, infrastructure, and reliability improvements that often go unnoticed when people only look at features.

Respond with ONLY valid JSON. No markdown fences, no extra text.`;

  const userPrompt = `Here are all releases from the past ${DAYS_BACK} days (${totalReleases} releases, ${totalChanges} unique changes):

${releaseData}

Produce a JSON digest with this exact structure:

{
  "summary": "2-3 sentences summarizing the week. Lead with the overall theme, not just features. Call out architecture/reliability/DX work explicitly. Mention which services were most active.",
  "highlights": [
    "The single most impactful change this week and why the org should care — especially if it's NOT a feature"
  ],
  "services": {
    "<service-key>": {
      "tldr": "One sentence: what changed in this service and why it matters",
      "changes": [
        {
          "description": "Human-readable description of the change",
          "type": "feature | architecture | bugfix | dx | deps | performance",
          "impact": "Why should someone who didn't write this code care? What does it enable or prevent?",
          "issues": [2726]
        }
      ]
    }
  },
  "cross_cutting": "Optional: any patterns that span multiple services (e.g. 'chain SDK upgrade touched 4 services — indicates a coordinated dependency update')",
  "tech_health_signal": "Optional: what do this week's changes say about the health of the codebase? (e.g. 'heavy bugfix week in console-api suggests the payment flow needs attention' or 'good balance of features and cleanup')"
}

Rules:
- Only include services that had releases this week
- Use the exact service keys from the data (e.g. "console-web", "console-api")
- The "impact" field should answer "so what?" — not just describe what changed
- If a change appeared in multiple services (shared dependency update), note that in cross_cutting
- Be honest. If it's a quiet week or mostly maintenance, say so. Don't inflate.
- Classify each change: "feature" (new functionality), "architecture" (refactoring, patterns), "bugfix" (fixing broken things), "dx" (CI/CD, tooling, dev workflow), "deps" (dependency updates), "performance" (speed/resource improvements)`;

  const res = await fetch("https://api.akashml.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AKASHML_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-ai/DeepSeek-V3.2",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
      top_p: 0.9,
    }),
  });

  if (!res.ok) {
    throw new Error(`AkashML API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(
      `AkashML returned unexpected response structure: ${JSON.stringify(data).slice(0, 200)}`
    );
  }
  const cleaned = text.replace(/```json\s*|```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    throw new Error(
      `Failed to parse AkashML response as JSON: ${parseErr.message}\nRaw: ${cleaned.slice(0, 500)}`
    );
  }
}

// ─── Slack Posting ───────────────────────────────────────────────────────────

async function postWebhook(payload) {
  const res = await fetch(SLACK_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Slack webhook error: ${res.status} ${await res.text()}`);
  }
}

async function slackAPI(body) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
}

async function postDigest(digest, serviceMap) {
  const useThreading = SLACK_BOT_TOKEN && SLACK_CHANNEL_ID;

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - DAYS_BACK);
  const dateRange = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  const totalReleases = Object.values(serviceMap).reduce(
    (sum, s) => sum + s.versions.length,
    0
  );
  const totalChanges = Object.values(serviceMap).reduce(
    (sum, s) => sum + s.changes.length,
    0
  );
  const activeServices = Object.keys(digest.services || {});

  const serviceSummary = activeServices
    .map((key) => {
      const info = SERVICES[key] || { emoji: "📦", label: key };
      const versions = serviceMap[key]?.versions || [];
      return `${info.emoji} ${info.label} ${versions[0] || ""}`;
    })
    .join("  │  ");

  // ── Main message ─────────────────────────────────────────────────────
  const mainBlocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📋 Console Weekly Digest — ${dateRange}`,
        emoji: true,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: digest.summary,
      },
    },
    {
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `*${totalReleases} releases* across *${activeServices.length} services* │ ${totalChanges} unique changes`,
        },
      ],
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: serviceSummary,
      },
    },
  ];

  if (digest.highlights?.length > 0) {
    mainBlocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `💡 *Worth noting:* ${digest.highlights.join(" ")}`,
        },
      }
    );
  }

  if (digest.cross_cutting) {
    mainBlocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🔗 *Cross-cutting:* ${digest.cross_cutting}`,
        },
      ],
    });
  }

  if (digest.tech_health_signal) {
    mainBlocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `🩺 *Health signal:* ${digest.tech_health_signal}`,
        },
      ],
    });
  }

  mainBlocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: useThreading
          ? `_Expand thread for per-service details_ │ <${REPO_URL}/releases|All releases>`
          : `_See follow-up messages for per-service details_ │ <${REPO_URL}/releases|All releases>`,
      },
    ],
  });

  // ── Post main message ────────────────────────────────────────────────
  let threadTs;

  if (DRY_RUN) {
    console.log("\n═══ MAIN MESSAGE ═══");
    console.log(JSON.stringify({ blocks: mainBlocks }, null, 2));
  } else if (useThreading) {
    const result = await slackAPI({
      channel: SLACK_CHANNEL_ID,
      blocks: mainBlocks,
      text: `📋 Console Weekly Digest — ${dateRange}`,
    });
    threadTs = result.ts;
  } else {
    await postWebhook({ blocks: mainBlocks });
  }

  // ── Post per-service threads ─────────────────────────────────────────
  for (const [serviceKey, serviceDigest] of Object.entries(
    digest.services || {}
  )) {
    const info = SERVICES[serviceKey] || { emoji: "📦", label: serviceKey };
    const versions = serviceMap[serviceKey]?.versions || [];
    const releaseUrls = serviceMap[serviceKey]?.releaseUrls || [];

    const changeLines = (serviceDigest.changes || [])
      .map((c) => {
        const typeEmoji = {
          feature: "🚀",
          architecture: "🏗️",
          bugfix: "🐛",
          dx: "🔧",
          deps: "📦",
          performance: "⚡",
        }[c.type] || "•";
        const issueLinks = (c.issues || [])
          .map((i) => `<${REPO_URL}/issues/${i}|#${i}>`)
          .join(" ");
        const issueStr = issueLinks ? ` ${issueLinks}` : "";
        return `${typeEmoji} *${c.description}*${issueStr}\n   _${c.impact}_`;
      })
      .join("\n\n");

    const versionStr = versions.join(" → ");
    const releaseLink =
      releaseUrls.length > 0 ? ` │ <${releaseUrls[0]}|View release>` : "";

    const threadBlocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `${info.emoji} *${info.label}* (${versionStr})${releaseLink}\n_${serviceDigest.tldr}_`,
        },
      },
    ];

    if (changeLines) {
      const MAX_BLOCK_CHARS = 3000;
      const safeChangeLines =
        changeLines.length > MAX_BLOCK_CHARS
          ? `${changeLines.slice(0, MAX_BLOCK_CHARS)}\n\n…(truncated)`
          : changeLines;
      threadBlocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: safeChangeLines,
        },
      });
    }

    if (DRY_RUN) {
      console.log(`\n═══ ${info.label.toUpperCase()} ═══`);
      console.log(JSON.stringify({ blocks: threadBlocks }, null, 2));
    } else if (useThreading) {
      await new Promise((r) => setTimeout(r, 500));
      await slackAPI({
        channel: SLACK_CHANNEL_ID,
        thread_ts: threadTs,
        blocks: threadBlocks,
        text: `${info.emoji} ${info.label} ${versionStr}`,
      });
    } else {
      await new Promise((r) => setTimeout(r, 1000));
      await postWebhook({ blocks: threadBlocks });
    }
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(
    `🔍 Fetching releases for ${REPO_OWNER}/${REPO_NAME} (last ${DAYS_BACK} days)...`
  );

  const releases = await fetchRecentReleases();
  console.log(`📦 Found ${releases.length} releases`);

  if (releases.length === 0) {
    const message = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📋 *Console Weekly Digest* — No releases this week. Enjoy the quiet! 🏖️`,
          },
        },
      ],
    };
    if (DRY_RUN) {
      console.log("\nNo releases this week.");
    } else if (SLACK_BOT_TOKEN && SLACK_CHANNEL_ID) {
      await slackAPI({
        channel: SLACK_CHANNEL_ID,
        ...message,
        text: "No releases this week.",
      });
    } else {
      await postWebhook(message);
    }
    return;
  }

  const serviceMap = parseReleases(releases);
  const serviceCount = Object.keys(serviceMap).length;
  const changeCount = Object.values(serviceMap).reduce(
    (sum, s) => sum + s.changes.length,
    0
  );
  console.log(
    `📊 Parsed ${changeCount} unique changes across ${serviceCount} services`
  );

  console.log("🤖 Analyzing releases with AkashML (DeepSeek-V3.2)...");
  const digest = await analyzeReleasesWithAkashML(serviceMap);

  console.log("📤 Posting to Slack...");
  await postDigest(digest, serviceMap);

  console.log("✅ Digest posted successfully!");
}

main().catch((err) => {
  console.error("❌ Digest failed:", err);
  process.exit(1);
});
