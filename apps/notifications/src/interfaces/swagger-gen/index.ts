import RestModule from "@src/interfaces/rest/rest.module";
import { Bootstrapper } from "@src/lib/bootstrap/bootstrapper/bootstrapper";
import { SwaggerSetup } from "@src/lib/bootstrap/swagger-setup/swagger-setup";

export async function bootstrap() {
  const bootstrapper = new Bootstrapper(RestModule);
  const app = await bootstrapper.createApp();
  await bootstrapper.configureHttp();
  SwaggerSetup.generateSwagger(app);
}
