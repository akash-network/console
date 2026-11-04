import { describe, expect, it, vi } from "vitest";

import { AI_AGENTS_DOCS_URL } from "@src/config/agent-setup.config";
import type { ApiKeyUsageTab } from "./ApiKeyUsageGuide";
import { AKT_DOCS_URL, AKT_INSTALL_GUIDE_URL, API_KEY_USAGE_SCRIPT_LINES, ApiKeyUsageGuide, getApiKeyUsageScriptLines } from "./ApiKeyUsageGuide";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const API_KEY = "ac.sk.staging.0123456789abcdef";

const COMMANDS: { tab: string; label: string; copiedTab: ApiKeyUsageTab; holdsKey: boolean }[] = [
  { tab: "Agent", label: "skill install command", copiedTab: "agent", holdsKey: false },
  { tab: "Agent", label: "API key export", copiedTab: "agent", holdsKey: true },
  { tab: "akt CLI", label: "akt install command", copiedTab: "akt", holdsKey: false },
  { tab: "akt CLI", label: "akt login commands", copiedTab: "akt", holdsKey: true },
  { tab: "akt CLI", label: "akt deploy commands", copiedTab: "akt", holdsKey: false },
  { tab: "REST API", label: "REST API script", copiedTab: "rest", holdsKey: true }
];

const KEY_COMMANDS = COMMANDS.filter(command => command.holdsKey);

describe("ApiKeyUsageGuide", () => {
  it("opens on the agent setup steps", () => {
    setup();

    expect(screen.getByRole("tab", { name: "Agent" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("skill install command")).toHaveTextContent("npx skills add akash-network/akash-skill --skill akash");
    expect(screen.getByLabelText("API key export")).toHaveTextContent('export AKASH_API_KEY="<your-api-key>"');
    expect(screen.getByRole("heading", { name: "Ask it to deploy" })).toBeInTheDocument();
    expect(screen.queryByLabelText("akt install command")).not.toBeInTheDocument();
  });

  it("links the agent setup guide in a new tab", () => {
    setup();

    expectExternalLink(screen.getByRole("link", { name: "setup guide" }), AI_AGENTS_DOCS_URL);
  });

  it("walks through installing akt, signing in and deploying", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("tab", { name: "akt CLI" }));

    expect(screen.getByLabelText("akt install command")).toHaveTextContent("brew install akash-network/tap/akt");
    expect(screen.getByLabelText("akt login commands").textContent).toBe("akt context create console --deploy-via console --set-current\nakt console login");
    expect(screen.getByText("Creates a context that deploys through Console, then asks for your key and stores it.")).toBeInTheDocument();
    expect(screen.getByLabelText("akt deploy commands").textContent).toBe("akt sdl init web > deploy.yaml\nakt deploy deploy.yaml");
    expect(screen.queryByLabelText("skill install command")).not.toBeInTheDocument();
  });

  it("links the akt installation guide and docs in new tabs", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("tab", { name: "akt CLI" }));

    expectExternalLink(screen.getByRole("link", { name: "installation guide" }), AKT_INSTALL_GUIDE_URL);
    expectExternalLink(screen.getByRole("link", { name: "akt docs" }), AKT_DOCS_URL);
  });

  it("shows the whole REST API script", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("tab", { name: "REST API" }));

    const script = screen.getByLabelText("REST API script");
    expect(script.textContent).toBe(API_KEY_USAGE_SCRIPT_LINES.join("\n"));
    expect(script).toHaveTextContent('DSEQ=$(curl -s -X POST "$API/v1/deployments"');
    expect(script).toHaveTextContent(`[ -n "$DSEQ" ] || { echo "Couldn't create the deployment" >&2; exit 1; }`);
    expect(script).toHaveTextContent('until BID=$(curl -s "$API/v1/bids?dseq=$DSEQ"');
    expect(script).toHaveTextContent('curl -s -X POST "$API/v1/leases"');
    expect(script).toHaveTextContent('curl -s -X DELETE "$API/v1/deployments/$DSEQ"');
  });

  it("sits in the Using your keys section", () => {
    setup();

    expect(within(screen.getByRole("region", { name: "Using your keys" })).getByRole("tablist")).toBeInTheDocument();
  });

  it("sits in a section with the given title", () => {
    setup({ title: "Pick how you'll use it" });

    expect(within(screen.getByRole("region", { name: "Pick how you'll use it" })).getByRole("tablist")).toBeInTheDocument();
  });

  it("fills the given key into the agent setup", () => {
    setup({ apiKey: API_KEY });

    expect(screen.getByLabelText("API key export")).toHaveTextContent(`export AKASH_API_KEY="${API_KEY}"`);
  });

  it("logs akt in with the given key instead of prompting for it", async () => {
    const { user } = setup({ apiKey: API_KEY });

    await user.click(screen.getByRole("tab", { name: "akt CLI" }));

    expect(screen.getByLabelText("akt login commands").textContent).toBe(
      `akt context create console --deploy-via console --set-current\nakt console login ${API_KEY}`
    );
    expect(screen.getByText("Creates a context that deploys through Console, then stores your key for it.")).toBeInTheDocument();
  });

  it("fills the given key into the REST API script", async () => {
    const { user } = setup({ apiKey: API_KEY });

    await user.click(screen.getByRole("tab", { name: "REST API" }));

    expect(screen.getByLabelText("REST API script").textContent).toBe(getApiKeyUsageScriptLines(API_KEY).join("\n"));
    expect(screen.getByLabelText("REST API script")).toHaveTextContent(`export AKASH_API_KEY="${API_KEY}"`);
  });

  it.each(KEY_COMMANDS)("masks the $label in session replays once it holds a key", async ({ tab, label }) => {
    const { user } = setup({ apiKey: API_KEY });

    await user.click(screen.getByRole("tab", { name: tab }));

    expect(screen.getByLabelText(label)).toHaveClass("amp-mask");
  });

  it.each(KEY_COMMANDS)("leaves the $label unmasked with the placeholder", async ({ tab, label }) => {
    const { user } = setup();

    await user.click(screen.getByRole("tab", { name: tab }));

    expect(screen.getByLabelText(label)).not.toHaveClass("amp-mask");
  });

  it.each(COMMANDS)("copies the $label when nobody listens for copies", async ({ tab, label }) => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ApiKeyUsageGuide />);

    await user.click(screen.getByRole("tab", { name: tab }));
    await user.click(screen.getByRole("button", { name: `Copy ${label}` }));

    await vi.waitFor(() => expect(writeText).toHaveBeenCalled());
  });

  it.each(COMMANDS)("reports copying the $label from the $tab tab", async ({ tab, label, copiedTab }) => {
    const { user, onCommandCopied } = setup();
    vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();

    await user.click(screen.getByRole("tab", { name: tab }));
    await user.click(screen.getByRole("button", { name: `Copy ${label}` }));

    await vi.waitFor(() => expect(onCommandCopied).toHaveBeenCalledWith(copiedTab));
  });

  function expectExternalLink(link: HTMLElement, href: string) {
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }

  function setup(input?: { title?: string; apiKey?: string }) {
    const user = userEvent.setup();
    const onCommandCopied = vi.fn();
    render(<ApiKeyUsageGuide title={input?.title} apiKey={input?.apiKey} onCommandCopied={onCommandCopied} />);
    return { user, onCommandCopied };
  }
});
