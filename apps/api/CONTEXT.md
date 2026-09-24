# Console API

The public REST API that Console users and API-key clients call to deploy and pay for workloads on Akash. Its deployment, lease and billing docs, and the messages it returns, describe deployments, leases and providers without mentioning the blockchain underneath.

## Language

**Akash Network**:
The platform deployments, bids and leases live on, and the authority on their state.
_Avoid_: chain, blockchain, on chain, ledger

**Deployment update**:
A change to a deployment's manifest version, sent before the new manifest is pushed to its providers.
_Avoid_: broadcast, transaction, tx
