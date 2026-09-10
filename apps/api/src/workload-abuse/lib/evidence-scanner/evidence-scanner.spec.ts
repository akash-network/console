import { describe, expect, it } from "vitest";

import type { CompiledSignature } from "@src/workload-abuse/config/env.config";
import { sanitizeEvidenceText, scanForSignals, toVerdict } from "./evidence-scanner";

const SIGNATURES: CompiledSignature[] = [
  { bucket: "hard", category: "stratum-url", pattern: /stratum\+tcp:\/\//i },
  { bucket: "soft", category: "hashrate", pattern: /\d+\s*h\/s/i },
  { bucket: "soft", category: "pool-port", pattern: /:3333\b/ },
  { bucket: "soft", category: "nonce", pattern: /\bnonce\b/i },
  { bucket: "proxy", category: "proxy-tunnel", pattern: /\bxray\b/i }
];

describe("evidence scanner", () => {
  describe("scanForSignals", () => {
    it("tags each match with its bucket, category and the source it came from", () => {
      const signals = scanForSignals([{ kind: "shell", service: "ssh", text: "1 comm=miner cmd=miner -o stratum+tcp://pool:3333" }], SIGNATURES);

      expect(signals).toEqual([
        { bucket: "hard", category: "stratum-url", source: "shell", service: "ssh", snippet: "1 comm=miner cmd=miner -o stratum+tcp://pool:3333" },
        { bucket: "soft", category: "pool-port", source: "shell", service: "ssh", snippet: "1 comm=miner cmd=miner -o stratum+tcp://pool:3333" }
      ]);
    });

    it("turns NUL bytes into spaces in the snippet it stores", () => {
      const [signal] = scanForSignals([{ kind: "shell", text: "cmd=sh -c tr '\u0000' ' ' -o stratum+tcp://pool" }], SIGNATURES);

      expect(signal.snippet).toBe("cmd=sh -c tr ' ' ' ' -o stratum+tcp://pool");
    });

    it("turns every other control byte into a space too, since a log line escapes each of them to six characters", () => {
      const [signal] = scanForSignals([{ kind: "shell", text: "cmd=miner \u001b[31m\u0007-o stratum+tcp://pool" }], SIGNATURES);

      expect(signal.snippet).toBe("cmd=miner  [31m -o stratum+tcp://pool");
    });

    it("turns NUL bytes into spaces in the service name it stores, since the provider names its own services", () => {
      const [signal] = scanForSignals([{ kind: "shell", service: "ssh\u0000box", text: "cmd=miner -o stratum+tcp://pool" }], SIGNATURES);

      expect(signal.service).toBe("ssh box");
    });

    it("reports one signal per category per source however many lines match", () => {
      const signals = scanForSignals([{ kind: "logs", text: "speed 10 H/s\nspeed 12 H/s\nspeed 15 H/s" }], SIGNATURES);

      expect(signals).toHaveLength(1);
    });

    it("keeps the same category from two sources as two signals", () => {
      const signals = scanForSignals(
        [
          { kind: "logs", text: "nonce found" },
          { kind: "sdl", text: "env: NONCE=1" }
        ],
        SIGNATURES
      );

      expect(signals.map(signal => signal.source)).toEqual(["logs", "sdl"]);
    });

    it("keeps the same category from two services as two signals", () => {
      const signals = scanForSignals(
        [
          { kind: "shell", service: "web", text: "nonce found" },
          { kind: "shell", service: "worker", text: "nonce found" }
        ],
        SIGNATURES
      );

      expect(signals.map(signal => signal.service)).toEqual(["web", "worker"]);
    });

    it("trims the snippet it stores", () => {
      const [signal] = scanForSignals([{ kind: "logs", text: "   stratum+tcp://pool   " }], SIGNATURES);

      expect(signal.snippet).toBe("stratum+tcp://pool");
    });

    it("bounds the snippet around the match", () => {
      const line = `${"a".repeat(300)} stratum+tcp://pool ${"b".repeat(300)}`;

      const [signal] = scanForSignals([{ kind: "logs", text: line }], SIGNATURES);

      expect(signal.snippet.length).toBeLessThanOrEqual(180);
      expect(signal.snippet).toContain("stratum+tcp://pool");
    });

    it("returns nothing for clean text or when there are no signatures", () => {
      expect(scanForSignals([{ kind: "logs", text: "nginx started\n\n" }], SIGNATURES)).toEqual([]);
      expect(scanForSignals([{ kind: "logs", text: "stratum+tcp://pool" }], [])).toEqual([]);
    });
  });

  describe("sanitizeEvidenceText", () => {
    it("keeps the tabs and newlines that hold the shell output's shape", () => {
      expect(sanitizeEvidenceText("--tmp\ndrwx\t4096 /tmp\n")).toBe("--tmp\ndrwx\t4096 /tmp\n");
    });

    it("turns the control bytes around them into spaces", () => {
      expect(sanitizeEvidenceText("--tmp\u0000\u001b[31m\u0007\ndrwx\t4096 /tmp")).toBe("--tmp  [31m \ndrwx\t4096 /tmp");
    });
  });

  describe("toVerdict", () => {
    it("is hard on any hard signal", () => {
      const signals = scanForSignals([{ kind: "sdl", text: "stratum+tcp://pool" }], SIGNATURES);

      expect(toVerdict(signals)).toBe("hard");
    });

    it("is soft only once three distinct soft categories agree", () => {
      const two = scanForSignals([{ kind: "logs", text: "10 H/s\npool:3333" }], SIGNATURES);
      const three = scanForSignals([{ kind: "logs", text: "10 H/s\npool:3333\nnonce" }], SIGNATURES);

      expect(toVerdict(two)).toBe("clean");
      expect(toVerdict(three)).toBe("soft");
    });

    it("stays proxy when soft signals are present but too few to count", () => {
      const signals = scanForSignals([{ kind: "shell", text: "10 H/s\npool:3333\n1 comm=xray" }], SIGNATURES);

      expect(toVerdict(signals)).toBe("proxy");
    });

    it("reports proxy tunnels separately from mining", () => {
      const signals = scanForSignals([{ kind: "shell", text: "1 comm=xray" }], SIGNATURES);

      expect(toVerdict(signals)).toBe("proxy");
    });
  });
});
