/**
 * Logger service for the application
 *
 * Extends the base LoggerService from @akashnetwork/logging to provide
 * consistent logging functionality throughout the application.
 */
import { LoggerService as LoggerServiceOriginal } from "@akashnetwork/logging";
import { injectable } from "tsyringe";

/**
 * Logger service for the application
 *
 * Extends the base LoggerService from @akashnetwork/logging to provide
 * consistent logging functionality throughout the application.
 */
@injectable()
export class LoggerService extends LoggerServiceOriginal {}
