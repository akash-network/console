export type RestCosmostTransactionResponse = {
  tx: {
    body: {
      messages: {
        "@type": string;
        client_id: string;
        header: {
          "@type": string;
          signed_header: {
            header: {
              version: {
                block: string;
                app: string;
              };
              chain_id: string;
              height: string;
              time: string;
              last_block_id: {
                hash: string;
                part_set_header: {
                  total: number;
                  hash: string;
                };
              };
              last_commit_hash: string;
              data_hash: string;
              validators_hash: string;
              next_validators_hash: string;
              consensus_hash: string;
              app_hash: string;
              last_results_hash: string;
              evidence_hash: string;
              proposer_address: string;
            };
            commit: {
              height: string;
              round: number;
              block_id: {
                hash: string;
                part_set_header: {
                  total: number;
                  hash: string;
                };
              };
              signatures: {
                block_id_flag: string;
                validator_address: string;
                timestamp: string;
                signature: string;
              }[];
            };
          };
        };
      }[];
    };
    auth_info: {
      signer_infos: [
        {
          public_key: {
            "@type": string;
            key: string;
          };
          mode_info: {
            single: {
              mode: string;
            };
          };
          sequence: string;
        }
      ];
      fee: {
        amount: [
          {
            denom: string;
            amount: string;
          }
        ];
        gas_limit: string;
        payer: string;
        granter: string;
      };
    };
    signatures: string[];
  };
  tx_response: {
    height: string;
    txhash: string;
    codespace: string;
    code: number;
    data: string;
    raw_log: string;
    logs: {
      msg_index: number;
      log: string;
      events: {
        type: string;
        attributes: {
          key: string;
          value: string;
        }[];
      }[];
    }[];
    info: string;
    gas_wanted: string;
    gas_used: string;
    tx: {
      type: string;
      value: {
        msg: {
          type: string;
          value: {
            from_address: string;
            to_address: string;
            amount: {
              denom: string;
              amount: string;
            }[];
          };
        }[];
        fee: {
          amount: {
            denom: string;
            amount: string;
          }[];
          gas: string;
        };
        signatures: {
          pub_key: {
            type: string;
            value: string;
          };
          signature: string;
        }[];
        memo: string;
      };
    };
    timestamp: string;
    events: {
      type: string;
      attributes: {
        key: string;
        value: string;
        index: boolean;
      }[];
    }[];
  };
};
