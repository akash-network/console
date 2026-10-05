import type { Page } from "@playwright/test";

export class TemplateDetailPage {
  constructor(readonly page: Page) {}

  /** Many template READMEs open with an h1 repeating the template name, rendered below the page's own title. */
  title(templateName: string) {
    return this.page.getByRole("heading", { level: 1, name: templateName }).first();
  }
}
