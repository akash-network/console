# Console API

- [Environment Variables](#environment-variables)
- [How to run](#how-to-run)


## How to run

1. Make sure you have a valid [Akash database](../README.md#how-to-run) first.
2. Make sure you have a valid User database. If the user database is empty, the necessary tables will be created automatically.
3. Create a `.env` file with the necessary [environment variables](#environment-variables).
4. Run `npm install` to install dependencies.
5. Start the app with `npm start`.

You can make sure the api is working by accessing the status endpoint: `http://localhost:3080/status`

## Testing

The API uses [Vitest](https://vitest.dev/) for unit, integration, and functional tests.

### Running tests

To execute unit, integration, and functional tests, run:

```shell
npm test
```

To run **unit** tests exclusively, use:

```shell
npm run test:unit
```

This runs both `unit` and `unit-isolated`. When invoking Vitest directly, use
`--project='unit*'` to include both projects.

Ordinary unit tests share workers and their module cache. Tests that mock modules
or register on the root `tsyringe` container belong in
`test/isolated-unit-tests.json`; ESLint checks this boundary. A shared test may
still use `container.createChildContainer()`, since the child is discarded with
the test. Prefer constructing the subject with mocked dependencies. Restore any
shared application state changed by a test. The shared setup restores Vitest
spies, environment stubs, global stubs, and real timers after each file.

To check for dependencies on test order, run:

```shell
npm run test:unit -- --maxWorkers=1 --sequence.shuffle --sequence.seed=42
```

Database tests clone migration-specific templates. Old templates remain available
for concurrent runs on other branches and are removed when the local test cluster
is reset. Use PostgreSQL's UTC timezone to match CI.

To run only **functional** tests, use:

```shell
npm run test:functional
```

#### Watch Mode

To automatically re-run tests upon any changes, use the following watch mode commands:

```shell
npm test:watch
npm run test:unit:watch
npm run test:functional:watch
```

#### Collecting Coverage

To collect and view test coverage, use the following commands:

```shell
npm test:coverage
npm run test:unit:coverage
npm run test:functional:coverage
```

### Contributing to Tests

**Unit Tests**: Focus on testing individual functions and components in isolation, without external dependencies.

**Test File Structure**: For consistency, each component tested with unit tests should reside in its own directory, named after the component. Place the test file alongside the component, suffixed with .spec. For example:

**Functional Tests**: Aim to evaluate the system's behavior as a whole, including endpoints, workers, and workflows. Place functional tests in the `test/functional` directory.

```
src/
  components/
    myComponent/
      myComponent.ts
      myComponent.spec.ts
```

#### Functional Tests Wallet

Functional tests use the Akash sandbox environment and require wallet credentials. By default, `TestWalletService` generates a unique wallet for each test file, which increases startup time. To improve performance, you can configure a single shared wallet by setting `MASTER_WALLET_MNEMONIC` in `env/.env.functional.test.local`. Simply create a wallet, add its mnemonic to this file, and fund it via the Akash sandbox faucet (https://faucet.sandbox-2.aksh.pw).

## Assistant knowledge

The in-app assistant's `search_docs` tool answers from two sources: the Console notes in `src/feedback/lib/assistant-knowledge/assistant-knowledge-pack.ts`, and a curated part of the [Akash skill](https://github.com/akash-network/akash-skill) (MIT) in `akash-skill-knowledge.gen.ts` next to it. Don't edit the generated file by hand.

`src/feedback/lib/akash-skill-curation/akash-skill-curation-manifest.ts` pins the skill version and commit, and lists the sections to keep, the corrections to apply for Console, and the guards that reject outdated or non-Console guidance (`uakt` pricing, escrow deposits, CLI and self-custody flows, the old bid screening shape).

To move to a newer skill version:

1. Set `version` and `commit` in the manifest to the new release tag and its commit (`gh api repos/akash-network/akash-skill/git/ref/tags/<tag>`).
2. Run `npm run knowledge:refresh`. It fetches the selected files at that commit and rewrites the generated file. To try an unpublished version first, pass a local checkout: `npm run knowledge:refresh -- /path/to/akash-skill`.
3. If it fails, it lists every section that is missing, too long, or trips a guard. Update the section headings, add a correction, or drop the section, then run it again.
4. Review the diff of the generated file, bump `ASSISTANT_KNOWLEDGE_PACK_VERSION`, and run the unit tests and `npm run eval:assistant` (needs `AKASHML_API_KEY`).

## Changes from **beta** to **v1** (February 2024)

### Api Versioning

The public api version will now be included in the url like so: console-api.akash.network/**v1**/\<endpoint>

Changes that are backward compatible like adding a new endpoint will be done in the existing version.
Changes that are **not** backward compatible, such as removing an endpoint, will be done in a new version. When releasing a new version, a list of breaking changes will be made available. We will keep the old version available for a while to give users enough time to migrate their applications to the latest version.

### Swagger Documentation

A swagger documentation is now available at https://console-api.akash.network/v1/swagger. You can use it to see the list of available endpoints and try them directly in your browser.

### Route Changes

The `/api` prefix was removed from every public endpoints and instead the version should be used (ex: `/v1/<endpoint>`)

Here is a list of endpoints that have changed in this release. Old endpoints will temporarily redirect to the new ones. In future releases, the [versioning system](#api-versioning) will be used instead of redirects.

| Old                                                        | New                                                               |
| ---------------------------------------------------------- | ----------------------------------------------------------------- |
| `/dashboardData`                                           | `/dashboard-data`                                                 |
| `/getNetworkCapacity`                                      | `/network-capacity`                                               |
| `/getMainnetNodes`                                         | `/nodes/mainnet`                                                  |
| `/getSandboxNodes`                                         | `/nodes/sandbox`                                                  |
| `/getTestnetNodes`                                         | `/nodes/testnet`                                                  |
| `/getProviderAttributesSchema`                             | `/provider-attributes-schema`                                     |
| `/getMainnetVersion`                                       | `/version/mainnet`                                                |
| `/getSandboxVersion`                                       | `/version/sandbox`                                                |
| `/getTestnetVersion`                                       | `/version/testnet`                                                |
| `/getProviderGraphData/<dataName>`                         | `/provider-graph-data/<dataName>`                                 |
| `/getProviderActiveLeasesGraphData/<address>`              | `/provider-active-leases-graph-data/<address>`                    |
| `/getGraphData/<dataName>`                                 | `/graph-data/<dataName>`                                          |
| `/marketData`                                              | `/market-data`                                                    |
| `/predicted-block-date/<height>/<blockWindow>`             | `/predicted-block-date/<height>?blockWindow=<blockWindow>`        |
| `/predicted-date-height/<timestamp>/<blockWindow>`         | `/predicted-date-height/<timestamp>?blockWindow=<blockWindow>`    |
| `/providers/<provider>/deployments/<skip>/<take>/<status>` | `/providers/<provider>/deployments/<skip>/<take>?status=<status>` |

### CosmosSDK
Target version: 53
