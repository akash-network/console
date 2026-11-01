import type { GetUsers200ResponseOneOfInner } from "auth0";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { CliPromptService } from "@src/core/services/cli-prompt/cli-prompt.service";
import { Auth0AccountLinkerService } from "./auth0-account-linker.service";

import { createAuth0Identity, createAuth0User } from "@test/seeders";

describe(Auth0AccountLinkerService.name, () => {
  it("links the secondary root identity into the primary after confirmation", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({
      user_id: "google-oauth2|secondary",
      identities: [createAuth0Identity({ provider: "google-oauth2", user_id: "secondary", connection: "google-oauth2" })]
    });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(auth0Service.linkUsers).toHaveBeenCalledWith("auth0|primary", { provider: "google-oauth2", userId: "secondary" });
    expect(prompt.close).toHaveBeenCalled();
  });

  it("selects the identity matching the account user_id rather than the first identity", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({
      user_id: "google-oauth2|root",
      identities: [
        createAuth0Identity({ provider: "auth0", user_id: "linked" }),
        createAuth0Identity({ provider: "google-oauth2", user_id: "root", connection: "google-oauth2" })
      ]
    });
    const { service, auth0Service } = setup({ answers: ["primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(auth0Service.linkUsers).toHaveBeenCalledWith("auth0|primary", { provider: "google-oauth2", userId: "root" });
  });

  it("does not link when the operator declines confirmation", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "1", "secondary@x.com", "1", "n"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(auth0Service.linkUsers).not.toHaveBeenCalled();
    expect(prompt.writeLine).toHaveBeenCalledWith("Aborted. No changes made.");
  });

  it("re-prompts when no users are found for an email", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["missing@x.com", "primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith('No Auth0 users found for "missing@x.com". Try again.');
    expect(auth0Service.linkUsers).toHaveBeenCalled();
  });

  it("re-prompts when the email lookup throws", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["bad-email", "primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockRejectedValueOnce(new Error("invalid email"))
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith('Lookup failed for "bad-email": invalid email. Try again.');
    expect(auth0Service.linkUsers).toHaveBeenCalled();
  });

  it("re-prompts the secondary when it resolves to the same account as the primary", async () => {
    const shared = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const other = createVerifiedAuth0User({ user_id: "google-oauth2|other" });
    const { service, auth0Service } = setup({ answers: ["primary@x.com", "1", "same@x.com", "1", "other@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([shared] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([shared] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([other] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(auth0Service.linkUsers).toHaveBeenCalledWith("auth0|primary", { provider: "google-oauth2", userId: "other" });
  });

  it("re-prompts when the picked index is out of range", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "9", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith("Enter a number between 1 and 1.");
    expect(auth0Service.linkUsers).toHaveBeenCalled();
  });

  it("re-prompts when the email is empty", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["", "primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith("Email cannot be empty. Try again.");
    expect(auth0Service.getUsersByEmail).not.toHaveBeenCalledWith("");
  });

  it("throws and still closes the prompt when the secondary has no usable identity", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({
      user_id: "auth0|secondary",
      identities: [createAuth0Identity({ provider: "google-oauth2", user_id: "mismatch" })]
    });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await expect(service.linkAccountsInteractively()).rejects.toThrow("no usable identity");

    expect(auth0Service.linkUsers).not.toHaveBeenCalled();
    expect(prompt.close).toHaveBeenCalled();
  });

  it("closes the prompt when linking fails", async () => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);
    auth0Service.linkUsers.mockRejectedValue(new Error("auth0 down"));

    await expect(service.linkAccountsInteractively()).rejects.toThrow("auth0 down");

    expect(prompt.close).toHaveBeenCalled();
  });

  it.each([false, undefined])("refuses a secondary whose email is not verified (%s) and links the verified one picked next", async emailVerified => {
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const unverified = createAuth0User({ user_id: "auth0|unverified", email_verified: emailVerified });
    const verified = createVerifiedAuth0User({ user_id: "google-oauth2|verified" });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "1", "secondary@x.com", "1", "other@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([unverified] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([verified] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith("That account's email is not verified, so it cannot be linked. Ask the user to verify it first.");
    expect(auth0Service.linkUsers).toHaveBeenCalledTimes(1);
    expect(auth0Service.linkUsers).toHaveBeenCalledWith("auth0|primary", { provider: "google-oauth2", userId: "verified" });
  });

  it("refuses a primary whose email is not verified", async () => {
    const unverified = createAuth0User({ user_id: "auth0|unverified", email_verified: false });
    const primary = createVerifiedAuth0User({ user_id: "auth0|primary" });
    const secondary = createVerifiedAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["unverified@x.com", "1", "primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([unverified] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith("That account's email is not verified, so it cannot be linked. Ask the user to verify it first.");
    expect(auth0Service.linkUsers).toHaveBeenCalledWith("auth0|primary", { provider: "google-oauth2", userId: "secondary" });
  });

  it("lists each match with its verification, creation date, last login and login count", async () => {
    const primary = createVerifiedAuth0User({
      user_id: "google-oauth2|primary",
      email: "person@x.com",
      created_at: "2026-01-02T00:00:00.000Z",
      last_login: "2026-10-01T00:00:00.000Z",
      logins_count: 12
    });
    const unverified = createAuth0User({
      user_id: "auth0|unverified",
      email: "person@x.com",
      email_verified: false,
      created_at: { unexpected: true },
      last_login: undefined,
      logins_count: undefined
    });
    const secondary = createVerifiedAuth0User({ user_id: "auth0|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["person@x.com", "1", "person@x.com", "2", "other@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([primary, unverified] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith(
      "  1) google-oauth2 / person@x.com (google-oauth2|primary), email verified, created 2026-01-02T00:00:00.000Z, last login 2026-10-01T00:00:00.000Z, 12 logins"
    );
    expect(prompt.writeLine).toHaveBeenCalledWith(
      "  2) Username-Password-Authentication / person@x.com (auth0|unverified), email NOT verified, created unknown, last login unknown, 0 logins"
    );
  });

  function createVerifiedAuth0User(overrides: Partial<GetUsers200ResponseOneOfInner> = {}) {
    return createAuth0User({ email_verified: true, ...overrides });
  }

  function setup(input: { answers?: string[] } = {}) {
    const auth0Service = mock<Auth0Service>();
    const prompt = mock<CliPromptService>();
    const answers = [...(input.answers ?? [])];
    prompt.question.mockImplementation(() => Promise.resolve(answers.shift() ?? ""));
    const service = new Auth0AccountLinkerService(auth0Service, prompt);
    return { service, auth0Service, prompt };
  }
});
