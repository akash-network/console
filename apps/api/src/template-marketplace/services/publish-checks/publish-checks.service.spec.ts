import { faker } from "@faker-js/faker";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AskedValue } from "@src/template-marketplace/lib/asked-values/asked-values.schema";
import type { PublishCheckKey } from "@src/template-marketplace/lib/publish-checks/publish-check-results";
import type { TemplatePublisherRepository } from "@src/template-marketplace/repositories/template-publisher/template-publisher.repository";
import type { TemplateSdlValidatorService } from "@src/template-marketplace/services/template-sdl-validator/template-sdl-validator.service";
import { PublishChecksService } from "./publish-checks.service";

const SDL = JSON.stringify({ version: "2.0", services: { web: { image: "nginx:1.27.2", env: ["PORT=8080"] } } });

describe(PublishChecksService.name, () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes content that holds to every check, stamped with the time it ran", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-18T10:00:00.000Z") });
    const { service, organizationId, templatePublisherRepository, templateSdlValidatorService } = setup();

    const results = await service.run({ sdl: SDL, readme: null, askedValues: [], title: "Llama 3.1 Chat", organizationId });

    expect(results.ranAt).toBe("2026-11-18T10:00:00.000Z");
    expect(results.checks.map(({ key, status }) => ({ key, status }))).toEqual([
      { key: "sdl_valid", status: "passed" },
      { key: "no_secrets", status: "passed" },
      { key: "images_allowed", status: "passed" },
      { key: "fixed_tags", status: "passed" },
      { key: "name_not_reserved", status: "passed" }
    ]);
    expect(templatePublisherRepository.findPublishingOrganization).toHaveBeenCalledWith(organizationId);
    expect(templateSdlValidatorService.findIssues).toHaveBeenCalledWith(SDL);
  });

  it("fails the SDL check with what the template SDL validation found", async () => {
    const { service, organizationId } = setup({ sdlIssues: ["The SDL defines no services"] });

    const results = await service.run({ sdl: SDL, readme: null, askedValues: [askedValue({ service: "worker" })], title: "Llama", organizationId });

    expect(issuesOf(results, "sdl_valid")).toEqual(["The SDL defines no services"]);
  });

  it("fails the SDL check with an asked value the SDL cannot hold once the SDL itself is valid", async () => {
    const { service, organizationId } = setup();

    const results = await service.run({ sdl: SDL, readme: null, askedValues: [askedValue({ service: "worker" })], title: "Llama", organizationId });

    expect(issuesOf(results, "sdl_valid")).toEqual(['Variable "PORT" fills in service "worker", which the SDL does not define']);
  });

  it("reads the title and the organization's name for reserved words", async () => {
    const { service, organizationId } = setup({ organizationName: "Akash Fans" });

    const results = await service.run({ sdl: SDL, readme: null, askedValues: [], title: "Official Llama", organizationId });

    expect(results.checks.find(check => check.key === "name_not_reserved")?.issues.map(issue => issue.field)).toEqual(["title", "publisher_name"]);
  });

  it("checks a template whose organization is gone under no publisher name", async () => {
    const { service, organizationId } = setup({ organizationName: null });

    const results = await service.run({ sdl: SDL, readme: null, askedValues: [], title: "Llama", organizationId });

    expect(issuesOf(results, "name_not_reserved")).toEqual([]);
  });

  function issuesOf(results: Awaited<ReturnType<PublishChecksService["run"]>>, key: PublishCheckKey) {
    return results.checks.find(check => check.key === key)!.issues.map(issue => issue.message);
  }

  function askedValue({ service }: { service: string }): AskedValue {
    return { key: "PORT", label: "Port", type: "text", required: false, bindings: [{ service, env: "PORT" }] };
  }

  function setup(input: { sdlIssues?: string[]; organizationName?: string | null } = {}) {
    const organizationId = faker.string.uuid();
    const templateSdlValidatorService = mock<TemplateSdlValidatorService>();
    templateSdlValidatorService.findIssues.mockReturnValue(input.sdlIssues ?? []);
    const templatePublisherRepository = mock<TemplatePublisherRepository>();
    templatePublisherRepository.findPublishingOrganization.mockResolvedValue(
      input.organizationName === null ? undefined : { name: input.organizationName ?? "Sam Rivera", slug: "sam", type: "team", ownerUsername: "sam" }
    );
    const service = new PublishChecksService(templateSdlValidatorService, templatePublisherRepository);

    return { service, organizationId, templateSdlValidatorService, templatePublisherRepository };
  }
});
