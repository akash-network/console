import type { NetworkNode } from "@akashnetwork/http-sdk";
import { faker } from "@faker-js/faker";

export function createNode({
  id = faker.string.alphanumeric(),
  api = faker.string.alphanumeric(),
  rpc = faker.string.alphanumeric()
}: Partial<NetworkNode> = {}): NetworkNode {
  return {
    id,
    api,
    rpc
  };
}
