import packageJSON from "../../package.json";

export default function getConfig() {
  return {
    publicRuntimeConfig: {
      version: packageJSON.version
    }
  };
}
