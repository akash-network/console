const STICKY_MARKER = "<!-- pr-auto-approval-sticky -->";
const BOT_LOGIN = "github-actions[bot]";

/**
 * Maintains a single bot-owned "review blockers" comment per PR: created or
 * updated while the PR is blocked, flipped to a resolution note once approved,
 * and used to explain why a previous bot approval was dismissed.
 */
async function syncStickyComment({ github, context, core }, { prNumber, decision, dismissed }) {
  const existing = await findStickyComment({ github, context, prNumber });
  const body = buildBody({ decision, dismissed, hasExistingComment: Boolean(existing) });

  if (!body) {
    if (existing) {
      await github.rest.issues.deleteComment({
        owner: context.repo.owner,
        repo: context.repo.repo,
        comment_id: existing.id
      });
      core.info("Deleted stale sticky comment");
      return;
    }
    core.info("No sticky comment update needed");
    return;
  }

  if (!existing) {
    await github.rest.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: prNumber,
      body
    });
    core.info("Created sticky comment");
    return;
  }

  if (existing.body === body) {
    core.info("Sticky comment already up to date");
    return;
  }

  await github.rest.issues.updateComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    comment_id: existing.id,
    body
  });
  core.info("Updated sticky comment");
}

async function findStickyComment({ github, context, prNumber }) {
  const comments = await github.paginate(github.rest.issues.listComments, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: prNumber,
    per_page: 100
  });
  return comments.find(comment => comment.user?.login === BOT_LOGIN && comment.body?.startsWith(STICKY_MARKER));
}

function buildBody({ decision, dismissed, hasExistingComment }) {
  if (decision.outcome === "approved") {
    return hasExistingComment ? resolvedBody() : null;
  }
  if (decision.outcome === "blocked") {
    return blockedBody(decision.blockers, dismissed);
  }
  return dismissed ? dismissalBody(decision.reason) : null;
}

function resolvedBody() {
  return [STICKY_MARKER, "## PR auto-approval", "", "All previous blockers are resolved — this PR has been auto-approved. :white_check_mark:"].join("\n");
}

function blockedBody(blockers, dismissed) {
  const lines = [STICKY_MARKER, "## PR auto-approval blocked", ""];
  if (dismissed) {
    lines.push("The previous bot approval was dismissed because this PR no longer qualifies:", "");
  } else {
    lines.push("This PR qualifies for auto-approval but is blocked by:", "");
  }
  for (const blocker of blockers) {
    lines.push(`- **${blocker.id}**: ${blocker.message}`);
    for (const file of blocker.files) {
      lines.push(`  - ${inlineCode(file)}`);
    }
  }
  lines.push("", "A blocker is re-evaluated on every CI run; request a review from `@akash-network/console` to merge as-is.");
  return lines.join("\n");
}

/**
 * Wraps text in a markdown code span that survives backticks in the content.
 * Filenames come from attacker-controllable PR paths, which may legally contain
 * backticks/brackets/parens; a naive `${file}` span could break out and inject
 * a link into a bot-authored comment. Per CommonMark, a code span is delimited
 * by a backtick run longer than any run inside it, with one space of padding on
 * each side so the content can safely start or end with a backtick.
 */
function inlineCode(text) {
  const longestBacktickRun = (String(text).match(/`+/g) || []).reduce((max, run) => Math.max(max, run.length), 0);
  const fence = "`".repeat(longestBacktickRun + 1);
  const padding = longestBacktickRun > 0 ? " " : "";
  return `${fence}${padding}${text}${padding}${fence}`;
}

function dismissalBody(reason) {
  return [STICKY_MARKER, "## PR auto-approval", "", `The previous bot approval was dismissed because this PR no longer qualifies: ${reason}.`].join("\n");
}

module.exports = { syncStickyComment, STICKY_MARKER };
