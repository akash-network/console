import { faker } from "@faker-js/faker";

import type { Node } from "@src/routes/v1/nodes/nodeClient";

export class NodeSeeder {
  static create({ id = faker.string.alphanumeric(), api = faker.string.alphanumeric(), rpc = faker.string.alphanumeric() }: Partial<Node> = {}): Node {
    return {
      id,
      api,
      rpc
    };
  }
}
