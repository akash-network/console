import "@akashnetwork/env-loader";

import AllModule from "@src/interfaces/all/all.module";
import { bootstrapHttp } from "@src/lib/bootstrap/bootstrap";

export async function bootstrap() {
  await bootstrapHttp(AllModule);
}
