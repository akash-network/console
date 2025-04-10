export interface ServerAccess {
  hostname: string;
  port: number;
  username: string;
  password?: string;
  keyfile?: string;
  file?: File;
  passphrase?: string;
}

export interface SystemInfo {
  cpu: {
    cores: number;
    model: string;
    speed: number;
  };
  memory: {
    total: number;
    free: number;
  };
  os: {
    platform: string;
    version: string;
  };
}

export interface VerificationResponse {
  status: string;
  data: {
    system_info: SystemInfo;
  };
}

export interface VerificationError {
  message: string;
  details: string[];
}
