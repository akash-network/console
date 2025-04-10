/**
 * Represents the system information of a server/node
 */
export interface SystemInfo {
  cpus: string;
  memory: string;
  public_ip: string;
  private_ip: string;
  os: string;
  storage: Array<{
    name: string;
    size: number;
    type: string;
    fstype: string | null;
    mountpoint: string | null;
    children?: Array<{
      name: string;
      size: number;
      type: string;
      fstype: string;
      mountpoint: string;
    }>;
  }>;
  gpu: {
    count: number;
    vendor: string | null;
    name: string | null;
    memory_size: string | null;
    interface: string | null;
  };
  has_sudo: boolean;
}
