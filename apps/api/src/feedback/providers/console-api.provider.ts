import type { OpenAPIObject } from "openapi3-ts/oas30";
import type { InjectionToken } from "tsyringe";

/** The API app itself, registered where it is built, so the assistant reads through the same middleware, auth and ability checks as any caller. */
export interface ConsoleApi {
  fetch(request: Request): Promise<Response>;
  publishedDocument(): Promise<OpenAPIObject>;
}

export const CONSOLE_API = Symbol("CONSOLE_API") as InjectionToken<ConsoleApi>;
