import { LoggerService as LoggerServiceOriginal } from "@akashnetwork/logging";
import { singleton } from "tsyringe";

@singleton()
export class LoggerService extends LoggerServiceOriginal {}
