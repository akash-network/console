export type RestAkashDeploymentListResponse = {
  deployments: {
    deployment: {
      id: {
        owner: string;
        dseq: string;
      };
      state: string;
      hash: string;
      created_at: string;
    };
    groups: {
      id: {
        owner: string;
        dseq: string;
        gseq: number;
      };
      state: string;
      group_spec: {
        name: string;
        requirements: {
          signed_by: {
            all_of: string[];
            any_of: string[];
          };
          attributes: { key: string; value: string }[];
        };
        resources: {
          resource: {
            id: number;
            cpu: {
              units: {
                val: string;
              };
              attributes: { key: string; value: string }[];
            };
            memory: {
              quantity: {
                val: string;
              };
              attributes: { key: string; value: string }[];
            };
            storage: {
              name: string;
              quantity: {
                val: string;
              };
              attributes: { key: string; value: string }[];
            }[];
            gpu: {
              units: {
                val: string;
              };
              attributes: { key: string; value: string }[];
            };
            endpoints: { kind: string; sequence_number: number }[];
          };
          count: number;
          price: {
            denom: string;
            amount: string;
          };
        }[];
      };
      created_at: string;
    }[];
    escrow_account: {
      id: {
        scope: string;
        xid: string;
      };
      state: {
        owner: string;
        state: string;
        transferred: {
          denom: string;
          amount: string;
        }[];
        settled_at: string;
        funds: {
          denom: string;
          amount: string;
        }[];
        deposits: {
          owner: string;
          height: string;
          source: string;
          balance: {
            denom: string;
            amount: string;
          };
        }[];
      };
    };
  }[];
  pagination: {
    next_key: string | null;
    total: string;
  };
};
