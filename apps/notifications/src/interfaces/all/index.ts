import AllModule from "@src/interfaces/all/all.module";
import { createHttpBootstrapper } from "@src/lib/bootstrap/factory/bootstrap-factory";

export const bootstrap = createHttpBootstrapper(AllModule);
