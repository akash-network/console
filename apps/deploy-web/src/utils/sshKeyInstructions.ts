/** Where the generated keypair.zip is unpacked. Kept off ~/.ssh/id_rsa so an existing key stays put. */
export const SSH_KEY_DIR = "~/akash-key";

/** Must match where the configure page's SSH key instructions put the private key it generates. */
export const SSH_PRIVATE_KEY_PATH = `${SSH_KEY_DIR}/id_rsa`;

/** keypair.zip holds id_rsa and id_rsa.pub at the top level, with no extra folder. */
export const SSH_KEY_UNPACK_COMMAND = `mkdir -p ${SSH_KEY_DIR} && unzip -o ~/Downloads/keypair.zip -d ${SSH_KEY_DIR}`;

export const SSH_KEY_PERMISSION_COMMAND = `chmod 600 ${SSH_PRIVATE_KEY_PATH}`;

export function sshConnectCommand(host: string, port: number): string {
  return `ssh -i ${SSH_PRIVATE_KEY_PATH} -o IdentitiesOnly=yes -p ${port} root@${host}`;
}
