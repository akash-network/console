import { describe, expect, it } from "vitest";

import { SDL_MAX_LENGTH } from "@src/deployment/config/sdl.config";
import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import type { PublishCheck, PublishCheckKey } from "./publish-check-results";
import { type PublishCheckInput, runPublishChecks } from "./publish-checks";

const RAN_AT = new Date("2026-11-18T10:00:00.000Z");

describe(runPublishChecks.name, () => {
  it("passes every check on a pinned image with no secret and an ordinary name, in a fixed order", () => {
    const results = setup({ sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["PORT=8080", "MODEL=meta-llama/Llama-3.1-8B-Instruct"] } }) });

    expect(results).toEqual({
      ranAt: "2026-11-18T10:00:00.000Z",
      checks: [
        { key: "sdl_valid", status: "passed", issues: [] },
        { key: "no_secrets", status: "passed", issues: [] },
        { key: "images_allowed", status: "passed", issues: [] },
        { key: "fixed_tags", status: "passed", issues: [] },
        { key: "name_not_reserved", status: "passed", issues: [] }
      ]
    });
  });

  describe("sdl_valid", () => {
    it("fails with every issue the SDL validation found", () => {
      const results = setup({ sdlIssues: ["The SDL defines no services", "must have required property 'profiles'"] });

      expect(checkOf(results, "sdl_valid")).toEqual({
        key: "sdl_valid",
        status: "failed",
        issues: [{ message: "The SDL defines no services" }, { message: "must have required property 'profiles'" }]
      });
    });

    it("fails an SDL over the size limit and says what the limit is", () => {
      const results = setup({ sdl: `${buildSdl({ web: { image: "nginx:1.27.2" } })}\n#${"x".repeat(SDL_MAX_LENGTH)}` });

      expect(checkOf(results, "sdl_valid").issues).toEqual([{ message: "The SDL is larger than 128 KB. Shorten it before making the template public." }]);
    });

    it("passes an SDL exactly at the size limit", () => {
      const sdl = buildSdl({ web: { image: "nginx:1.27.2" } });
      const results = setup({ sdl: `${sdl}\n#${"x".repeat(SDL_MAX_LENGTH - sdl.length - 2)}` });

      expect(checkOf(results, "sdl_valid").status).toBe("passed");
    });
  });

  describe("no_secrets", () => {
    it("names the service and the variable of an env value in a provider key format, without repeating the value", () => {
      const results = setup({ sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["HUB=hf_abcdefghijklmnopqrstuv", "PORT=8080"] } }) });

      expect(checkOf(results, "no_secrets")).toEqual({
        key: "no_secrets",
        status: "failed",
        issues: [
          {
            message:
              "web.env.HUB holds a key or token in a format providers issue. Remove the value, or ask the deployer for it as a secret so nobody deploys with yours.",
            service: "web",
            variable: "HUB"
          }
        ]
      });
    });

    it("names a value kept under a credential's name", () => {
      const results = setup({ sdl: buildSdl({ db: { image: "postgres:17.0", env: ["POSTGRES_PASSWORD=postgres"] } }) });

      expect(checkOf(results, "no_secrets").issues).toEqual([
        {
          message:
            "db.env.POSTGRES_PASSWORD is named like a key, token or password and holds a value. Remove the value, or ask the deployer for it as a secret so nobody deploys with yours.",
          service: "db",
          variable: "POSTGRES_PASSWORD"
        }
      ]);
    });

    it("names a long random string under an ordinary name", () => {
      const results = setup({ sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["EXTRA=q7Rk2ZpX9vLm4TnB8sWd3YhC6"] } }) });

      expect(checkOf(results, "no_secrets").issues).toEqual([
        {
          message:
            "web.env.EXTRA holds a long random string that reads like a key or token. Remove the value, or ask the deployer for it as a secret so nobody deploys with yours.",
          service: "web",
          variable: "EXTRA"
        }
      ]);
    });

    it("names a credential an env value sets under its own name", () => {
      const results = setup({ sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["EXTRA_ARGS=--api-key=hunter2abc --max_tokens=512"] } }) });

      expect(checkOf(results, "no_secrets").issues).toEqual([
        {
          message:
            "web.env.EXTRA_ARGS sets a value under a name that reads like a key, token or password. Remove the value, or ask the deployer for it as a secret so nobody deploys with yours.",
          service: "web",
          variable: "EXTRA_ARGS"
        }
      ]);
    });

    it("passes arguments and prompts that only mention tokens", () => {
      const results = setup({
        sdl: buildSdl({
          web: {
            image: "nginx:1.27.2",
            env: ["EXTRA_ARGS=--max_tokens=512 --temperature=0.7", "SYSTEM_PROMPT=you are now using the fast model with some safe default values"]
          }
        })
      });

      expect(checkOf(results, "no_secrets")).toEqual({ key: "no_secrets", status: "passed", issues: [] });
    });

    it("names the line of a provider key left in an SDL comment or argument, without repeating the key", () => {
      const sdl = [
        'version: "2.0"',
        "services:",
        "  web:",
        "    image: nginx:1.27.2",
        "    # old token: hf_abcdefghijklmnopqrstuv",
        "    args:",
        "      - --hub-token",
        "      - hf_zyxwvutsrqponmlkjihgfe"
      ].join("\r\n");

      const results = setup({ sdl });

      const lineIssue = (line: number) => ({
        message: `Line ${line} of the SDL holds a key or token in a format providers issue. Remove it before the template is public; anyone could read and use it.`,
        field: "sdl"
      });
      expect(checkOf(results, "no_secrets")).toEqual({ key: "no_secrets", status: "failed", issues: [lineIssue(5), lineIssue(8)] });
    });

    it("reports a provider key in an env value once, under its variable", () => {
      const sdl = ['version: "2.0"', "services:", "  web:", "    image: nginx:1.27.2", "    env:", "      - HUB=hf_abcdefghijklmnopqrstuv"].join("\n");

      const results = setup({ sdl });

      expect(checkOf(results, "no_secrets").issues).toEqual([expect.objectContaining({ service: "web", variable: "HUB" })]);
    });

    it("still names a provider key in a comment that shares its line with an ordinary env value", () => {
      const sdl = ['version: "2.0"', "services:", "  web:", "    image: nginx:1.27.2", "    env:", "      - MODE=fast # hf_abcdefghijklmnopqrstuv"].join("\n");

      const results = setup({ sdl });

      expect(checkOf(results, "no_secrets").issues).toEqual([expect.objectContaining({ field: "sdl", message: expect.stringContaining("Line 6 of the SDL") })]);
    });

    it("still names a second provider key that shares its line with one reported under its variable", () => {
      const sdl = [
        'version: "2.0"',
        "services:",
        "  web:",
        "    image: nginx:1.27.2",
        "    env:",
        "      - HUB=hf_abcdefghijklmnopqrstuv # backup hf_zyxwvutsrqponmlkjihgfe"
      ].join("\n");

      const results = setup({ sdl });

      expect(checkOf(results, "no_secrets").issues).toEqual([
        expect.objectContaining({ service: "web", variable: "HUB" }),
        expect.objectContaining({ field: "sdl", message: expect.stringContaining("Line 6 of the SDL") })
      ]);
    });

    it("reports a provider key written after a placeholder word under its variable", () => {
      const results = setup({ sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["NOTE=your-token hf_abcdefghijklmnopqrstuv"] } }) });

      expect(checkOf(results, "no_secrets").issues).toEqual([expect.objectContaining({ service: "web", variable: "NOTE" })]);
    });

    it("names the first line of a private key block and of a mnemonic that span lines of the README, once each", () => {
      const readme = [
        "# Chat",
        "-----BEGIN PRIVATE KEY-----",
        "MIIEvQIBADANBgkqhkiG9w0BAQEFAASC",
        "-----END PRIVATE KEY-----",
        "",
        "abandon ability able about above absent",
        "absorb abstract absurd abuse access accident"
      ].join("\n");

      const results = setup({ readme });

      expect(checkOf(results, "no_secrets").issues.map(({ message, field }) => ({ line: message.match(/^Line (\d+) /)?.[1], field }))).toEqual([
        { line: "2", field: "readme" },
        { line: "6", field: "readme" }
      ]);
    });

    it("lists the lines in the order they are written, whichever format each one holds", () => {
      const readme = ["Hub token hf_abcdefghijklmnopqrstuv", "", "API key sk-abcdefghijklmnop1234", "", "-----BEGIN PRIVATE KEY-----"].join("\n");

      const results = setup({ readme });

      expect(checkOf(results, "no_secrets").issues.map(({ message }) => message.match(/^Line (\d+) /)?.[1])).toEqual(["1", "3", "5"]);
    });

    it("names at most twenty lines of a text that holds more keys than that", () => {
      const readme = Array.from({ length: 25 }, () => "token hf_abcdefghijklmnopqrstuv").join("\n\n");

      const results = setup({ readme });

      expect(checkOf(results, "no_secrets").issues.map(({ message }) => message.match(/^Line (\d+) /)?.[1])).toEqual(
        Array.from({ length: 20 }, (_, index) => String(index * 2 + 1))
      );
    });

    it("names the right line for keys that share one and for a key on the last line", () => {
      const readme = ["one hf_abcdefghijklmnopqrstuv two hf_zyxwvutsrqponmlkjihgfe", "", "plain", "last sk-abcdefghijklmnop1234"].join("\n");

      const results = setup({ readme });

      expect(checkOf(results, "no_secrets").issues.map(({ message }) => message.match(/^Line (\d+) /)?.[1])).toEqual(["1", "4"]);
    });

    it("names the line of a private key header left without the rest of its block", () => {
      const results = setup({ readme: "# Chat\n\n-----BEGIN RSA PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC" });

      expect(checkOf(results, "no_secrets").issues).toEqual([
        expect.objectContaining({ field: "readme", message: expect.stringContaining("Line 3 of the README") })
      ]);
    });

    it("names the line of a provider key or a mnemonic in the README, without repeating it", () => {
      const readme = [
        "# Chat",
        "",
        "Run it with hf_abcdefghijklmnopqrstuv as the hub token.",
        "",
        "abandon ability able about above absent absorb abstract absurd abuse access accident"
      ].join("\n");

      const results = setup({ readme });

      const lineIssue = (line: number) => ({
        message: `Line ${line} of the README holds a key or token in a format providers issue. Remove it before the template is public; anyone could read and use it.`,
        field: "readme"
      });
      expect(checkOf(results, "no_secrets")).toEqual({ key: "no_secrets", status: "failed", issues: [lineIssue(3), lineIssue(5)] });
    });

    it("passes a README that explains tokens without holding one", () => {
      const readme = "# Chat\n\nSet HF_TOKEN to your own token. Requests need a Bearer token; max_tokens=512 by default.";

      const results = setup({ readme });

      expect(checkOf(results, "no_secrets")).toEqual({ key: "no_secrets", status: "passed", issues: [] });
    });

    it("reads an env written as a mapping too", () => {
      const results = setup({ sdl: buildSdl({ web: { image: "nginx:1.27.2", env: { API_TOKEN: "abc123" } } }) });

      expect(checkOf(results, "no_secrets").issues).toEqual([expect.objectContaining({ service: "web", variable: "API_TOKEN" })]);
    });

    it("passes a secret the deployer is asked for, whose value is not saved", () => {
      const results = setup({
        sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["HF_TOKEN=ac-secret://HF_TOKEN"] }, worker: { image: "nginx:1.27.2", env: ["HF_TOKEN="] } }),
        askedValues: [
          secretAskedValue({
            key: "HF_TOKEN",
            bindings: [
              { service: "web", env: "HF_TOKEN" },
              { service: "worker", env: "HF_TOKEN" }
            ]
          })
        ]
      });

      expect(checkOf(results, "no_secrets")).toEqual({ key: "no_secrets", status: "passed", issues: [] });
    });

    it("still names a provider key that an ordinary env value happens to be part of", () => {
      const sdl = [
        'version: "2.0"',
        "services:",
        "  web:",
        "    image: nginx:1.27.2",
        "    env:",
        "      - MODE=abcdefghij",
        "# hf_abcdefghijklmnopqrstuv"
      ].join("\n");

      const results = setup({ sdl });

      expect(checkOf(results, "no_secrets").issues).toEqual([expect.objectContaining({ field: "sdl", message: expect.stringContaining("Line 7 of the SDL") })]);
    });

    it("passes a secret reference whose name reads like a provider key", () => {
      const results = setup({
        sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["HUB=ac-secret://hf_abcdefghijklmnopqrstuv"] } }),
        askedValues: [secretAskedValue({ key: "hf_abcdefghijklmnopqrstuv", bindings: [{ service: "web", env: "HUB" }] })]
      });

      expect(checkOf(results, "no_secrets")).toEqual({ key: "no_secrets", status: "passed", issues: [] });
    });

    it("still names a provider key in a comment that shares its line with a secret reference", () => {
      const sdl = [
        'version: "2.0"',
        "services:",
        "  web:",
        "    image: nginx:1.27.2",
        "    env:",
        "      - HUB=ac-secret://hf_abcdefghijklmnopqrstuv # hf_zyxwvutsrqponmlkjihgfe"
      ].join("\n");

      const results = setup({ sdl, askedValues: [secretAskedValue({ key: "hf_abcdefghijklmnopqrstuv", bindings: [{ service: "web", env: "HUB" }] })] });

      expect(checkOf(results, "no_secrets").issues).toEqual([expect.objectContaining({ field: "sdl", message: expect.stringContaining("Line 6 of the SDL") })]);
    });

    it("reports a secret's saved value once, through the scan every save runs", () => {
      const results = setup({
        sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["HF_TOKEN=hf_abcdefghijklmnopqrstuv"] } }),
        askedValues: [secretAskedValue({ key: "HF_TOKEN", bindings: [{ service: "web", env: "HF_TOKEN" }] })]
      });

      expect(checkOf(results, "no_secrets").issues).toEqual([{ message: 'Variable "HF_TOKEN" is a secret, so web.env.HF_TOKEN must not carry a value' }]);
    });

    it("still scans the same variable of a service the secret is not bound to", () => {
      const results = setup({
        sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["HF_TOKEN="] }, worker: { image: "nginx:1.27.2", env: ["HF_TOKEN=abc123"] } }),
        askedValues: [secretAskedValue({ key: "HF_TOKEN", bindings: [{ service: "web", env: "HF_TOKEN" }] })]
      });

      expect(checkOf(results, "no_secrets").issues).toEqual([expect.objectContaining({ service: "worker", variable: "HF_TOKEN" })]);
    });

    it("fails a registry password kept in the SDL", () => {
      const results = setup({
        sdl: buildSdl({ web: { image: "nginx:1.27.2", credentials: { host: "ghcr.io", username: "me", password: "hunter2" } } })
      });

      expect(checkOf(results, "no_secrets").issues).toEqual([{ message: 'Service "web" carries a registry password; save it as a secret instead' }]);
    });

    it("names the variable whose default reads like a credential", () => {
      const results = setup({
        sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["WANDB="] } }),
        askedValues: [textAskedValue({ key: "WANDB", default: "sk-abcdefghijklmnop1234" })]
      });

      expect(checkOf(results, "no_secrets").issues).toEqual([
        {
          message: 'The default of variable "WANDB" holds a key or token in a format providers issue. Clear the default, or make the variable a secret.',
          variable: "WANDB"
        }
      ]);
    });

    it("reads a default under its variable's name", () => {
      const results = setup({
        sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["ADMIN_PASSWORD="] } }),
        askedValues: [textAskedValue({ key: "ADMIN_PASSWORD", default: "hunter2" })]
      });

      expect(checkOf(results, "no_secrets").issues).toEqual([
        {
          message:
            'The default of variable "ADMIN_PASSWORD" is named like a key, token or password and holds a value. Clear the default, or make the variable a secret.',
          variable: "ADMIN_PASSWORD"
        }
      ]);
    });

    it("passes ordinary defaults and variables asked without one", () => {
      const results = setup({
        sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["MODEL=", "API_TOKEN="] } }),
        askedValues: [textAskedValue({ key: "MODEL", default: "llama3.1" }), textAskedValue({ key: "API_TOKEN" })]
      });

      expect(checkOf(results, "no_secrets").status).toBe("passed");
    });

    it("fails a stored secret that still carries a default", () => {
      const stored = { ...secretAskedValue({ key: "HF_TOKEN", bindings: [{ service: "web", env: "HF_TOKEN" }] }), default: "abc" } as AskedValue;
      const results = setup({ sdl: buildSdl({ web: { image: "nginx:1.27.2", env: ["HF_TOKEN="] } }), askedValues: [stored] });

      expect(checkOf(results, "no_secrets").issues).toEqual([
        { message: 'Variable "HF_TOKEN" is a secret, so it must not carry a default. Clear the default.', variable: "HF_TOKEN" }
      ]);
    });
  });

  describe("images_allowed", () => {
    it("names the service and the image of a known miner", () => {
      const results = setup({ sdl: buildSdl({ web: { image: "nginx:1.27.2" }, worker: { image: "acme/xmrig:6.21.0" } }) });

      expect(checkOf(results, "images_allowed")).toEqual({
        key: "images_allowed",
        status: "failed",
        issues: [
          {
            message: 'Service "worker" runs acme/xmrig:6.21.0, which is a cryptocurrency miner. Public templates can\'t use it; change the image.',
            service: "worker",
            image: "acme/xmrig:6.21.0"
          }
        ]
      });
    });

    it("names a bandwidth-sharing image for what it is", () => {
      const results = setup({ sdl: buildSdl({ web: { image: "honeygain/honeygain:1.0" } }) });

      expect(checkOf(results, "images_allowed").issues).toEqual([
        expect.objectContaining({ message: expect.stringContaining("which is a bandwidth-sharing proxy"), service: "web" })
      ]);
    });
  });

  describe("fixed_tags", () => {
    it("fails an image tagged latest and suggests a version tag", () => {
      const results = setup({ sdl: buildSdl({ webui: { image: "ghcr.io/open-webui/open-webui:latest" } }) });

      expect(checkOf(results, "fixed_tags")).toEqual({
        key: "fixed_tags",
        status: "failed",
        issues: [
          {
            message:
              'Service "webui" uses ghcr.io/open-webui/open-webui:latest, and the latest tag changes whenever the image is rebuilt. Pick a version tag such as open-webui/open-webui:1.2.3, or a digest, so the image can\'t change after the template is public.',
            service: "webui",
            image: "ghcr.io/open-webui/open-webui:latest"
          }
        ]
      });
    });

    it("fails an image with no tag", () => {
      const results = setup({ sdl: buildSdl({ web: { image: " nginx " } }) });

      expect(checkOf(results, "fixed_tags").issues).toEqual([
        {
          message:
            'Service "web" uses nginx without a tag, which means latest. Pick a version tag such as nginx:1.2.3, or a digest, so the image can\'t change after the template is public.',
          service: "web",
          image: "nginx"
        }
      ]);
    });

    it("passes a digest reference and reports each floating service on its own", () => {
      const results = setup({
        sdl: buildSdl({ pinned: { image: "nginx@sha256:0123456789abcdef" }, a: { image: "redis" }, b: { image: "redis:latest" } })
      });

      expect(checkOf(results, "fixed_tags").issues.map(issue => issue.service)).toEqual(["a", "b"]);
    });

    it.each([
      { shape: "unparseable YAML", sdl: "services: [" },
      { shape: "a document that is not a mapping", sdl: "- nginx" },
      { shape: "no services mapping", sdl: "services: nginx" },
      { shape: "a service that is not a mapping", sdl: "services:\n  web: nginx" },
      { shape: "an image that is not text", sdl: "services:\n  web:\n    image: 42" },
      { shape: "a blank image", sdl: 'services:\n  web:\n    image: "  "' }
    ])("finds no image to check in $shape", ({ sdl }) => {
      const results = setup({ sdl });

      expect(checkOf(results, "fixed_tags").issues).toEqual([]);
      expect(checkOf(results, "images_allowed").issues).toEqual([]);
    });
  });

  describe("name_not_reserved", () => {
    it("fails a title for each reserved word it uses", () => {
      const results = setup({ title: "Official Akash Llama" });

      expect(checkOf(results, "name_not_reserved")).toEqual({
        key: "name_not_reserved",
        status: "failed",
        issues: [
          { message: 'Titles can\'t contain "Akash", which is reserved for Akash. Rename the template.', field: "title" },
          { message: 'Titles can\'t contain "Official", which is reserved for Akash. Rename the template.', field: "title" }
        ]
      });
    });

    it("fails a publisher name that uses a reserved word", () => {
      const results = setup({ publisherName: "Akash Fans" });

      expect(checkOf(results, "name_not_reserved").issues).toEqual([
        {
          message:
            'Templates are published under your organization\'s name, and "Akash Fans" contains "Akash", which is reserved for Akash. Rename the organization, or your username for a personal account.',
          field: "publisher_name"
        }
      ]);
    });

    it("passes a template that has no publisher to name", () => {
      const results = setup({ publisherName: null });

      expect(checkOf(results, "name_not_reserved").status).toBe("passed");
    });
  });

  function checkOf(results: ReturnType<typeof runPublishChecks>, key: PublishCheckKey): PublishCheck {
    return results.checks.find(check => check.key === key)!;
  }

  function secretAskedValue(input: { key: string; bindings: { service: string; env: string }[] }): AskedValue {
    return { type: "secret", label: input.key, required: true, ...input };
  }

  function textAskedValue(input: { key: string; default?: string }): AskedValue {
    return { type: "text", label: input.key, required: false, bindings: [{ service: "web", env: input.key }], ...input };
  }

  function buildSdl(services: Record<string, { image: unknown; env?: string[] | Record<string, string>; credentials?: Record<string, string> }>): string {
    return JSON.stringify({ version: "2.0", services });
  }

  function setup(input: Partial<PublishCheckInput> = {}) {
    return runPublishChecks({
      sdl: buildSdl({ web: { image: "nginx:1.27.2" } }),
      readme: null,
      askedValues: [],
      title: "Llama 3.1 Chat",
      publisherName: "Sam Rivera",
      sdlIssues: [],
      ranAt: RAN_AT,
      ...input
    });
  }
});
