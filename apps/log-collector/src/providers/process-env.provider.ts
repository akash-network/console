import process from "node:process";
import { container } from "tsyringe";

export const PROCESS_ENV = "PROCESS_ENV";

container.register(PROCESS_ENV, { useValue: process.env });
