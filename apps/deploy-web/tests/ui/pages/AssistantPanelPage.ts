import type { Locator, Page } from "@playwright/test";

const PANEL_TIMEOUT_MS = 20_000;

export class AssistantPanelPage {
  constructor(private readonly page: Page) {}

  panel(): Locator {
    return this.page.locator("aside").filter({ has: this.page.getByRole("heading", { name: "Console assistant" }) });
  }

  launcher(): Locator {
    return this.page.getByRole("button", { name: "Ask the assistant" });
  }

  async isOpen(): Promise<boolean> {
    return this.panel().isVisible();
  }

  async open(): Promise<void> {
    if (await this.isOpen()) return;

    const launcher = this.launcher();
    if (await launcher.isVisible({ timeout: PANEL_TIMEOUT_MS }).catch(() => false)) {
      await launcher.click();
    } else {
      await this.press("Shift+A");
    }
    await this.panel().waitFor({ timeout: PANEL_TIMEOUT_MS });
  }

  async press(key: "Escape" | "Shift+A"): Promise<void> {
    if (key === "Shift+A") await this.page.locator("body").click({ position: { x: 5, y: 300 } });
    await this.page.keyboard.press(key);
    await this.page.waitForTimeout(500);
  }

  async agreeToConsentIfAsked(): Promise<void> {
    const agree = this.panel().getByRole("button", { name: "Agree and start" });
    const composer = this.composer();
    await agree.or(composer).first().waitFor({ timeout: PANEL_TIMEOUT_MS });
    if (await agree.isVisible()) {
      await agree.click();
      await composer.waitFor({ timeout: PANEL_TIMEOUT_MS });
    }
  }

  composer(): Locator {
    return this.panel().getByRole("textbox", { name: "Message the assistant" });
  }

  async send(message: string): Promise<void> {
    if (!(await this.isOpen())) await this.open();
    await this.agreeToConsentIfAsked();
    await this.composer().fill(message);
    await this.composer().press("Enter");
  }

  cards(): Locator {
    return this.panel().locator("section[data-tier]");
  }

  async followLastCard(choice: "primary" | "cancel"): Promise<string> {
    const card = this.cards().last();
    if (!(await card.isVisible().catch(() => false))) return "no card to follow";

    const footer = card.locator("footer");
    const target = choice === "cancel" ? footer.getByRole("button", { name: "Cancel" }) : footer.locator("a, button").last();
    const label = (await target.textContent())?.trim() ?? "";
    if (await target.isDisabled().catch(() => false)) return `"${label}" is disabled`;

    await target.click();
    await this.page.waitForTimeout(8_000);
    const status = await card
      .getByRole("status")
      .or(card.getByRole("alert"))
      .first()
      .textContent({ timeout: 2_000 })
      .catch(() => null);
    return `clicked "${label}"${status ? `, card says "${status.trim()}"` : ""}`;
  }

  async navigateInApp(url: string): Promise<void> {
    const link = this.page.locator(`a[href="${url}"]`).first();
    if (await link.isVisible().catch(() => false)) {
      await link.click();
    } else {
      await this.page.evaluate(target => window.history.pushState({}, "", target), url);
    }
    await this.page.waitForURL(`**${url}`, { timeout: PANEL_TIMEOUT_MS }).catch(() => undefined);
    await this.page.waitForTimeout(1_500);
  }

  async showsDailyLimit(): Promise<boolean> {
    return this.panel().getByText("You've reached today's message limit").isVisible();
  }

  async transcriptText(): Promise<string> {
    return (
      (await this.panel()
        .getByRole("log", { name: "Conversation" })
        .innerText()
        .catch(() => "")) ?? ""
    );
  }

  async cardTitles(): Promise<string[]> {
    return this.cards().evaluateAll(sections => sections.map(section => section.getAttribute("aria-label") ?? ""));
  }

  async chipLabels(): Promise<string[]> {
    return this.panel().getByRole("list", { name: "What the assistant read" }).locator("li").allInnerTexts();
  }

  async screenshot(file: string): Promise<void> {
    const panel = this.panel();
    if (await panel.isVisible().catch(() => false)) {
      await panel.screenshot({ path: file }).catch(() => this.page.screenshot({ path: file }));
    } else {
      await this.page.screenshot({ path: file });
    }
  }
}
