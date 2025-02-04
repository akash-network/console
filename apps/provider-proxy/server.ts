import { startAppServer } from "./src/app";
import { container } from "./src/container";

const { PORT = 3040 } = process.env;

startAppServer(Number(PORT)).then(() => {
  container.httpLogger?.info(`Http server listening on port ${PORT}`);
});
