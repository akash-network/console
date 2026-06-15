import { createInterface, type Interface } from "node:readline/promises";
import { singleton } from "tsyringe";

/**
 * Thin wrapper around `node:readline/promises` for interactive console commands.
 * Lazily opens a single stdin/stdout interface and exposes question/output/close
 * so command flows stay decoupled from the readline module and remain testable.
 */
@singleton()
export class CliPromptService {
  #rl?: Interface;

  /** Asks a question on stdin and resolves with the operator's raw answer. */
  question(query: string): Promise<string> {
    return this.#getInterface().question(query);
  }

  /** Writes a single line of interactive UI output to stdout (terminal UI, not structured logging). */
  writeLine(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  /** Closes the underlying readline interface if one was opened. */
  close(): void {
    this.#rl?.close();
    this.#rl = undefined;
  }

  #getInterface(): Interface {
    return (this.#rl ??= createInterface({ input: process.stdin, output: process.stdout }));
  }
}
