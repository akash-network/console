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

Project is configured to use [Jest](https://jestjs.io/) for testing. It is intended to be covered with unit and functional tests where applicable.

### Running tests

To execute both **unit and functional** tests, run:

```shell
npm test
```

To run **unit** tests exclusively, use:

```shell
npm run test:unit
```

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

Functional tests use the Akash sandbox environment and require wallet credentials. By default, `TestWalletService` generates a unique wallet for each test file, which increases startup time. To improve performance, you can configure a single shared wallet by setting `MASTER_WALLET_MNEMONIC` in `env/.env.functional.test.local`. Simply create a wallet, add its mnemonic to this file, and fund it via the Akash sandbox faucet (https://faucet.sandbox-01.aksh.pw).

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
