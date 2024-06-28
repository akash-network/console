# Cloudmos Indexer

- [How to run](#how-to-run)
- [Environment Variables](#environment-variables)
- [Scheduled Tasks](#scheduled-tasks)
- [Data Flow](#data-flow)
- [Indexers](#indexers)
- [Create a new indexer](#create-a-new-indexer)
- [Block Cache Structure](#block-cache-structure)

## How to run

1. Make sure you have a valid [Akash database](../README.md#how-to-run) first.
2. Create a `.env` file with the necessary [environment variables](#environment-variables).
3. Run `npm install` to install dependencies.
4. Start the app with `npm start`.

You can make sure the api is working by accessing the status endpoint: `http://localhost:3079/status`

## Environment Variables

|Name|Value|Note|
|-|-|-
HealthchecksEnabled|`true` or `false`|Specify if the [Scheduler](./src/index.ts#L42) should send health check pings.
SentryDSN|ex: `"https://1234...789@z645.ingest.sentry.io/1234"`|[Sentry DSN](https://docs.sentry.io/product/sentry-basics/dsn-explainer/) used when [initializing](./src/index.ts#L25) Sentry
HealthChecks_SyncBlocks|ex: `041b2561-be28-4a36-bb3f-36a68f86224e`|[HealthChecks.io](https://healthchecks.io) check ID for the `SyncBlocks` task.
HealthChecks_SyncAKTPriceHistory|ex: `041b2561-be28-4a36-bb3f-36a68f86224e`|[HealthChecks.io](https://healthchecks.io) check ID for the `SyncAKTPriceHistory` task.
HealthChecks_SyncProviderInfo|ex: `041b2561-be28-4a36-bb3f-36a68f86224e`|[HealthChecks.io](https://healthchecks.io) check ID for the `SyncProviderInfo` task.
HealthChecks_SyncKeybaseInfo|ex: `041b2561-be28-4a36-bb3f-36a68f86224e`|[HealthChecks.io](https://healthchecks.io) check ID for the `SyncKeybaseInfo` task.
AkashDatabaseCS|ex: `postgres://user:password@localhost:5432/cloudmos-akash`|Akash Database Connection String
ActiveChain|ex: `akash`|Chain code from [chainDefinitions.ts](../shared/chainDefinitions.ts)
KeepCache|`true` or `false`|Specify if the [block & block response cache](#block-cache-structure) should be kept on drive. Takes a lot of space, but allow rebuilding the database without redownloading every blocks.
Standby|`true` or `false`|If `true`, indexer will not start. Useful for stopping an indexer deployed on akash without needing to close the lease.
DataFolder|ex: `./data/`|Directory where block cache and node statuses should be saved. Defaults to `./data/`.

## Scheduled Tasks

In the [startScheduler](./src/index.ts#L80) method we register all the task that must run at an interval.  
The [scheduler](./src/scheduler.ts) is responsible for running the different tasks at the correct interval and keeping track of any errors that may occurs.  
Tasks can be configured to report their execution to healthcheck endpoints automatically ([healthchecks.io](https://healthchecks.io/) or [sentry.io](https://docs.sentry.io/product/crons/))

|Task|Interval|Description  
|-|-|-|
|[Sync Price History](./src/db/priceHistoryProvider.ts#L12)|1 hour|Responsible for fetching the latest token price information from CoinGecko.
|[Sync Providers Info](./src/providers/providerStatusProvider.ts#L11)|15 minutes| Responsible for querying the `/status` endpoint of every akash provider to track their uptime and available resources.
|[Provider IP Lookup](./src/providers/ipLocationProvider.ts#25)|30 minutes|Responsible for updating the akash providers location based on the node's ip address.
|[Sync Keybase Info](./src/db/keybaseProvider.ts#L5)|6 hours|Responsible for fetching validator names and picture from [keybase.io](https://keybase.io/).|
|[Address Balance Monitor](./src/monitors/addressBalanceMonitor.ts#L6)|10 minutes|Responsible for updating tracked address balances  (**Blockspy Specific**)
|[Deployment Balance Monitor](./src/monitors/deploymentBalanceMonitor.ts#L7)|10 minutes|Responsible for updating tracked deployment balances.  This is **blockspy specific** and not used in the deploy tool.
[Sync Blocks](./src/chain/chainSync.ts#L77)|7 seconds|Responsible for downloading new blocks and passing them through the correct indexers.

## Data Flow

![Index Data Flow](../indexer-flow.drawio.png)

### **Step #1 - Download Blocks**

Using our [nodeAccessor](./src/chain/nodeAccessor.ts) missing blocks are downloaded from RPC nodes. A list of rpc node is setup in the [chainDefinition](../shared/chainDefinitions.ts#L39) file and their status is then kept updated (earliest/latest available block, rate limiting, etc). The blocks are saved on disk inside a leveldb database (see [File Structure](#block-cache-structure)).

*See [downloadBlocks()](./src/chain/chainSync.ts#L302).*

### **Step #2 - Insert Blocks**

Blocks are parsed and inserted into their corresponding tables with basic information (block,transaction,message). The `isProcessed` flag is set to false marking them for processing.

*See [insertBlocks()](./src/chain/chainSync.ts#L150).*

### **Step #3 - Processing**

The processing step loops through blocks that have not been processed yet and run [indexers](#indexers). For every messages it will run any message handler that needs to be run for this message type. Then the [afterEveryBlock](#create-a-new-indexer) and [afterEveryTransaction](#create-a-new-indexer) hooks are executed and the `isProcessed` flags are set to `true`.

*See [processMessages()](./src/chain/statsProcessor.ts)*

## Indexers

Indexers are defined in the `/src/indexers` directory. Some are cosmos generic and some are akash specific. See [Create a new indexer](#create-a-new-indexer) for more info on how to add a new indexer.

- [Validator Indexer](./src/indexers/validatorIndexer.ts) is used to keep track of validator informations. It listens to `MsgCreateValidator` and `MsgEditValidator` validators and keep track of the every on-chain details about a validator.
- [Message Addresses Indexer](./src/indexers/messageAdressesIndexer.ts) is used to keep track of addresses involved in a transaction. This includes every tx signers and sender/receiver of tokens. In the case of token movement this also saves the transferred amount on the message entity.
- [Akash Stats Indexer](./src/indexers/akashStatsIndexer.ts) is used to track every akash specific stats.
  - Bids
  - Leases
  - Deployments
  - Providers

## Create a new indexer

To track a new data point based on incoming blocks you need to create a new indexer file and extand the `Indexer` class.

Here are the properties/methods that can be overriden:

- `msgHandlers` - Property mapping msg type (ex: `/akash.market.v1beta1.MsgCreateLease`) to a message handler. During syncing the message handlers will be called with the decoded message, the height and the Message db entity.
- `initCache()` - Can be used to load data in cache before syncing. It will be called once at each start of the application.
- `createTables()/dropTables()` - This is for initializing the tables associated with your indexer. It will be called when creating or recreating the database only.
- `seed()` - Used to index data from the genesis file. Will be called with the parsed genesis file once when syncing a new chain from block 1.
- `afterEveryBlock()` - Called after every new blocks with the current block info and the previous block info.
- `afterEveryTransaction()` - Called after every new transactions with the raw decoded tx object and the Transaction db entity.

## Block Cache Structure

### /data/[chain]/

- `blockResults.db` - [LevelDB Database](https://github.com/Level/level) containing block results infomation from RPC nodes
- `blocks.db` - [LevelDB Database](https://github.com/Level/level) containing block infomation from RPC nodes
- `genesis.json` - If syncing from block 1 the chain's [genesis file](https://github.com/akash-network/net/blob/master/mainnet/genesis.json) will be downloaded here.
- `nodeStatus.json` - Saved status of every rpc node so that invalid/rate limited nodes are remembered after a restart (if there is persistent storage)
