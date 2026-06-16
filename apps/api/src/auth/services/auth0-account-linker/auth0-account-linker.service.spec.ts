import type { GetUsers200ResponseOneOfInner } from "auth0";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { Auth0Service } from "@src/auth/services/auth0/auth0.service";
import type { CliPromptService } from "@src/core/services/cli-prompt/cli-prompt.service";
import { Auth0AccountLinkerService } from "./auth0-account-linker.service";

import { createAuth0Identity, createAuth0User } from "@test/seeders";

describe(Auth0AccountLinkerService.name, () => {
  it("links the secondary root identity into the primary after confirmation", async () => {
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({
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
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({
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
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "1", "secondary@x.com", "1", "n"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(auth0Service.linkUsers).not.toHaveBeenCalled();
    expect(prompt.writeLine).toHaveBeenCalledWith("Aborted. No changes made.");
  });

  it("re-prompts when no users are found for an email", async () => {
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({ user_id: "google-oauth2|secondary" });
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
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({ user_id: "google-oauth2|secondary" });
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
    const shared = createAuth0User({ user_id: "auth0|primary" });
    const other = createAuth0User({ user_id: "google-oauth2|other" });
    const { service, auth0Service } = setup({ answers: ["primary@x.com", "1", "same@x.com", "1", "other@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([shared] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([shared] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([other] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(auth0Service.linkUsers).toHaveBeenCalledWith("auth0|primary", { provider: "google-oauth2", userId: "other" });
  });

  it("re-prompts when the picked index is out of range", async () => {
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "9", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith("Enter a number between 1 and 1.");
    expect(auth0Service.linkUsers).toHaveBeenCalled();
  });

  it("re-prompts when the email is empty", async () => {
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["", "primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);

    await service.linkAccountsInteractively();

    expect(prompt.writeLine).toHaveBeenCalledWith("Email cannot be empty. Try again.");
    expect(auth0Service.getUsersByEmail).not.toHaveBeenCalledWith("");
  });

  it("throws and still closes the prompt when the secondary has no usable identity", async () => {
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({
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
    const primary = createAuth0User({ user_id: "auth0|primary" });
    const secondary = createAuth0User({ user_id: "google-oauth2|secondary" });
    const { service, auth0Service, prompt } = setup({ answers: ["primary@x.com", "1", "secondary@x.com", "1", "y"] });
    auth0Service.getUsersByEmail
      .mockResolvedValueOnce([primary] as GetUsers200ResponseOneOfInner[])
      .mockResolvedValueOnce([secondary] as GetUsers200ResponseOneOfInner[]);
    auth0Service.linkUsers.mockRejectedValue(new Error("auth0 down"));

    await expect(service.linkAccountsInteractively()).rejects.toThrow("auth0 down");

    expect(prompt.close).toHaveBeenCalled();
  });

  function setup(input: { answers?: string[] } = {}) {
    const auth0Service = mock<Auth0Service>();
    const prompt = mock<CliPromptService>();
    const answers = [...(input.answers ?? [])];
    prompt.question.mockImplementation(() => Promise.resolve(answers.shift() ?? ""));
    const service = new Auth0AccountLinkerService(auth0Service, prompt);
    return { service, auth0Service, prompt };
  }
});
