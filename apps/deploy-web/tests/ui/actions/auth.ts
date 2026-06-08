import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { AuthPage } from "../pages/AuthPage";
import { AuthPagePasswordless } from "../pages/AuthPagePasswordless";
import type { Auth0ManagementService } from "../services/auth0-management.service";
import type { EmailVerificationStrategy } from "../services/email-verification";
import { MailsacCodeVerificationStrategy } from "../services/email-verification/mailsac-code.strategy";

import { OnboardingPage } from "@tests/ui/pages/OnboardingPage";

/** Which credential mechanism a flow authenticates with. */
export type AuthType = "passwordless" | "email-password";

const DETECT_TIMEOUT_MS = 10_000;

export function generateTestPassword(): string {
  return `E2e!${crypto.randomUUID()}`;
}

/**
 * Navigates to /login and inspects the rendered UI to determine which auth
 * flow is active. Races a passwordless marker against an email/password marker
 * and returns the first to appear.
 *
 * When `preferPassword` is set, navigates to /login?auth=password so the FF-gated
 * password escape hatch (console_auth_password_escape_hatch) is selected when
 * available; the param is inert when the flag is off, so callers transparently
 * fall back to whichever UI the environment serves.
 *
 * Throws if neither marker resolves within DETECT_TIMEOUT_MS.
 * Leaves the page on /login so callers can drive the matching flow directly.
 */
export async function detectAuthType(page: Page, options: { preferPassword?: boolean } = {}): Promise<AuthType> {
  const path = options.preferPassword ? "/login?auth=password" : "/login";
  await page.goto(`${testEnvConfig.BASE_URL}${path}`);

  const passwordless = page
    .getByRole("button", { name: /continue with email/i })
    .waitFor({ state: "visible", timeout: DETECT_TIMEOUT_MS })
    .then<AuthType>(() => "passwordless");
  const emailPassword = page
    .getByLabel(/password/i)
    .first()
    .waitFor({ state: "visible", timeout: DETECT_TIMEOUT_MS })
    .then<AuthType>(() => "email-password");

  try {
    return await Promise.any([passwordless, emailPassword]);
  } catch {
    throw new Error(`detectAuthType: neither passwordless nor email-password UI appeared at /login within ${DETECT_TIMEOUT_MS / 1000}s`);
  }
}

/**
 * Logs in the preconfigured TEST_USER via whichever auth UI /login currently
 * renders, leaving the page authenticated.
 */
export async function loginExistingUser(page: Page): Promise<void> {
  const email = testEnvConfig.TEST_USER_EMAIL;
  if (!email) {
    throw new Error('TEST_USER_EMAIL env var is required for userType: "existing" tests');
  }

  const authType = await detectAuthType(page, { preferPassword: true });

  if (authType === "passwordless") {
    await signInPasswordless(page, email);
  } else {
    const password = testEnvConfig.TEST_USER_PASSWORD;
    if (!password) {
      throw new Error("TEST_USER_PASSWORD env var is required when /login renders the email-password UI");
    }
    await signInWithPassword(page, { email, password });
  }

  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 15_000 });
  await page.getByLabel("Connected wallet name and balance").waitFor({ timeout: 30_000 });
}

/**
 * Registers a brand-new user via whichever auth UI /login currently renders,
 * leaving the page on an authenticated session. Returns the created identity
 * so callers can clean it up.
 */
export async function registerNewUser(
  page: Page,
  deps: { auth0: Auth0ManagementService; emailVerification: EmailVerificationStrategy }
): Promise<{ email: string; userId: string }> {
  const authType = await detectAuthType(page, { preferPassword: true });
  const email = authType === "passwordless" ? await registerPasswordless(page) : await registerWithEmailPassword(page, deps);

  const auth0User = await deps.auth0.getUserByEmail(email);
  if (!auth0User) throw new Error(`Auth0 user was not created for ${email}`);

  return { email, userId: auth0User.user_id };
}

async function registerPasswordless(page: Page): Promise<string> {
  const otp = new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);
  const email = otp.generateEmail();
  await signInPasswordless(page, email);
  return email;
}

async function registerWithEmailPassword(page: Page, deps: { auth0: Auth0ManagementService; emailVerification: EmailVerificationStrategy }): Promise<string> {
  const email = deps.emailVerification.generateEmail();
  const auth = new AuthPage(page);

  await page.goto(`${testEnvConfig.BASE_URL}/login?tab=signup&auth=password`);

  const sinceMs = Date.now();
  const signupResponse = page.waitForResponse(response => response.url().endsWith("/api/auth/password-signup") && response.ok(), {
    timeout: 30_000
  });
  await auth.signUp({ email, password: generateTestPassword() });
  await signupResponse;

  const created = await deps.auth0.getUserByEmail(email);
  if (!created) throw new Error(`Auth0 user was not created for ${email}`);

  await new OnboardingPage(page).startFreeTrial();

  await deps.emailVerification.verify({ context: page.context(), email, userId: created.user_id, sinceMs });
  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 30_000 });

  return email;
}

/** Drives the email + password login form for the given credentials. Page is expected to be on /login. */
async function signInWithPassword(page: Page, credentials: { email: string; password: string }): Promise<void> {
  const auth = new AuthPage(page);
  await auth.signIn(credentials);
}

/** Drives the passwordless (email OTP via Mailsac) flow for the given email. Page is expected to be on /login. */
export async function signInPasswordless(page: Page, email: string): Promise<void> {
  const otp = new MailsacCodeVerificationStrategy(testEnvConfig.MAILSAC_API_KEY);
  const auth = new AuthPagePasswordless(page);

  const sinceMs = Date.now();
  await auth.startWithEmail(email);
  await auth.waitForVerifyScreen();
  await otp.verify({ context: page.context(), email, userId: "", sinceMs });
  await auth.waitForRedirectAwayFromLogin();
}
