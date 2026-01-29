import "@akashnetwork/env-loader";

import { startAppServer } from "./app";

startAppServer(process.env).then(server => {
  server.container.httpLogger?.info(`Started provider proxy server with NODE_OPTIONS=${process.env.NODE_OPTIONS}`);
  server.container.httpLogger?.info(`Http server listening on port ${server.container.appConfig.PORT}`);

  process.on("SIGTERM", () => server.close("SIGTERM"));
  process.on("SIGINT", () => server.close("SIGINT"));
  process.on("beforeExit", exitCode => server.close(`EXIT:${exitCode}`));
});
