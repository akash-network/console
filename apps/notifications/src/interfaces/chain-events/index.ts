import ChainEventsModule from "@src/interfaces/chain-events/chain-events.module";
import { createWorkerBootstrapper } from "@src/lib/bootstrap/factory/bootstrap-factory";

export const bootstrap = createWorkerBootstrapper(ChainEventsModule);
