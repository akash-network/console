/**
 * Node.js process provider for dependency injection
 *
 * Registers Node.js process and environment variables as injectable dependencies
 * for use throughout the application.
 */
import process from "node:process";
import { container } from "tsyringe";

/** Token for injecting the Node.js process object */
export const PROCESS = "PROCESS";

container.register(PROCESS, { useValue: process });

/** Token for injecting Node.js environment variables */
export const PROCESS_ENV = "PROCESS_ENV";

container.register(PROCESS_ENV, { useValue: process.env });
