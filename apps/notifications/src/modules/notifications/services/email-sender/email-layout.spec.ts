import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";

import { type EmailAction, renderEmailLayout } from "./email-layout";

describe(renderEmailLayout.name, () => {
  it("renders a complete html document", () => {
    const { html } = setup({});
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("renders one logo that reads in both colour schemes", () => {
    const { html } = setup({});
    expect(html).toContain("https://console-cdn.akash.network/akashconsole.png");
    expect(html).not.toContain("logo-light");
    expect(html).not.toContain("logo-dark");
    expect(html).not.toContain(".svg");
  });

  it("styles the card for clients that honour the dark colour scheme", () => {
    const { html } = setup({});
    expect(html).toContain("@media (prefers-color-scheme: dark)");
    expect(html).toContain(".card { background-color: #141414");
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

  it("renders the verification code as one selectable token", () => {
    const { html } = setup({ code: "418902" });

    expect(html).toContain(">418902</span>");
    expect(html).not.toContain("418 902");
    expect(html).toContain('class="code-box"');
  });

  it("renders no code block when there is no code", () => {
    const { html } = setup({});
    expect(html).not.toContain('class="code-box"');
  });

  it("stacks the buttons full width on a narrow screen", () => {
    const { html } = setup({ actions: [{ label: "Add credits", url: "https://console.akash.network/billing" }] });

    expect(html).toContain("@media (max-width: 480px)");
    expect(html).toContain('class="btn-cell"');
  });

  it("repeats the button padding on the cell so Outlook keeps the button shape", () => {
    const { html } = setup({ actions: [{ label: "Add credits", url: "https://console.akash.network/billing" }] });

    expect(html).toContain("mso-padding-alt:12px 24px;");
    expect(html).toContain("padding:12px 24px;");
  });

  it("renders the footer", () => {
    const { html } = setup({});
    expect(html).toContain(
      `<p class="footer-text" style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">Sent by Akash Console. You're receiving this because you have an Akash Console account.</p>`
    );
  });

  it("keeps the account footer and leaves out the postal address on an email without unsubscribe links", () => {
    const { html } = setup({ postalAddress: "1 Market St, San Francisco, CA 94105" });

    expect(html).toContain("Sent by Akash Console. You're receiving this because you have an Akash Console account.");
    expect(html).not.toContain("subscribed to product updates");
    expect(html).not.toContain(">Unsubscribe</a>");
    expect(html).not.toContain("1 Market St");
  });

  describe("when the email carries unsubscribe links", () => {
    it("says why it was sent and links to the unsubscribe page in place of the account footer", () => {
      const { html } = setup({ unsubscribe: { url: "https://console.akash.network/unsubscribe?token=abc" } });

      expect(html).toContain(
        `<p class="footer-text" style="margin:0;font-size:13px;line-height:1.6;color:#71717a;">You're receiving this because you're subscribed to product updates from Akash Console. <a href="https://console.akash.network/unsubscribe?token=abc" style="color:inherit;text-decoration:underline;">Unsubscribe</a></p>`
      );
      expect(html).not.toContain("because you have an Akash Console account");
    });

    it("renders the postal address on its own line", () => {
      const { html } = setup({
        unsubscribe: { url: "https://console.akash.network/unsubscribe?token=abc" },
        postalAddress: "1 Market St, San Francisco, CA 94105"
      });

      expect(html).toContain(
        `<p class="footer-text" style="margin:8px 0 0 0;font-size:13px;line-height:1.6;color:#71717a;">1 Market St, San Francisco, CA 94105</p>`
      );
    });

    it("keeps the line breaks of a postal address configured over several lines", () => {
      const { html } = setup({
        unsubscribe: { url: "https://console.akash.network/unsubscribe?token=abc" },
        postalAddress: "14205 N Mo Pac Expy Ste 570\r\nPMB 92121\nAustin, TX, 78728-6529, US"
      });

      expect(html).toContain(">14205 N Mo Pac Expy Ste 570<br>PMB 92121<br>Austin, TX, 78728-6529, US</p>");
    });

    it("renders no postal address line when none is configured", () => {
      const { html } = setup({ unsubscribe: { url: "https://console.akash.network/unsubscribe?token=abc" } });

      expect(html).not.toContain("margin:8px 0 0 0;");
    });

    it("escapes the unsubscribe url and the postal address", () => {
      const { html } = setup({
        unsubscribe: { url: 'https://console.akash.network/unsubscribe?token=a&b="c"' },
        postalAddress: "<script>alert(1)</script>"
      });

      expect(html).toContain('href="https://console.akash.network/unsubscribe?token=a&amp;b=&quot;c&quot;"');
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;</p>");
    });
  });

  function setup(input: { subject?: string; content?: string; actions?: EmailAction[]; code?: string; unsubscribe?: { url: string }; postalAddress?: string }) {
    const html = renderEmailLayout({
      subject: input.subject ?? faker.lorem.sentence(),
      content: input.content ?? faker.lorem.paragraph(),
      actions: input.actions,
      code: input.code,
      unsubscribe: input.unsubscribe,
      postalAddress: input.postalAddress
    });
    return { html };
  }
});
