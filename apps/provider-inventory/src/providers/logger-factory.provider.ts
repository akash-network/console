import type { LoggerService } from "@akashnetwork/logging";
import { createOtelLogger } from "@akashnetwork/logging/otel";
import type { InjectionToken } from "tsyringe";
import { container } from "tsyringe";

export type LoggerFactory = (options: { context: string }) => LoggerService;

export const LOGGER_FACTORY: InjectionToken<LoggerFactory> = Symbol("LOGGER_FACTORY");

container.register(LOGGER_FACTORY, { useValue: createOtelLogger });
