import type { Page } from "@playwright/test";

import { testEnvConfig } from "../fixture/test-env.config";
import { AppNav } from "../pages/AppNav";
import { AuthPage } from "../pages/AuthPage";
import { AuthPagePasswordless } from "../pages/AuthPagePasswordless";
import type { Auth0ManagementService } from "../services/auth0-management.service";
import type { EmailVerificationStrategy } from "../services/email-verification";
import { createEmailVerificationStrategy } from "../services/email-verification";

/** Which credential mechanism a flow authenticates with. */
export type AuthType = "passwordless" | "email-password";

const DETECT_TIMEOUT_MS = 30_000;

/**
 * Leaving /login waits on a Turnstile solve, the app's auth API route and Auth0 in sequence, which on beta regularly
 * outruns the 15s actionTimeout: 8 of 27 tests in the 2026-08-25 run retried on this gate alone, and the global
 * teardown failed its escrow sweep with it, leaving deployments draining.
 */
const SIGN_IN_TIMEOUT_MS = 45_000;

export function generateTestPassword(): string {
  return `E2e!${crypto.randomUUID()}`;
}

/**
 * Navigates to /login and inspects the rendered UI to determine which auth
 * flow is active. Races a passwordless marker against an email/password marker
 * and returns the first to appear.
 *
 * When `preferPassword` is set, navigates to /login?auth=password so the password
 * escape hatch is selected; without it the environment serves passwordless auth by default.
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
  const password = testEnvConfig.TEST_USER_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD are required for userType: "existing" tests — the existing user logs in with email + password');
  }

  await page.goto(`${testEnvConfig.BASE_URL}/login?auth=password`);
  await signInWithPassword(page, { email, password });

  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: SIGN_IN_TIMEOUT_MS });
  await new AppNav(page).accountMenuButton().waitFor({ timeout: 30_000 });
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
  const authType = await detectAuthType(page);
  const email = authType === "passwordless" ? await registerPasswordless(page) : await registerWithEmailPassword(page, deps);

  const auth0User = await deps.auth0.getUserByEmail(email);
  if (!auth0User) throw new Error(`Auth0 user was not created for ${email}`);

  return { email, userId: auth0User.user_id };
}

async function registerPasswordless(page: Page): Promise<string> {
  const otp = createEmailVerificationStrategy();
  const email = otp.generateEmail();
  await signInPasswordless(page, email);
  return email;
}

/**
 * Registers a new user via the email + password escape hatch (/login?auth=password).
 * password-signup sets the session cookie server-side, so the user is signed in and redirected
 * straight off /login with no OTP step — unlike passwordless, so this must not wait on a
 * verification-code screen.
 */
async function registerWithEmailPassword(page: Page, deps: { auth0: Auth0ManagementService; emailVerification: EmailVerificationStrategy }): Promise<string> {
  const email = deps.emailVerification.generateEmail();
  const auth = new AuthPage(page);

  await page.goto(`${testEnvConfig.BASE_URL}/login?tab=signup&auth=password`);

  const signupResponse = page.waitForResponse(response => response.url().endsWith("/api/auth/password-signup") && response.ok(), {
    timeout: 30_000
  });
  await auth.signUp({ email, password: generateTestPassword() });
  await signupResponse;

  const created = await deps.auth0.getUserByEmail(email);
  if (!created) throw new Error(`Auth0 user was not created for ${email}`);

  await page.waitForURL(url => !url.pathname.includes("/login"), { timeout: 30_000 });

  return email;
}

/** Drives the email + password login form for the given credentials. Page is expected to be on /login. */
async function signInWithPassword(page: Page, credentials: { email: string; password: string }): Promise<void> {
  const auth = new AuthPage(page);
  await auth.signIn(credentials);
}

/** Drives the passwordless (email OTP read from the e2e inbox worker) flow for the given email. Page is expected to be on /login. */
export async function signInPasswordless(page: Page, email: string): Promise<void> {
  const otp = createEmailVerificationStrategy();
  const auth = new AuthPagePasswordless(page);

  const sinceMs = Date.now();
  await auth.startWithEmail(email);
  await auth.waitForVerifyScreen();
  await otp.verify({ context: page.context(), email, userId: "", sinceMs });
  await auth.waitForRedirectAwayFromLogin();
}
