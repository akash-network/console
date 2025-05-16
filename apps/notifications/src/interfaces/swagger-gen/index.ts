import RestModule from "@src/interfaces/rest/rest.module";
import { Bootstrapper } from "@src/lib/bootstrap/bootstrapper/bootstrapper";
import { SwaggerSetup } from "@src/lib/bootstrap/swagger-setup/swagger-setup";

export async function bootstrap() {
  const app = await new Bootstrapper(RestModule).createApp();
  SwaggerSetup.generateSwagger(app);
}
