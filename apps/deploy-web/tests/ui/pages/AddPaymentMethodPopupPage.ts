import type { FrameLocator, Locator, Page } from "@playwright/test";

/** The billing page's "Add New Payment Method" popup, which saves a card without charging it. */
export class AddPaymentMethodPopupPage {
  constructor(readonly page: Page) {}

  async open() {
    await this.page.getByRole("button", { name: "Add Payment Method" }).click();
    await this.dialog().waitFor({ state: "visible", timeout: 15_000 });
  }

  dialog(): Locator {
    return this.page.getByRole("dialog", { name: "Add New Payment Method" });
  }

  /** Leaves the address suggestions with Tab, since Escape or a click outside the popup's own frame closes it, and refills a name Stripe dropped while loading. */
  async fillAddress(input: { name: string; line1: string; city: string; state: string; zip: string }) {
    const addressFrame = this.frameUnder(/billing address/i);

    const nameInput = addressFrame.getByLabel("Full name");
    await nameInput.click({ timeout: 30_000 });
    await nameInput.pressSequentially(input.name);

    await addressFrame.getByLabel("Country or region").selectOption("United States");

    const addressInput = addressFrame.getByLabel("Address").first();
    await addressInput.click();
    await addressInput.pressSequentially(input.line1);
    await addressInput.press("Tab");

    const zipInput = addressFrame.getByLabel(/zip/i);
    await zipInput.click();
    await zipInput.pressSequentially(input.zip);

    const cityInput = addressFrame.getByLabel("City");
    await cityInput.click();
    await cityInput.pressSequentially(input.city);

    await addressFrame.getByLabel("State").selectOption(input.state);

    if ((await nameInput.inputValue()) !== input.name) {
      await nameInput.fill(input.name);
    }
  }

  /** Stripe may open the payment element on another method's tab, which shows no card fields until Card is picked. */
  async fillCard(input: { number: string; expiry: string; cvc: string }) {
    const cardFrame = this.frameUnder(/card information/i);

    const cardNumber = cardFrame.getByLabel(/card number/i);
    const cardTab = cardFrame.getByRole("tab", { name: "Card", exact: true });
    await cardNumber.or(cardTab).first().waitFor({ timeout: 30_000 });
    if (await cardTab.isVisible()) {
      await cardTab.click();
    }

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
    await this.dialog().getByRole("button", { name: "Add Card" }).click();
  }

  /** A card the billing page lists under its brand, funding and last four digits, such as "Visa credit **** 4242". */
  savedCard(cardLast4: string) {
    return this.page.getByRole("region", { name: "Payment Method" }).getByText(`**** ${cardLast4}`);
  }

  private frameUnder(heading: RegExp): FrameLocator {
    return this.dialog().getByRole("heading", { name: heading }).locator("..").locator("iframe").first().contentFrame();
  }
}
