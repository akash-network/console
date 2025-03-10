const dotenv = require("dotenv");

module.exports = {
  localConfig: dotenv.config({ path: "env/.env.functional.test.local" }).parsed || {}
};
