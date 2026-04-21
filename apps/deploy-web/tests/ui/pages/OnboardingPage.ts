import type { Page } from "@playwright/test";

export class OnboardingPage {
  constructor(readonly page: Page) {}

  async waitForPage() {
    await this.page.waitForURL(/\/signup/);
  }

  async startFreeTrial() {
    await this.page.getByRole("button", { name: /start free trial/i }).click();
  }

  getEmailVerifiedAlert() {
    return this.page.getByText("Email Verified");
  }

  getCheckVerificationButton() {
    return this.page.getByRole("button", { name: /check verification/i });
  }

  getContinueButton() {
    return this.page.getByRole("button", { name: /^continue$/i });
  }

  async fillStripeAddress(input: { name: string; line1: string; city: string; state: string; zip: string }) {
    const addressFrame = this.page.getByRole("heading", { name: "Billing Address" }).locator("..").locator("iframe").first().contentFrame();

    const nameInput = addressFrame.getByLabel("Full name");
    await nameInput.click();
    await nameInput.pressSequentially(input.name);

    await addressFrame.getByLabel("Country or region").selectOption("United States");

    const addressInput = addressFrame.getByLabel("Address").first();
    await addressInput.click();
    await addressInput.pressSequentially(input.line1);
    await addressInput.press("Escape");

    const zipInput = addressFrame.getByLabel(/zip/i);
    await zipInput.click();
    await zipInput.pressSequentially(input.zip);

    const cityInput = addressFrame.getByLabel("City");
    await cityInput.click();
    await cityInput.pressSequentially(input.city);

    await addressFrame.getByLabel("State").selectOption(input.state);
  }

  async fillStripeCard(input: { number: string; expiry: string; cvc: string }) {
    const paymentFrame = this.page.getByRole("heading", { name: "Card Information" }).locator("..").locator("iframe").first().contentFrame();

    const cardNumber = paymentFrame.getByLabel(/card number/i);
    await cardNumber.click();
    await cardNumber.pressSequentially(input.number);

    const expiry = paymentFrame.getByLabel(/expiration/i);
    await expiry.click();
    await expiry.pressSequentially(input.expiry);

    const cvc = paymentFrame.getByLabel(/security/i);
    await cvc.click();
    await cvc.pressSequentially(input.cvc);
  }

  async submitPaymentMethod() {
    const button = this.getAddPaymentMethodButton();
    await button.scrollIntoViewIfNeeded();
    await button.click();
  }

  getAddPaymentMethodButton() {
    return this.page.getByRole("button", { name: /add payment method/i });
  }

  getStartTrialButton() {
    return this.page.getByRole("button", { name: /start trial/i });
  }

  getTrialActiveBadge() {
    return this.page.getByText("Trial Active");
  }

  getTrialCreditsText() {
    return this.page.getByText(/Free Trial Credits: \$/);
  }

  getWelcomeHeading() {
    return this.page.getByRole("heading", { name: /Welcome to Akash Console/i });
  }
}
