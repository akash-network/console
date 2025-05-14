import NotificationsEventsModule from "@src/interfaces/notifications-events/notifications-events.module";
import { bootstrapHandler } from "@src/lib/bootstrap/bootstrap";

export async function bootstrap() {
  await bootstrapHandler(NotificationsEventsModule);
}
