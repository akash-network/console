import ChainEventsModule from "@src/interfaces/chain-events/chain-events.module";
import { bootstrapHandler } from "@src/lib/bootstrap/bootstrap";

export async function bootstrap() {
  await bootstrapHandler(ChainEventsModule);
}
