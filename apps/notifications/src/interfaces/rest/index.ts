import "@akashnetwork/env-loader";

import RestModule from "@src/interfaces/rest/rest.module";
import { bootstrapHttp } from "@src/lib/bootstrap/bootstrap";

export async function bootstrap() {
  await bootstrapHttp(RestModule);
}
