import { describe, expect, it } from "vitest";

import { AI_AGENTS_DOCS_URL } from "@src/config/agent-setup.config";
import { AKT_DOCS_URL, AKT_INSTALL_GUIDE_URL, API_KEY_USAGE_SCRIPT_LINES, ApiKeyUsageGuide } from "./ApiKeyUsageGuide";

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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
    expect(screen.getByLabelText("akt deploy commands").textContent).toBe("akt sdl init web > deploy.yaml\nakt deploy deploy.yaml --deposit 5");
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

  function expectExternalLink(link: HTMLElement, href: string) {
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  }

  function setup() {
    const user = userEvent.setup();
    render(<ApiKeyUsageGuide />);
    return { user };
  }
});
