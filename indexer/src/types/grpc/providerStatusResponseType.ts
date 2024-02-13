// TODO: Remove once we have the generated grpc client and types
export type ProviderStatusResponseType = {
  cluster: {
    leases: { active?: number };
    inventory: {
      cluster: {
        nodes: {
          name: string;
          resources: {
            cpu: {
              quantity: {
                allocatable: {
                  string: string;
                };
                allocated: {
                  string: string;
                };
              };
              info: {
                id: string;
                vendor: string;
                model: string;
                vcores: number;
              }[];
            };
            memory: {
              quantity: {
                allocatable: {
                  string: string;
                };
                allocated: {
                  string: string;
                };
              };
            };
            gpu: {
              quantity: {
                allocatable: {
                  string: string;
                };
                allocated: {
                  string: string;
                };
              };
              info: {
                vendor: string;
                name: string;
                modelid: string;
                interface: string;
                memorySize: string;
              }[];
            };
            ephemeralStorage: {
              allocatable: {
                string: string;
              };
              allocated: {
                string: string;
              };
            };
            volumesAttached: {
              allocatable: {
                string: string;
              };
              allocated: {
                string: string;
              };
            };
            volumesMounted: {
              allocatable: {
                string: string;
              };
              allocated: {
                string: string;
              };
            };
          };
          capabilities: {
            storageClasses: ("beta1" | "beta2" | "beta3")[];
          };
        }[];
      };
      reservations: {
        pending: {
          resources: {
            cpu: {
              string: string;
            };
            memory: {
              string: string;
            };
            gpu: {
              string: string;
            };
            ephemeralStorage: {
              string: string;
            };
          };
        };
        active: {
          resources: {
            cpu: {
              string: string;
            };
            memory: {
              string: string;
            };
            gpu: {
              string: string;
            };
            ephemeralStorage: {
              string: string;
            };
          };
        };
      };
    };
  };
  bidEngine: {};
  manifest: {
    deployments: number;
  };
  publicHostnames: string[];
  timestamp: string;
};
