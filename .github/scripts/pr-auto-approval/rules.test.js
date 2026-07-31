const { describe, test } = require("node:test");
const assert = require("node:assert/strict");

const { evaluate } = require("./rules");

describe("evaluate", () => {
  const CODEOWNERS_FIXTURE = ["/apps/api/src/billing/ @akash-network/console", "/apps/*/drizzle/ @akash-network/console", "*.spec.ts"].join("\n");

  describe("eligibility gates", () => {
    test("skips PRs from forks", () => {
      const decision = setup({ headRepo: "someone/console" });
      assert.equal(decision.outcome, "ineligible");
      assert.match(decision.reason, /fork/);
    });

    test("skips PRs authored by bots", () => {
      const decision = setup({ authorLogin: "dependabot[bot]" });
      assert.equal(decision.outcome, "ineligible");
      assert.match(decision.reason, /bot/);
    });

    test("skips draft PRs", () => {
      const decision = setup({ isDraft: true });
      assert.equal(decision.outcome, "ineligible");
      assert.match(decision.reason, /draft/);
    });

    test("skips PRs without the experienced-contributor label", () => {
      const decision = setup({ labels: ["size: S"] });
      assert.equal(decision.outcome, "ineligible");
      assert.match(decision.reason, /experienced-contributor/);
    });

    test("skips feat PRs", () => {
      const decision = setup({ title: "feat(billing): add new payment flow" });
      assert.equal(decision.outcome, "ineligible");
      assert.match(decision.reason, /type/);
    });

    test("skips titles whose type is only a prefix of an approvable type", () => {
      const decision = setup({ title: "fixture: not a fix" });
      assert.equal(decision.outcome, "ineligible");
      assert.match(decision.reason, /type/);
    });

    for (const size of ["size: L", "size: XL"]) {
      test(`skips PRs labeled ${size}`, () => {
        const decision = setup({ labels: ["experienced-contributor", size] });
        assert.equal(decision.outcome, "ineligible");
        assert.match(decision.reason, /size/);
      });
    }

    test("skips PRs without any size label", () => {
      const decision = setup({ labels: ["experienced-contributor"] });
      assert.equal(decision.outcome, "ineligible");
      assert.match(decision.reason, /size/);
    });
  });

  describe("legacy type parity", () => {
    test("approves a test PR touching only test files", () => {
      const decision = setup({
        title: "test(api): cover wallet top-up",
        files: [file("apps/api/src/billing/wallet.spec.ts"), file("apps/api/test/seeders/wallet.seeder.ts"), file("apps/api/vitest.config.ts")]
      });
      assert.deepEqual(decision, { outcome: "approved", reason: "all changes are related to tests" });
    });

    test("accepts .test. and .e2e. suffixes and playwright config as test files", () => {
      const decision = setup({
        title: "test(deploy-web): flows",
        files: [file("apps/deploy-web/tests/e2e/deploy.e2e.ts"), file("apps/deploy-web/src/utils/date.test.ts"), file("apps/deploy-web/playwright.config.ts")]
      });
      assert.equal(decision.outcome, "approved");
    });

    test("accepts JavaScript test suffixes and repository-root test directories", () => {
      const decision = setup({
        title: "test(ci): cover auto-approval rules",
        files: [file(".github/scripts/pr-auto-approval/rules.test.js"), file("tests/helpers.js"), file("test/setup.mjs")]
      });
      assert.equal(decision.outcome, "approved");
    });

    test("skips a test PR touching non-test files", () => {
      const decision = setup({
        title: "test(api): cover wallet top-up",
        files: [file("apps/api/src/billing/wallet.spec.ts"), file("apps/api/src/routes/wallet.ts")]
      });
      assert.equal(decision.outcome, "skipped");
      assert.match(decision.reason, /non-test files/);
    });

    test("approves a docs PR touching only markdown and images", () => {
      const decision = setup({
        title: "docs: update readme",
        files: [file("README.md"), file("docs/architecture.png")]
      });
      assert.deepEqual(decision, { outcome: "approved", reason: "all changes are related to documentation" });
    });

    test("skips a docs PR touching non-documentation files", () => {
      const decision = setup({
        title: "docs: update readme",
        files: [file("README.md"), file("package.json")]
      });
      assert.equal(decision.outcome, "skipped");
      assert.match(decision.reason, /non-documentation/);
    });

    test("approves a chore that does not touch source code", () => {
      const decision = setup({
        title: "chore(deps): bump versions",
        files: [file("package.json"), file("package-lock.json")]
      });
      assert.deepEqual(decision, { outcome: "approved", reason: "chore that does not touch source code files" });
    });

    test("skips a chore touching code files under apps/ or packages/", () => {
      const decision = setup({
        title: "chore(deploy-web): tweak component",
        files: [file("apps/deploy-web/src/components/Foo.tsx")]
      });
      assert.equal(decision.outcome, "skipped");
      assert.match(decision.reason, /code files/);
    });

    test("skips a chore touching .mjs or .cjs source files", () => {
      const decision = setup({
        title: "chore(dx): tweak eslint config",
        files: [file("apps/api/eslint.config.mjs")]
      });
      assert.equal(decision.outcome, "skipped");
      assert.match(decision.reason, /code files/);
    });
  });

  describe("fix PRs", () => {
    test("approves a fix that modifies a colocated spec file", () => {
      const decision = setup({
        title: "fix(deploy-web): guard empty deployment list",
        files: [file("apps/deploy-web/src/components/DeploymentList.tsx"), file("apps/deploy-web/src/components/DeploymentList.spec.tsx")]
      });
      assert.deepEqual(decision, { outcome: "approved", reason: "bug fix within approved scope that includes test changes" });
    });

    test("counts a JavaScript test file as regression evidence", () => {
      const decision = setup({
        title: "fix(ci): correct auto-approval rule",
        files: [file(".github/scripts/pr-auto-approval/rules.js"), file(".github/scripts/pr-auto-approval/rules.test.js")]
      });
      assert.deepEqual(decision, { outcome: "approved", reason: "bug fix within approved scope that includes test changes" });
    });

    test("blocks a fix without any test changes", () => {
      const decision = setup({
        title: "fix(deploy-web): guard empty deployment list",
        files: [file("apps/deploy-web/src/components/DeploymentList.tsx")]
      });
      assert.equal(decision.outcome, "blocked");
      assert.deepEqual(
        decision.blockers.map(b => b.id),
        ["missing-regression-test"]
      );
    });

    test("blocks a fix whose only test change is a removal", () => {
      const decision = setup({
        title: "fix(deploy-web): guard empty deployment list",
        files: [
          file("apps/deploy-web/src/components/DeploymentList.tsx"),
          file("apps/deploy-web/src/components/DeploymentList.spec.tsx", { status: "removed" })
        ]
      });
      assert.equal(decision.outcome, "blocked");
      assert.deepEqual(
        decision.blockers.map(b => b.id),
        ["missing-regression-test"]
      );
    });

    test("does not count a pure rename of a test file as test evidence", () => {
      const decision = setup({
        title: "fix(deploy-web): guard empty deployment list",
        files: [
          file("apps/deploy-web/src/components/DeploymentList.tsx"),
          file("apps/deploy-web/src/components/List.spec.tsx", {
            status: "renamed",
            previous_filename: "apps/deploy-web/src/components/DeploymentList.spec.tsx",
            changes: 0
          })
        ]
      });
      assert.equal(decision.outcome, "blocked");
    });

    test("counts a rename with content changes as test evidence", () => {
      const decision = setup({
        title: "fix(deploy-web): guard empty deployment list",
        files: [
          file("apps/deploy-web/src/components/DeploymentList.tsx"),
          file("apps/deploy-web/src/components/List.spec.tsx", {
            status: "renamed",
            previous_filename: "apps/deploy-web/src/components/DeploymentList.spec.tsx",
            changes: 12
          })
        ]
      });
      assert.equal(decision.outcome, "approved");
    });
  });

  describe("refactor PRs", () => {
    test("approves a refactor without test changes", () => {
      const decision = setup({
        title: "refactor(deploy-web): extract deployment list hook",
        files: [file("apps/deploy-web/src/components/DeploymentList.tsx")]
      });
      assert.deepEqual(decision, { outcome: "approved", reason: "refactor within approved scope" });
    });
  });

  describe("code-owned paths blocker", () => {
    test("blocks any qualifying PR touching an owned path", () => {
      const decision = setup({
        title: "refactor(api): tidy billing service",
        files: [file("apps/api/src/billing/billing.service.ts")]
      });
      assert.equal(decision.outcome, "blocked");
      assert.equal(decision.blockers[0].id, "code-owned-paths");
      assert.deepEqual(decision.blockers[0].files, ["apps/api/src/billing/billing.service.ts"]);
    });

    test("blocks when a removed file is in an owned path", () => {
      const decision = setup({
        title: "refactor(api): drop old migration",
        files: [file("apps/api/drizzle/0001_init.sql", { status: "removed" })]
      });
      assert.equal(decision.outcome, "blocked");
      assert.equal(decision.blockers[0].id, "code-owned-paths");
    });

    test("blocks when a file is renamed out of an owned path", () => {
      const decision = setup({
        title: "refactor(api): move billing helper",
        files: [
          file("apps/api/src/utils/billing-helper.ts", {
            status: "renamed",
            previous_filename: "apps/api/src/billing/helper.ts",
            changes: 0
          })
        ]
      });
      assert.equal(decision.outcome, "blocked");
      assert.equal(decision.blockers[0].id, "code-owned-paths");
      assert.deepEqual(decision.blockers[0].files, ["apps/api/src/utils/billing-helper.ts"]);
    });

    test("does not block owned-path test files excluded by CODEOWNERS", () => {
      const decision = setup({
        title: "fix(api): correct rounding in billing",
        files: [file("apps/api/src/utils/rounding.ts"), file("apps/api/src/billing/rounding.spec.ts")]
      });
      assert.equal(decision.outcome, "approved");
    });

    test("caps the reported file list at 5", () => {
      const ownedFiles = Array.from({ length: 7 }, (_, i) => file(`apps/api/src/billing/file-${i}.ts`));
      const decision = setup({ title: "refactor(api): billing sweep", files: ownedFiles });
      assert.equal(decision.outcome, "blocked");
      assert.equal(decision.blockers[0].files.length, 5);
    });
  });

  describe("blocker aggregation and precedence", () => {
    test("aggregates multiple blockers", () => {
      const decision = setup({
        title: "fix(api): correct billing rounding",
        files: [file("apps/api/src/billing/rounding.ts")]
      });
      assert.equal(decision.outcome, "blocked");
      assert.deepEqual(decision.blockers.map(b => b.id).sort(), ["code-owned-paths", "missing-regression-test"]);
    });

    test("blockers take precedence over scope skips", () => {
      const decision = setup({
        title: "chore(api): reorganize billing config",
        files: [file("apps/api/src/billing/config.ts")]
      });
      assert.equal(decision.outcome, "blocked");
    });
  });

  function file(filename, overrides = {}) {
    return { filename, status: "modified", previous_filename: undefined, changes: 10, ...overrides };
  }

  function setup(overrides = {}) {
    return evaluate({
      title: "refactor(deploy-web): simplify things",
      labels: ["experienced-contributor", "size: S"],
      authorLogin: "human-dev",
      headRepo: "akash-network/console",
      baseRepo: "akash-network/console",
      isDraft: false,
      files: [{ filename: "apps/deploy-web/src/components/Foo.tsx", status: "modified", changes: 10 }],
      codeownersContent: CODEOWNERS_FIXTURE,
      ...overrides
    });
  }
});
