export interface MachineInformation {
  access: {
    hostname: string;
    username: string;
    password: string | null;
    file: File | null;
    keyfile?: string | null;
    passphrase: string | null;
    port: number;
  };
  systemInfo: any | null;
}
