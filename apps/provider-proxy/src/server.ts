import "./setupOpenTelemetry";

import { startAppServer } from "./app";

const { PORT = 3040 } = process.env;

startAppServer(Number(PORT)).then(server => {
  server.container.httpLogger?.info(`Started provider proxy server with NODE_OPTIONS=${process.env.NODE_OPTIONS}`);
  server.container.httpLogger?.info(`Http server listening on port ${PORT}`);
});
