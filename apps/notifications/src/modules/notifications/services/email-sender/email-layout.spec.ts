import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { type EmailAction, renderEmailLayout } from "./email-layout";

describe(renderEmailLayout.name, () => {
  it("renders a complete html document", () => {
    const { html } = setup({});
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("renders both logo variants for light and dark mode", () => {
    const { html } = setup({});
    expect(html).toContain("https://console-cdn.akash.network/akashconsole-logo.png");
    expect(html).toContain("https://console-cdn.akash.network/akashconsole-logo-dark.png");
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).not.toContain(".svg");
  });

  it("renders the subject as the title and headline", () => {
    const subject = "Your Akash account was recharged $25.00";
    const { html } = setup({ subject });
    expect(html).toContain(`<title>${subject}</title>`);
    expect(html).toContain(`>${subject}</h1>`);
  });

  it("escapes html in the subject", () => {
    const { html } = setup({ subject: "<script>alert(1)</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("embeds the content without re-escaping it", () => {
    const content = 'Balance is <strong>$5.00</strong>. <a href="https://console.akash.network/billing">Add credits</a>.';
    const { html } = setup({ content });
    expect(html).toContain(content);
  });

  it("renders a primary button for the first action and a secondary one for the rest", () => {
    const { html } = setup({
      actions: [
        { label: "Add credits", url: "https://console.akash.network/billing?openPayment=true" },
        { label: "Enable Auto Recharge", url: "https://console.akash.network/billing" }
      ]
    });

    expect(html).toContain('href="https://console.akash.network/billing?openPayment=true"');
    expect(html).toContain(">Add credits</a>");
    expect(html).toContain('class="btn-primary"');
    expect(html).toContain('href="https://console.akash.network/billing"');
    expect(html).toContain(">Enable Auto Recharge</a>");
    expect(html).toContain('class="btn-secondary"');
  });

  it("renders no button markup when there are no actions", () => {
    const { html } = setup({});
    expect(html).not.toContain('class="btn-primary"');
    expect(html).not.toContain('class="btn-secondary"');
  });

  it("drops an action whose url is not http", () => {
    const { html } = setup({ actions: [{ label: "Add credits", url: "javascript:alert(1)" }] });
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain('class="btn-primary"');
  });

  it("escapes html in an action label", () => {
    const { html } = setup({ actions: [{ label: "<script>alert(1)</script>", url: "https://console.akash.network/billing" }] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("renders the footer", () => {
    const { html } = setup({});
    expect(html).toContain("Sent by Akash Console. You're receiving this because you have an Akash Console account.");
  });

  function setup(input: { subject?: string; content?: string; actions?: EmailAction[] }) {
    const html = renderEmailLayout({
      subject: input.subject ?? faker.lorem.sentence(),
      content: input.content ?? faker.lorem.paragraph(),
      actions: input.actions
    });
    return { html };
  }
});
