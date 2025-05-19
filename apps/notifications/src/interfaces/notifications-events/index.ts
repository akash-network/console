import NotificationsEventsModule from "@src/interfaces/notifications-events/notifications-events.module";
import { createWorkerBootstrapper } from "@src/lib/bootstrap/factory/bootstrap-factory";

export const bootstrap = createWorkerBootstrapper(NotificationsEventsModule);
