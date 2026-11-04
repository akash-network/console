import type { Locator, Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

/** Drives both onboarding pickers: the classic template page and, behind `onboarding_intent_first`, the one that asks what the user wants to do first. */
export class OnboardingPickerPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/onboarding`);
  }

  getHeading() {
    return this.page.getByRole("heading", { name: /deploy your first app|what do you want to do first/i });
  }

  /** Resolves once either picker has rendered, answering whether it is the intent-first one. */
  async isIntentFirst(): Promise<boolean> {
    await this.getHeading().waitFor({ timeout: 60_000 });
    return /what do you want to do first/i.test((await this.getHeading().textContent()) ?? "");
  }

  async deploy(template: "Hello world" | "Space Agent" | "LLM Chatbot") {
    await this.openDeployAppPath();
    const heading = this.page.getByRole("heading", { name: template, exact: true });
    const card = this.page
      .locator("div")
      .filter({ has: heading })
      .filter({ has: this.page.getByRole("button", { name: /deploy now/i }) })
      .last();

    await card.getByRole("button", { name: /deploy now/i }).click();
  }

  async skipOnboarding() {
    await this.page.getByRole("button", { name: /^(skip onboarding - explore console|skip for now)$/i }).click();
  }

  /** Follows the "Deploy image" path — bringing your own Docker image — into the configure screen. */
  async deployImage() {
    await this.openDeployAppPath();
    await this.page.getByRole("link", { name: /deploy image/i }).click();
  }

  getLlmChatbotCard(): Locator {
    const heading = this.page.getByRole("heading", { name: "LLM Chatbot", exact: true });
    return this.page
      .locator("div")
      .filter({ has: heading })
      .filter({ has: this.page.getByRole("button") })
      .last();
  }

  getLlmChatbotCta(): Locator {
    return this.getLlmChatbotCard().getByRole("button");
  }

  async clickLlmChatbotCta() {
    await this.getLlmChatbotCta().click();
  }

  private async openDeployAppPath() {
    if (!(await this.isIntentFirst())) return;

    const deployAppChoice = this.page.getByRole("button", { name: /^deploy an app/i });
    if (await deployAppChoice.isVisible()) await deployAppChoice.click();
    await this.page.getByRole("tab", { name: /deploy an app/i, selected: true }).waitFor({ timeout: 30_000 });
  }
}
