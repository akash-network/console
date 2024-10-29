export interface MachineInformation {
  access: {
    hostname: string;
    username: string;
    password: string;
    file: File;
    passphrase: string;
    port: number;
  } | null;
  systemInfo: any;
}
