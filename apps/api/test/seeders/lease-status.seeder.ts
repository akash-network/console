export interface LeaseStatusOutput {
  services: {
    [key: string]: {
      name: string;
      available: number;
      total: number;
      uris: string[];
      observed_generation: number;
      replicas: number;
      updated_replicas: number;
      ready_replicas: number;
      available_replicas: number;
    };
  };
  forwarded_ports: {
    [key: string]: Array<{
      port: number;
      externalPort: number;
      host: string;
      available: number;
    }>;
  };
  ips: {
    [key: string]: Array<{
      IP: string;
      Port: number;
      ExternalPort: number;
      Protocol: string;
    }>;
  };
}

export class LeaseStatusSeeder {
  static create(serviceName = "web"): LeaseStatusOutput {
    return {
      services: {
        [serviceName]: {
          name: serviceName,
          available: 1,
          total: 1,
          uris: ["http://example.com"],
          observed_generation: 1,
          replicas: 1,
          updated_replicas: 1,
          ready_replicas: 1,
          available_replicas: 1
        }
      },
      forwarded_ports: {
        [serviceName]: [
          {
            port: 80,
            externalPort: 30000,
            host: "example.com",
            available: 1
          }
        ]
      },
      ips: {
        [serviceName]: [
          {
            IP: "192.168.1.1",
            Port: 80,
            ExternalPort: 30000,
            Protocol: "tcp"
          }
        ]
      }
    };
  }
}
