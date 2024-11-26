export interface MachineInformation {
  access: {
    hostname: string;
    username: string;
    password: string | null;
    file: File | null;
    passphrase: string | null;
    port: number;
  }
  systemInfo: any | null
}
