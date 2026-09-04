const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const { syncStickyComment, STICKY_MARKER } = require("./sticky-comment");

describe("syncStickyComment", () => {
  const BLOCKED_DECISION = {
    outcome: "blocked",
    blockers: [
      {
        id: "code-owned-paths",
        message: "These files are on code-owned paths and require @akash-network/console review",
        files: ["apps/api/src/billing/checkout.ts"]
      }
    ]
  };

  test("creates a comment when blocked and no sticky comment exists", async () => {
    const { calls, sync } = setup({ comments: [] });

    await sync({ decision: BLOCKED_DECISION, dismissed: false });

    assert.equal(calls.created.length, 1);
    assert.ok(calls.created[0].body.startsWith(STICKY_MARKER));
    assert.match(calls.created[0].body, /code-owned paths/);
    assert.match(calls.created[0].body, /apps\/api\/src\/billing\/checkout\.ts/);
  });

  test("updates the existing comment when blocked and the body differs", async () => {
    const { calls, sync } = setup({
      comments: [stickyComment(42, `${STICKY_MARKER}\nold body`)]
    });

    await sync({ decision: BLOCKED_DECISION, dismissed: false });

    assert.equal(calls.created.length, 0);
    assert.equal(calls.updated.length, 1);
    assert.equal(calls.updated[0].comment_id, 42);
    assert.match(calls.updated[0].body, /code-owned paths/);
  });

  test("does nothing when blocked and the existing comment is already up to date", async () => {
    const body = await setup({ comments: [] }).buildBody({ decision: BLOCKED_DECISION, dismissed: false });
    const { calls, sync } = setup({ comments: [stickyComment(42, body)] });

    await sync({ decision: BLOCKED_DECISION, dismissed: false });

    assert.equal(calls.created.length, 0);
    assert.equal(calls.updated.length, 0);
  });

  test("resolves the comment when approved after being blocked", async () => {
    const { calls, sync } = setup({
      comments: [stickyComment(42, `${STICKY_MARKER}\nblockers...`)]
    });

    await sync({ decision: { outcome: "approved", reason: "refactor within approved scope" }, dismissed: false });

    assert.equal(calls.updated.length, 1);
    assert.match(calls.updated[0].body, /resolved/);
    assert.match(calls.updated[0].body, /auto-approved/);
  });

  test("stays silent when approved with no prior comment", async () => {
    const { calls, sync } = setup({ comments: [] });

    await sync({ decision: { outcome: "approved", reason: "refactor within approved scope" }, dismissed: false });

    assert.equal(calls.created.length, 0);
    assert.equal(calls.updated.length, 0);
  });

  test("stays silent when ineligible without a dismissed approval", async () => {
    const { calls, sync } = setup({ comments: [] });

    await sync({ decision: { outcome: "ineligible", reason: "missing required size label (XS, S, or M)" }, dismissed: false });

    assert.equal(calls.created.length, 0);
    assert.equal(calls.updated.length, 0);
  });

  test("explains the dismissal when a non-approved outcome dismissed a prior approval", async () => {
    const { calls, sync } = setup({ comments: [] });

    await sync({ decision: { outcome: "ineligible", reason: "missing required size label (XS, S, or M)" }, dismissed: true });

    assert.equal(calls.created.length, 1);
    assert.match(calls.created[0].body, /dismissed/);
    assert.match(calls.created[0].body, /missing required size label/);
  });

  test("mentions the dismissal in the blocked comment when an approval was dismissed", async () => {
    const { calls, sync } = setup({ comments: [] });

    await sync({ decision: BLOCKED_DECISION, dismissed: true });

    assert.equal(calls.created.length, 1);
    assert.match(calls.created[0].body, /dismissed/);
    assert.match(calls.created[0].body, /code-owned paths/);
  });

  test("escapes filenames so a crafted path cannot break out of the code span", async () => {
    const { calls, sync } = setup({ comments: [] });
    const maliciousFile = "apps/api/src/billing/a`[click](http://evil.com)`b.ts";

    await sync({
      decision: {
        outcome: "blocked",
        blockers: [{ id: "code-owned-paths", message: "owned", files: [maliciousFile] }]
      },
      dismissed: false
    });

    const body = calls.created[0].body;
    assert.ok(body.includes(`  - \`\` ${maliciousFile} \`\``), "filename should be wrapped in a padded double-backtick code span");
    assert.ok(!body.includes(`  - \`${maliciousFile}\``), "must not use the naive single-backtick span the payload can break out of");
  });

  test("deletes a stale blocked comment when the PR is no longer blocked or dismissed", async () => {
    const { calls, sync } = setup({
      comments: [stickyComment(42, `${STICKY_MARKER}\nblocked by code-owned-paths`)]
    });

    await sync({ decision: { outcome: "skipped", reason: "PR changes non-test files" }, dismissed: false });

    assert.equal(calls.deleted.length, 1);
    assert.equal(calls.deleted[0].comment_id, 42);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.updated.length, 0);
  });

  test("stays silent when skipped with no prior comment", async () => {
    const { calls, sync } = setup({ comments: [] });

    await sync({ decision: { outcome: "skipped", reason: "PR changes non-test files" }, dismissed: false });

    assert.equal(calls.deleted.length, 0);
    assert.equal(calls.created.length, 0);
    assert.equal(calls.updated.length, 0);
  });

  test("ignores marker-less and non-bot comments when locating the sticky comment", async () => {
    const { calls, sync } = setup({
      comments: [
        { id: 1, body: "regular human comment", user: { login: "human-dev" } },
        { id: 2, body: `${STICKY_MARKER}\nspoofed`, user: { login: "human-dev" } }
      ]
    });

    await sync({ decision: BLOCKED_DECISION, dismissed: false });

    assert.equal(calls.updated.length, 0);
    assert.equal(calls.created.length, 1);
  });

  function stickyComment(id, body) {
    return { id, body, user: { login: "github-actions[bot]" } };
  }

  function setup(input) {
    const calls = { created: [], updated: [], deleted: [] };
    const github = {
      paginate: async (fn, params) => fn(params),
      rest: {
        issues: {
          listComments: async () => input.comments,
          createComment: async params => {
            calls.created.push(params);
          },
          updateComment: async params => {
            calls.updated.push(params);
          },
          deleteComment: async params => {
            calls.deleted.push(params);
          }
        }
      }
    };
    const context = { repo: { owner: "akash-network", repo: "console" } };
    const core = { info: () => {} };
    const sync = args => syncStickyComment({ github, context, core }, { prNumber: 123, ...args });
    const buildBody = args => {
      let captured;
      const capturingGithub = {
        ...github,
        rest: {
          issues: {
            ...github.rest.issues,
            createComment: async params => {
              captured = params.body;
            }
          }
        }
      };
      return syncStickyComment({ github: capturingGithub, context, core }, { prNumber: 123, ...args }).then(() => captured);
    };
    return { calls, sync, buildBody };
  }
});
