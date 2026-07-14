import type { FrameLocator, Locator, Page } from "@playwright/test";

export class AddCreditsSheetPage {
  constructor(readonly page: Page) {}

  getDialog(): Locator {
    return this.page.getByRole("dialog").filter({ has: this.page.getByText("Add credits", { exact: true }) });
  }

  async waitForOpen() {
    await this.getDialog().waitFor({ state: "visible", timeout: 15_000 });
  }

  async pickPredefinedAmount(amount: "100" | "500" | "1000") {
    await this.getDialog().getByRole("radio", { name: amount, exact: true }).click();
  }

  async fillStripeAddress(input: { name: string; line1: string; city: string; state: string; zip: string }) {
    const addressFrame = this.getAddressFrame();

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
    const cardFrame = this.getCardFrame();

    const cardNumber = cardFrame.getByLabel(/card number/i);
    await cardNumber.click();
    await cardNumber.pressSequentially(input.number);

    const expiry = cardFrame.getByLabel(/expiration/i);
    await expiry.click();
    await expiry.pressSequentially(input.expiry);

    const cvc = cardFrame.getByLabel(/security/i);
    await cvc.click();
    await cvc.pressSequentially(input.cvc);
  }

  async submit() {
    const submitButton = this.getDialog().getByRole("button", { name: /purchase credits/i });
    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.dispatchEvent("click");
  }

  private getAddressFrame(): FrameLocator {
    return this.page
      .getByRole("heading", { name: /billing address/i })
      .locator("..")
      .locator("iframe")
      .first()
      .contentFrame();
  }

  private getCardFrame(): FrameLocator {
    return this.page
      .getByRole("heading", { name: /choose a payment method/i })
      .locator("..")
      .locator("iframe")
      .first()
      .contentFrame();
  }
}
