import RestModule from "@src/interfaces/rest/rest.module";
import { createHttpBootstrapper } from "@src/lib/bootstrap/factory/bootstrap-factory";

export const bootstrap = createHttpBootstrapper(RestModule);
