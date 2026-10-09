import { subject } from "@casl/ability";
import { faker } from "@faker-js/faker";
import type { CallHandler, ExecutionContext } from "@nestjs/common";
import { UnauthorizedException } from "@nestjs/common";
import type { HttpArgumentsHost } from "@nestjs/common/interfaces";
import type { Request } from "express";
import { firstValueFrom, of } from "rxjs";
import type { Result } from "ts-results";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { AuthInterceptor, Unprotected } from "./auth.interceptor";

describe(AuthInterceptor.name, () => {
  it("lets an unprotected handler through without an identity", async () => {
    @Unprotected()
    class InternalController {}

    const { interceptor, context, next, request } = setup({ headers: {}, controller: InternalController });

    expect(await firstValueFrom(await interceptor.intercept(context, next))).toBe("handled");
    expect(request.ability).toBeUndefined();
  });

  it("rejects a request whose identity headers are missing or malformed", async () => {
    const { interceptor, context, next } = setup({ headers: { "x-user-id": faker.string.uuid(), "x-organization-id": "acme" } });

    const result = (await firstValueFrom(await interceptor.intercept(context, next))) as Result<never, UnauthorizedException>;

    expect(result.val).toBeInstanceOf(UnauthorizedException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it("builds the ability of the organization membership the api minted", async () => {
    const organizationId = faker.string.uuid();
    const { interceptor, context, next, request } = setup({
      headers: {
        "x-user-id": faker.string.uuid(),
        "x-organization-id": organizationId,
        "x-organization-role": "viewer",
        "x-project-scope": JSON.stringify({ kind: "all" })
      }
    });

    expect(await firstValueFrom(await interceptor.intercept(context, next))).toBe("handled");
    expect(request.ability?.can("read", subject("Alert", { organizationId }))).toBe(true);
    expect(request.ability?.can("delete", subject("Alert", { organizationId }))).toBe(false);
  });

  it("builds the ability of the user when no membership is minted", async () => {
    const userId = faker.string.uuid();
    const { interceptor, context, next, request } = setup({ headers: { "x-user-id": userId } });

    await firstValueFrom(await interceptor.intercept(context, next));

    expect(request.ability?.can("delete", subject("Alert", { userId }))).toBe(true);
  });

  function setup(input: { headers: Record<string, string>; controller?: new () => unknown }) {
    class ProtectedController {}

    const request: Pick<Request, "headers" | "ability"> = { headers: input.headers };
    const http = mock<HttpArgumentsHost>();
    http.getRequest.mockReturnValue(request);
    const context = mock<ExecutionContext>();
    context.getClass.mockReturnValue(input.controller ?? ProtectedController);
    context.getHandler.mockReturnValue(function handler() {});
    context.switchToHttp.mockReturnValue(http);
    const next = mock<CallHandler>();
    next.handle.mockReturnValue(of("handled"));

    return { interceptor: new AuthInterceptor(), context, next, request };
  }
});
