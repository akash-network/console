import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { bootstrapHandler } from "@src/lib/bootstrap/bootstrap";

export async function bootstrap() {
  await bootstrapHandler(AlertEventsModule);
}
