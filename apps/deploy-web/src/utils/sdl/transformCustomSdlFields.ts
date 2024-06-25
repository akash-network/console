import cloneDeep from "lodash/cloneDeep";
import flow from "lodash/flow";
import isMatch from "lodash/isMatch";

import { Service } from "@src/types";
import { SSH_EXPOSE, SSH_VM_IMAGES } from "@src/utils/sdl/data";

interface TransformOptions {
  withSSH?: boolean;
}

export class TransformError extends Error {}

export const transformCustomSdlFields = (services: Service[], options?: TransformOptions) => {
  const pipeline = [addSshPubKey, ensureServiceCount];

  if (options?.withSSH) {
    pipeline.push(ensureSSHExpose);
    pipeline.push(mapImage);
  }

  const transform = flow(pipeline);

  return services.map(service => transform(service));
};

function addSshPubKey(input: Service) {
  const { sshPubKey } = input;
  if (!sshPubKey) {
    return input;
  }

  const output = cloneDeep(input);

  output.env = output.env || [];
  const sshPubKeyEnv = output.env.find(e => e.key === "SSH_PUB_KEY");

  if (sshPubKeyEnv) {
    sshPubKeyEnv.value = sshPubKey;
  } else {
    output.env.push({
      id: "SSH_PUBKEY",
      key: "SSH_PUBKEY",
      value: sshPubKey,
      isSecret: false
    });
  }

  return output;
}

function ensureSSHExpose(service: Service) {
  if (service.expose.some(exp => isMatch(exp, SSH_EXPOSE))) {
    return service;
  }

  if (service.expose.some(exp => exp.port === 22)) {
    throw new TransformError("Expose outer port 22 is reserved");
  }

  if (service.expose.some(exp => exp.as === 22)) {
    throw new TransformError("Expose inner port 22 is reserved");
  }

  const output = cloneDeep(service);

  output.expose.push({
    id: "ssh",
    ...SSH_EXPOSE
  });

  return output;
}

function ensureServiceCount(input: Service) {
  if (input.count === 1) {
    return input;
  }

  const output = cloneDeep(input);
  output.count = 1;

  return output;
}

function mapImage(input: Service) {
  const image = SSH_VM_IMAGES[input.image];

  if (!image) {
    throw new Error(`Unsupported SSH VM image: ${input.image}`);
  }

  const output = cloneDeep(input);
  output.image = image;

  return output;
}
