import { createHash, randomBytes } from "crypto";
import { singleton } from "tsyringe";

@singleton()
export class ApiKeyGeneratorService {
  private readonly KEY_PREFIX = "ac";
  private readonly KEY_TYPE = "sk";
  private readonly SEGMENT_LENGTH = 32;
  private readonly VISIBLE_CHARS = 6;

  private get ENV(): string {
    return process.env.NODE_ENV === "production" ? "live" : "test";
  }

  generateApiKey(): string {
    const randomSegment = randomBytes(this.SEGMENT_LENGTH).toString("hex");
    return [this.KEY_PREFIX, this.KEY_TYPE, this.ENV, randomSegment].join(".");
  }

  hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  obfuscateApiKey(apiKey: string): string {
    const parts = apiKey.split(".");
    const lastPart = parts[parts.length - 1];
    const start = lastPart.slice(0, this.VISIBLE_CHARS);
    const end = lastPart.slice(-this.VISIBLE_CHARS);
    parts[parts.length - 1] = `${start}***${end}`;
    return parts.join(".");
  }

  validateApiKey(apiKey: string, hashedKey: string): boolean {
    const computedHash = this.hashApiKey(apiKey);
    return computedHash === hashedKey;
  }
}
