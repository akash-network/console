import { test } from "./fixture/base-test";
import { FrontPage } from "./pages/FrontPage";

test("can start trial", async ({ page, context }) => {
  const templateListPage = new FrontPage(context, page);
  await templateListPage.goto();

  await templateListPage.startTrial();
  await templateListPage.closeWelcomeToTrialModal();
});
