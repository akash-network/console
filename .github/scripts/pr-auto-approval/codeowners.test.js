const { describe, test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { parse } = require("./codeowners");

describe("parse", () => {
  test("anchored directory pattern matches only from the repo root", () => {
    const owners = parse("/script/ @akash-network/console");
    assert.equal(owners.isOwned("script/deploy.sh"), true);
    assert.equal(owners.isOwned("apps/api/script/deploy.sh"), false);
  });

  test("unanchored directory pattern matches at any depth", () => {
    const owners = parse("script/ @akash-network/console");
    assert.equal(owners.isOwned("script/deploy.sh"), true);
    assert.equal(owners.isOwned("apps/api/script/deploy.sh"), true);
  });

  test("unanchored file pattern matches at any depth", () => {
    const owners = parse("*.spec.ts @akash-network/console");
    assert.equal(owners.isOwned("foo.spec.ts"), true);
    assert.equal(owners.isOwned("apps/api/src/billing/billing.spec.ts"), true);
    assert.equal(owners.isOwned("apps/api/src/billing/billing.ts"), false);
  });

  test("directory pattern with trailing slash owns all nested files", () => {
    const owners = parse("/apps/api/src/billing/ @akash-network/console");
    assert.equal(owners.isOwned("apps/api/src/billing/checkout.ts"), true);
    assert.equal(owners.isOwned("apps/api/src/billing/stripe/webhook.ts"), true);
    assert.equal(owners.isOwned("apps/api/src/billing.ts"), false);
  });

  test("pattern without trailing slash matches a file exactly and a directory's contents", () => {
    const owners = parse("/config @akash-network/console");
    assert.equal(owners.isOwned("config"), true);
    assert.equal(owners.isOwned("config/network.yml"), true);
    assert.equal(owners.isOwned("config.ts"), false);
  });

  test("* does not cross directory boundaries", () => {
    const owners = parse("/apps/*/drizzle/ @akash-network/console");
    assert.equal(owners.isOwned("apps/api/drizzle/0001_init.sql"), true);
    assert.equal(owners.isOwned("apps/api/nested/drizzle/0001_init.sql"), false);
  });

  test("** crosses directory boundaries", () => {
    const owners = parse("**/Dockerfile* @akash-network/console");
    assert.equal(owners.isOwned("Dockerfile"), true);
    assert.equal(owners.isOwned("apps/api/Dockerfile"), true);
    assert.equal(owners.isOwned("apps/api/Dockerfile.dev"), true);
    assert.equal(owners.isOwned("apps/api/dockerfiles/readme.md"), false);
  });

  test("last matching pattern wins", () => {
    const content = ["*.spec.ts", "/apps/api/src/billing/critical.spec.ts @akash-network/console"].join("\n");
    const owners = parse(content);
    assert.equal(owners.isOwned("apps/api/src/billing/critical.spec.ts"), true);
    assert.equal(owners.isOwned("apps/api/src/billing/other.spec.ts"), false);
  });

  test("owner-less pattern clears ownership from earlier matches", () => {
    const content = ["/apps/ @akash-network/console", "*.spec.ts"].join("\n");
    const owners = parse(content);
    assert.equal(owners.isOwned("apps/api/src/billing/billing.spec.ts"), false);
    assert.equal(owners.isOwned("apps/api/src/billing/billing.ts"), true);
  });

  test("comments and blank lines are ignored", () => {
    const content = ["# a comment", "", "   ", "/script/ @akash-network/console"].join("\n");
    const owners = parse(content);
    assert.equal(owners.isOwned("script/deploy.sh"), true);
    assert.equal(owners.isOwned("README.md"), false);
  });
});

describe("repository CODEOWNERS policy pins", () => {
  const owners = parse(fs.readFileSync(path.join(__dirname, "../../CODEOWNERS"), "utf8"));

  test("critical business flows stay owned", () => {
    assert.equal(owners.isOwned("apps/api/src/billing/services/checkout.service.ts"), true);
    assert.equal(owners.isOwned("apps/api/src/auth/services/auth.service.ts"), true);
    assert.equal(owners.isOwned("apps/tx-signer/src/index.ts"), true);
    assert.equal(owners.isOwned("apps/deploy-web/src/lib/auth0/session.ts"), true);
    assert.equal(owners.isOwned("apps/deploy-web/src/pages/api/proxy.ts"), true);
    assert.equal(owners.isOwned("packages/database/dbSchemas/user.ts"), true);
  });

  test("migrations, runtime config, and images are owned", () => {
    assert.equal(owners.isOwned("apps/api/drizzle/0042_add_column.sql"), true);
    assert.equal(owners.isOwned("apps/deploy-web/env/.env.production"), true);
    assert.equal(owners.isOwned("apps/api/Dockerfile"), true);
  });

  test("public API surface is owned", () => {
    assert.equal(owners.isOwned("apps/api/src/routes/index.ts"), true);
    assert.equal(owners.isOwned("apps/api/src/routers/apiRouter.ts"), true);
    assert.equal(owners.isOwned("apps/api/src/deployment/routes/deployment.router.ts"), true);
    assert.equal(owners.isOwned("apps/api/swagger/openapi.json"), true);
  });

  test("ordinary source files are no longer owned", () => {
    assert.equal(owners.isOwned("apps/deploy-web/src/components/deployments/DeploymentName.tsx"), false);
    assert.equal(owners.isOwned("apps/api/src/deployment/services/deployment.service.ts"), false);
    assert.equal(owners.isOwned("packages/ui/components/button.tsx"), false);
  });

  test("test files in owned paths are un-owned", () => {
    assert.equal(owners.isOwned("apps/api/src/billing/services/checkout.service.spec.ts"), false);
    assert.equal(owners.isOwned("apps/api/src/billing/services/checkout.service.integration.ts"), false);
  });
});
