import AlertEventsModule from "@src/interfaces/alert-events/alert-events.module";
import { createWorkerBootstrapper } from "@src/lib/bootstrap/factory/bootstrap-factory";

export const bootstrap = createWorkerBootstrapper(AlertEventsModule);
