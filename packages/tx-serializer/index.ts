import type { EncodeObject } from "@cosmjs/proto-signing";

export class TxSerializer {
  serialize(messages: EncodeObject[]): string {}

  deserialize(encodedMessages: string): EncodeObject[] {}
}
