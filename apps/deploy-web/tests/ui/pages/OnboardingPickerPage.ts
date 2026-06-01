import type { Locator, Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";

export class OnboardingPickerPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto(`${testEnvConfig.BASE_URL}/onboarding`);
  }

  getHeading() {
    return this.page.getByRole("heading", { name: /deploy your first app/i });
  }

  async deploy(template: "Hello world" | "Image Generation" | "LLM Chatbot") {
    const heading = this.page.getByRole("heading", { name: template, exact: true });
    const card = this.page
      .locator("div")
      .filter({ has: heading })
      .filter({ has: this.page.getByRole("button", { name: /deploy now/i }) })
      .last();

    await card.getByRole("button", { name: /deploy now/i }).click();
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
}
