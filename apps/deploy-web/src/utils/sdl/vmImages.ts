/**
 * The managed Container-VM (SSH VM) distro catalog, keyed by display label. Kept free of imports so
 * the form schema (`types/sdlBuilder`) can consume it without creating a cycle through `utils/sdl/data.ts`,
 * which itself imports the schema's types.
 */
export const SSH_VM_IMAGES = {
  "Ubuntu 24.04": "ghcr.io/akash-network/ubuntu-2404-ssh:2",
  "CentOS Stream 9": "ghcr.io/akash-network/centos-stream9-ssh:2",
  "Debian 11": "ghcr.io/akash-network/debian-11-ssh:2",
  "SuSE Leap 15.5": "ghcr.io/akash-network/opensuse-leap-155-ssh:2"
};

export const sshVmDistros: string[] = Object.keys(SSH_VM_IMAGES);

export const sshVmImages: Set<string> = new Set(Object.values(SSH_VM_IMAGES));

/** Whether the image is one of the managed SSH-VM distro images; drives the VM behavior of the configure cards. */
export function isVmImage(image: string): boolean {
  return sshVmImages.has(image);
}
