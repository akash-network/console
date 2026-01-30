

## [1.24.3](https://github.com/akash-network/console/compare/indexer/v1.24.2...indexer/v1.24.3) (2026-01-30)


### Code Refactoring

* extracts tx signer into a dedicated service ([8a74b7e](https://github.com/akash-network/console/commit/8a74b7e3346e5aee6249a6baeb3e91099db97677))

## [1.24.2](https://github.com/akash-network/console/compare/indexer/v1.24.0...indexer/v1.24.2) (2026-01-30)


### Bug Fixes

* ensure that tsbuild picks proper dependencies for internal packages ([#2596](https://github.com/akash-network/console/issues/2596)) ([c869c78](https://github.com/akash-network/console/commit/c869c78a19e7a6569d62bf1cdd2ab5be0340cdd6))
* replaces fetch API with octokit.getContent ([#2570](https://github.com/akash-network/console/issues/2570)) ([079f0d4](https://github.com/akash-network/console/commit/079f0d4640aa3936d6ef337e46ae4bcb2a8104d4))
* set timestamp setting in env-loader ([#2594](https://github.com/akash-network/console/issues/2594)) ([ab74ab0](https://github.com/akash-network/console/commit/ab74ab03465148ce9761e2f21408f33c6ac1c2e0))


### Code Refactoring

* migrates from webpack to tsup in console-api ([#2547](https://github.com/akash-network/console/issues/2547)) ([43c75c0](https://github.com/akash-network/console/commit/43c75c07282b88c3776545a6134754ab97901734))

## [1.24.1](https://github.com/akash-network/console/compare/indexer/v1.24.0...indexer/v1.24.1) (2026-01-28)


### Bug Fixes

* replaces fetch API with octokit.getContent ([#2570](https://github.com/akash-network/console/issues/2570)) ([079f0d4](https://github.com/akash-network/console/commit/079f0d4640aa3936d6ef337e46ae4bcb2a8104d4))


### Code Refactoring

* migrates from webpack to tsup in console-api ([#2547](https://github.com/akash-network/console/issues/2547)) ([43c75c0](https://github.com/akash-network/console/commit/43c75c07282b88c3776545a6134754ab97901734))

## [1.24.0](https://github.com/akash-network/console/compare/indexer/v1.23.5...indexer/v1.24.0) (2026-01-26)


### Features

* add cache control middleware and improve response handling ([#2565](https://github.com/akash-network/console/issues/2565)) ([2d922ba](https://github.com/akash-network/console/commit/2d922baf2aaced12330c33d75205f1d130d74da1))


### Bug Fixes

* improve address fetching ([#2558](https://github.com/akash-network/console/issues/2558)) ([5f7a629](https://github.com/akash-network/console/commit/5f7a62975663d11872faaba3770d8c0f393c2a1c))
* install sharp lib for image optimization ([#2546](https://github.com/akash-network/console/issues/2546)) ([4790cd6](https://github.com/akash-network/console/commit/4790cd6ff2053229ec6faaad26a7e18d67e60f74))

## [1.23.5](https://github.com/akash-network/console/compare/indexer/v1.23.4...indexer/v1.23.5) (2026-01-22)


### Code Refactoring

* defines explicit exports inside internal packages ([#2551](https://github.com/akash-network/console/issues/2551)) ([71f907f](https://github.com/akash-network/console/commit/71f907fe6b8b85a042bd351ec5b2b3621ba8d89d))

## [1.23.4](https://github.com/akash-network/console/compare/indexer/v1.23.3...indexer/v1.23.4) (2026-01-20)


### Bug Fixes

* improve sql perf ([#2535](https://github.com/akash-network/console/issues/2535)) ([7dcd048](https://github.com/akash-network/console/commit/7dcd0485f1ae0f483ba33ec81f2aae6ec376e1bb))

## [1.23.3](https://github.com/akash-network/console/compare/indexer/v1.23.2...indexer/v1.23.3) (2026-01-19)


### Bug Fixes

* adds otel dependencies to indexer ([#2531](https://github.com/akash-network/console/issues/2531)) ([c2e811a](https://github.com/akash-network/console/commit/c2e811ae26a5ed69ef4c9a4d36d83d426cb710f5))

## [1.23.2](https://github.com/akash-network/console/compare/indexer/v1.23.1...indexer/v1.23.2) (2026-01-17)


### Bug Fixes

* upgrades chain-sdk dependency ([#2508](https://github.com/akash-network/console/issues/2508)) ([adae126](https://github.com/akash-network/console/commit/adae126f86b55250412a93f5a96e7505c0bf36df))

## [1.23.1](https://github.com/akash-network/console/compare/indexer/v1.23.0...indexer/v1.23.1) (2026-01-15)


### Code Refactoring

* migrates some parts of indexer to strict types ([#2504](https://github.com/akash-network/console/issues/2504)) ([fa870d0](https://github.com/akash-network/console/commit/fa870d012ef9118f2b57c77dd5be784626fadace))

## [1.23.0](https://github.com/akash-network/console/compare/indexer/v1.22.2...indexer/v1.23.0) (2026-01-13)


### Features

* **deployment:** implements deploy button flow ([46004d4](https://github.com/akash-network/console/commit/46004d4429dc3b4ebb47bb88edf97cd99b1a0c0f)), closes [#2470](https://github.com/akash-network/console/issues/2470)

## [1.22.2](https://github.com/akash-network/console/compare/indexer/v1.22.1...indexer/v1.22.2) (2025-12-05)


### Bug Fixes

* indexer memory ([#2327](https://github.com/akash-network/console/issues/2327)) ([68a1da0](https://github.com/akash-network/console/commit/68a1da0a2ed3dbd5b308a6a73cd5859b4dbaa36d))

## [1.22.1](https://github.com/akash-network/console/compare/indexer/v1.22.0...indexer/v1.22.1) (2025-12-05)


### Bug Fixes

* ignore multi send tx events ([#2326](https://github.com/akash-network/console/issues/2326)) ([498245d](https://github.com/akash-network/console/commit/498245d3d739d9595dcca1d10134bd9454c74825))

## [1.22.0](https://github.com/akash-network/console/compare/indexer/v1.21.0...indexer/v1.22.0) (2025-11-29)


### Features

* **indexer:** add Cosmos authz message handling to AkashStatsIndexer ([#2287](https://github.com/akash-network/console/issues/2287)) ([104fa88](https://github.com/akash-network/console/commit/104fa88f9ad70bc83d32075ff44f3584047cb4f8))

## [1.21.0](https://github.com/akash-network/console/compare/indexer/v1.20.5...indexer/v1.21.0) (2025-11-17)


### Features

* upgrade Node.js to 24.11.1 LTS ([#2223](https://github.com/akash-network/console/issues/2223)) ([d9feb09](https://github.com/akash-network/console/commit/d9feb090d45408ec9835216bfc5c6fb3f1329abc))


### Bug Fixes

* correct typos and formatting issues ([#2221](https://github.com/akash-network/console/issues/2221)) ([28e7a98](https://github.com/akash-network/console/commit/28e7a98d2a9f8a8cdefb6b538307c1ec4f34cf55))

## [1.20.5](https://github.com/akash-network/console/compare/indexer/v1.20.4...indexer/v1.20.5) (2025-11-06)


### Code Refactoring

* rewrites SQL query to fetch transactions by address ref ([#2149](https://github.com/akash-network/console/issues/2149)) ([8d56cb0](https://github.com/akash-network/console/commit/8d56cb0fb4b67cc82191b368241927ae842745cf))

## [1.20.4](https://github.com/akash-network/console/compare/indexer/v1.20.3...indexer/v1.20.4) (2025-11-06)


### Bug Fixes

* **billing:** onboarding provider filter ([#2160](https://github.com/akash-network/console/issues/2160)) ([07b0a6a](https://github.com/akash-network/console/commit/07b0a6ac629671e044a3d3becd34179cc99a8624))

## [1.20.3](https://github.com/akash-network/console/compare/indexer/v1.20.2...indexer/v1.20.3) (2025-11-05)


### Bug Fixes

* update deployment monitored value checks ([#2146](https://github.com/akash-network/console/issues/2146)) ([f2facda](https://github.com/akash-network/console/commit/f2facda8c054e1ff406355f1049d79d2408986a6))

## [1.20.2](https://github.com/akash-network/console/compare/indexer/v1.20.1...indexer/v1.20.2) (2025-10-29)


### Bug Fixes

* adds ibc types to default registry ([#2132](https://github.com/akash-network/console/issues/2132)) ([9e3c6b0](https://github.com/akash-network/console/commit/9e3c6b0a54e8f958be051e097a05d735f51e2c60))

## [1.20.1](https://github.com/akash-network/console/compare/indexer/v1.20.0...indexer/v1.20.1) (2025-10-27)


### Bug Fixes

* **release:** triggers release  ([cd59471](https://github.com/akash-network/console/commit/cd594718d29ec1f7d1de13071fb2e999b5b8a088))

## [1.20.0](https://github.com/akash-network/console/compare/indexer/v1.19.0...indexer/v1.20.0) (2025-10-27)


### Features

* **analytics:** chain sdk next indexer ([#1983](https://github.com/akash-network/console/issues/1983)) ([dd0600b](https://github.com/akash-network/console/commit/dd0600bee5262ea98304cffcd7e51fc5740ac791))


### Bug Fixes

* upgrade chain-sdk to latest version and adds its transport options in indexer ([#2103](https://github.com/akash-network/console/issues/2103)) ([07ba99a](https://github.com/akash-network/console/commit/07ba99a93bf6fb7a0e67eb1fbd554855e66d322b))
* upgrades cosmjs dependencies and removes unused ones ([#2082](https://github.com/akash-network/console/issues/2082)) ([364f30e](https://github.com/akash-network/console/commit/364f30ee696c477caf7cd8ac6d080f8b933be062)), closes [#1679](https://github.com/akash-network/console/issues/1679)

## [1.19.0](https://github.com/akash-network/console/compare/indexer/v1.18.0...indexer/v1.19.0) (2025-10-17)


### Features

* **network:** adjusts indexer for sdk53 network upgrade ([dfc7d05](https://github.com/akash-network/console/commit/dfc7d05123a52470fb527908c935c1ee12f66da5))

## [1.18.0](https://github.com/akash-network/console/compare/indexer/v1.17.0...indexer/v1.18.0) (2025-10-08)


### Features

* **network:** maps sandbox to sandbox-2 ([e1d32ef](https://github.com/akash-network/console/commit/e1d32ef3e699b9c7fcb95f203b02cdc81752b1fb))

## [1.17.0](https://github.com/akash-network/console/compare/indexer/v1.16.0...indexer/v1.17.0) (2025-10-06)


### Features

* **auth:** implements managed wallet API JWT auth  ([06b4e45](https://github.com/akash-network/console/commit/06b4e4540433b3b55fbc31f76d955e05e040a82e))

## [1.16.0](https://github.com/akash-network/console/compare/indexer/v1.15.1...indexer/v1.16.0) (2025-08-26)


### Features

* adds api background-jobs server setup ([#1833](https://github.com/akash-network/console/issues/1833)) ([d3e6214](https://github.com/akash-network/console/commit/d3e6214800722fafd872a876ddaff0591a6e6dd8))

## [1.15.1](https://github.com/akash-network/console/compare/indexer/v1.15.0...indexer/v1.15.1) (2025-08-25)


### Bug Fixes

* **deployment:** handles invalid manifest errors on POST /v1/leases ([f5da5c4](https://github.com/akash-network/console/commit/f5da5c4b02ef3e2977a8f5855eb5a8b81ac8281b)), closes [#1835](https://github.com/akash-network/console/issues/1835)

## [1.15.0](https://github.com/akash-network/console/compare/indexer/v1.14.0...indexer/v1.15.0) (2025-08-14)


### Features

* enables sentry sourcemaps in deploy-web ([#1800](https://github.com/akash-network/console/issues/1800)) ([f7c83bf](https://github.com/akash-network/console/commit/f7c83bf749199d17e9d9b8cb7c2f7a3413a59887))

## [1.14.0](https://github.com/akash-network/console/compare/indexer/v1.13.4...indexer/v1.14.0) (2025-07-27)


### Features

* adds safe node packages installation ([#1726](https://github.com/akash-network/console/issues/1726)) ([37acfee](https://github.com/akash-network/console/commit/37acfee5c1d053cec2316560ad220992d70b7cbf)), closes [#1549](https://github.com/akash-network/console/issues/1549)

## [1.13.4](https://github.com/akash-network/console/compare/indexer/v1.13.3...indexer/v1.13.4) (2025-07-06)


### Bug Fixes

* ensure next uses app version as sentry release number ([#1634](https://github.com/akash-network/console/issues/1634)) ([68a86d1](https://github.com/akash-network/console/commit/68a86d1f448af8a4ba1d20c76a97f7026664f40c))

## [1.13.3](https://github.com/akash-network/console/compare/indexer/v1.13.2...indexer/v1.13.3) (2025-07-05)


### Bug Fixes

* ignore errors in SQL formatting ([#1630](https://github.com/akash-network/console/issues/1630)) ([ad21ab0](https://github.com/akash-network/console/commit/ad21ab0e8c581db930d6e5987de9492a8d717f6d))

## [1.13.2](https://github.com/akash-network/console/compare/indexer/v1.13.1...indexer/v1.13.2) (2025-06-28)


### Bug Fixes

* upgrades nodejs to higher version ([#1563](https://github.com/akash-network/console/issues/1563)) ([dac08eb](https://github.com/akash-network/console/commit/dac08ebadcc29164eda2e76417ac85ec210ea1b0))

## [1.13.1](https://github.com/akash-network/console/compare/indexer/v1.13.0...indexer/v1.13.1) (2025-06-24)


### Code Refactoring

* run npm audit fix to fix security issues ([#1529](https://github.com/akash-network/console/issues/1529)) ([e00581e](https://github.com/akash-network/console/commit/e00581ef45d97c5dfabbe78688d39e715ff1ffde))

## [1.13.0](https://github.com/akash-network/console/compare/indexer/v1.12.2...indexer/v1.13.0) (2025-06-16)


### Features

* adds feature flags support to console-api's notifications proxy ([#1472](https://github.com/akash-network/console/issues/1472)) ([c663c55](https://github.com/akash-network/console/commit/c663c552cb1d03e38fcf13efc2b89086cf7c4585))

## [1.12.2](https://github.com/akash-network/console/compare/indexer/v1.12.1...indexer/v1.12.2) (2025-06-09)


### Bug Fixes

* fixes e2e tests and adds closeDeployments script ([#1446](https://github.com/akash-network/console/issues/1446)) ([92d7389](https://github.com/akash-network/console/commit/92d73895ff9f8422929365d3e4dfda10f6982796))

## [1.12.1](https://github.com/akash-network/console/compare/indexer/v1.12.0...indexer/v1.12.1) (2025-05-29)


### Bug Fixes

* docker node permissions ([#1410](https://github.com/akash-network/console/issues/1410)) ([073b43a](https://github.com/akash-network/console/commit/073b43aa1f89192bd9f96193f7d721d34840a441))

## 1.12.0 (2025-05-29)


### Features

* add provider stats endpoint ([#402](https://github.com/akash-network/console/issues/402)) ([0570d24](https://github.com/akash-network/console/commit/0570d24a3ffaf14a59f5a234a68572a852a1f8b0))
* **analytics:** add transaction events indexing ([17c7ab1](https://github.com/akash-network/console/commit/17c7ab157eb99280928752fc924e174a09cfe0d8)), closes [#772](https://github.com/akash-network/console/issues/772)
* **billing:** add billing module with trial wallet creation ([d1ca550](https://github.com/akash-network/console/commit/d1ca550ae3d94e08de15f2d329ed6f81d192653b)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet ([164d86b](https://github.com/akash-network/console/commit/164d86b56cb48d9ebb7b7102743d3c3fd363e6f6)), closes [#247](https://github.com/akash-network/console/issues/247)
* **config:** setup doppler env for api ([ed22ad7](https://github.com/akash-network/console/commit/ed22ad7181e12f4e30583be2a9c118596146bf14))
* **console:** add metamask ([#334](https://github.com/akash-network/console/issues/334)) ([bc68df8](https://github.com/akash-network/console/commit/bc68df8fe87c310f406663a73444f918d272422b))
* **console:** add rehypraw to display html for awesome akash templates ([#319](https://github.com/akash-network/console/issues/319)) ([0014109](https://github.com/akash-network/console/commit/00141098408668a542d65b77cf6084de9070ee7c))
* **console:** managed wallets popup confirmation ([#342](https://github.com/akash-network/console/issues/342)) ([c7d16d6](https://github.com/akash-network/console/commit/c7d16d6a0d942cef8e64c6978d9ff565a0336c0d))
* **deployment:** implement plain linux deployment page ([6da5565](https://github.com/akash-network/console/commit/6da5565c049ab9f9debace6e42ec976347b6b3a0)), closes [#227](https://github.com/akash-network/console/issues/227)
* **deployment:** implements custodial deployments top up data collection ([108f073](https://github.com/akash-network/console/commit/108f0736359cc866bb9aa01e3935105c413c8aae)), closes [#39](https://github.com/akash-network/console/issues/39)
* **env:** implement unified file loading in console-web ([12f282a](https://github.com/akash-network/console/commit/12f282aa2798d9597a9f950520fb19d174cb635e)), closes [#313](https://github.com/akash-network/console/issues/313)
* **env:** unify app configs for api and indexer, update doc ([f3f7df4](https://github.com/akash-network/console/commit/f3f7df486e0feabdd672e3d7776c7dab49cde90d)), closes [#313](https://github.com/akash-network/console/issues/313)
* finish console rebrand ([#259](https://github.com/akash-network/console/issues/259)) ([ae272e8](https://github.com/akash-network/console/commit/ae272e81dc5bcadf6f8c8114514f2fee30d6e135))
* implement npm workspaces  ([#208](https://github.com/akash-network/console/issues/208)) ([c403dc1](https://github.com/akash-network/console/commit/c403dc155b9b213f5ba043d92ee1967e0b133fe3))
* **indexer:** track provider persistent storage ([1762ba6](https://github.com/akash-network/console/commit/1762ba6658b15c8a2f57c6b5871f2423eb8105b3))
* jwt provider schema ([#1312](https://github.com/akash-network/console/issues/1312)) ([379a2d3](https://github.com/akash-network/console/commit/379a2d3ceb519e8b49c75373b8aa7a4a735bf599))
* merge "Upload SDL" to "Build your template" and add "Plain Linux" template ([#244](https://github.com/akash-network/console/issues/244)) ([0edf499](https://github.com/akash-network/console/commit/0edf4992b6e01f6243ab226f2666ec4e05c312e4))
* **notifications:** adds basic alerts service ([5d4d6fc](https://github.com/akash-network/console/commit/5d4d6fcf23ceb2b317453a001d4043855df5c5d1))
* provider deployments on provider console ([#416](https://github.com/akash-network/console/issues/416)) ([62374e1](https://github.com/akash-network/console/commit/62374e15d4e02ffa9f44080a2d41a676b403d70b))
* **release:** implement release with image build ([a9fa7e8](https://github.com/akash-network/console/commit/a9fa7e80b373af4ca90438292f582e661680fb2d))
* shared packages ([#237](https://github.com/akash-network/console/issues/237)) ([bd79006](https://github.com/akash-network/console/commit/bd79006abff3ee2d06657269ddd0e76d1554f275))
* support other denoms in monitored value checks ([#471](https://github.com/akash-network/console/issues/471)) ([cdfa9e9](https://github.com/akash-network/console/commit/cdfa9e91f4a400739b37af620c6a4139d98c90d0))
* upgrade nodejs version to 22.14 (latest lts) ([#1095](https://github.com/akash-network/console/issues/1095)) ([8533b35](https://github.com/akash-network/console/commit/8533b355762016829c4435fd67c7885df79b251e))
* **user:** add user api keys schema + api ([2eac7e9](https://github.com/akash-network/console/commit/2eac7e97246f63570bdd7d9d9700438e99948c7f)), closes [#787](https://github.com/akash-network/console/issues/787)
* **user:** save last ip, user-agent and fingerprint on users ([4663cae](https://github.com/akash-network/console/commit/4663cae6209f59e990a7115c8d1f45516e672340)), closes [#499](https://github.com/akash-network/console/issues/499)
* **wallet:** improve fiat payments ux ([295e085](https://github.com/akash-network/console/commit/295e08542deb57634de624c5815e1e7127333a16)), closes [#411](https://github.com/akash-network/console/issues/411)


### Bug Fixes

* **deployment:** validate max deposit amount correctly ([44c0274](https://github.com/akash-network/console/commit/44c02745635510b8b5eb6bb4f9462b232543f393)), closes [#603](https://github.com/akash-network/console/issues/603)
* disables nodejs auto family selection ([#1212](https://github.com/akash-network/console/issues/1212)) ([c6be104](https://github.com/akash-network/console/commit/c6be104cf583a07d20fb9f92661ffa29e23b492a))
* **dx:** fix e2e tests ([9ab53ef](https://github.com/akash-network/console/commit/9ab53eff42a43c4f02757b4b19aa5877f25c366e)), closes [#741](https://github.com/akash-network/console/issues/741)
* ensure apps build consistently in docker and locally ([f4dbd88](https://github.com/akash-network/console/commit/f4dbd88a886d683062eebd7495375bff0bd4aa54)), closes [#209](https://github.com/akash-network/console/issues/209)
* ensure release can detect changes for apps based on local packages ([#1070](https://github.com/akash-network/console/issues/1070)) ([e1053c4](https://github.com/akash-network/console/commit/e1053c456ba718fc58a93799e550e9338d9aea45))
* ensure that akash prebuilt templates exist in the final docker image ([#1020](https://github.com/akash-network/console/issues/1020)) ([2a940a3](https://github.com/akash-network/console/commit/2a940a349a85182f88fb8a83990bf3a78b0bab3f))
* ensures provider-proxy has valid blockchain API_URL on sandbox env ([#1032](https://github.com/akash-network/console/issues/1032)) ([325461e](https://github.com/akash-network/console/commit/325461e684a547669ac9765a3ac378ceadb86ee1))
* **env:** convert all env vars to SCREAMING_CASE from camelCase ([#335](https://github.com/akash-network/console/issues/335)) ([1e892ee](https://github.com/akash-network/console/commit/1e892ee5f469800955b72dacee096d4d5777bc6a))
* fallbacks to `local` if DEPLOYMENT_ENV is not specified ([#1029](https://github.com/akash-network/console/issues/1029)) ([f9bc424](https://github.com/akash-network/console/commit/f9bc4242900c58b0bd519e5c755616aedccfb71b))
* indexer readme ([#1407](https://github.com/akash-network/console/issues/1407)) ([0394c72](https://github.com/akash-network/console/commit/0394c72ad322c8c5aa0e5994578062bc49e553b8))
* **indexer:** add missing v1beta4 support for MsgWithdrawLease ([9142058](https://github.com/akash-network/console/commit/91420581712284e92d4f249b8affa1651c4ff5d6))
* **indexer:** fix env var uppercase ([5fb6826](https://github.com/akash-network/console/commit/5fb6826b4c896eda8d7b11bcad09c6507493ff0e))
* **indexer:** handle larger values in message's amount ([dea8aa6](https://github.com/akash-network/console/commit/dea8aa60f0cc2586c598e01360e0322865fac23e))
* **indexer:** set grpc keepalive interval to 5min ([303b11d](https://github.com/akash-network/console/commit/303b11d0edb31fae9b1d86c96fe4b398a3720426))
* **observability:** make sure otl data is added to logs ([820870d](https://github.com/akash-network/console/commit/820870d43203ddec5d3cd101d5c46b4b67e1d16d))
* **provider:** do not cache bad connections ([#1195](https://github.com/akash-network/console/issues/1195)) ([8fe8c5a](https://github.com/akash-network/console/commit/8fe8c5a5828306e72a57fc16ab42f120a8ca44f3)), closes [#671](https://github.com/akash-network/console/issues/671)
* **provider:** fix indexing of provider attribute unsign txs ([#508](https://github.com/akash-network/console/issues/508)) ([274495d](https://github.com/akash-network/console/commit/274495d298a1980d5f432c65576fb9a2d85b42bd))
* recreate GRPC channel when creating client ([#1264](https://github.com/akash-network/console/issues/1264)) ([07f220b](https://github.com/akash-network/console/commit/07f220b4c28df374c2753b3e758345c249c0a784)), closes [#671](https://github.com/akash-network/console/issues/671)
* **release:** adds notifications to docker setup  ([6951faf](https://github.com/akash-network/console/commit/6951faf46850643515757c7c16c328bbf622fa76))
* **release:** builds notifications image w/o nginx ([d68bf9a](https://github.com/akash-network/console/commit/d68bf9a94c118aa65656e15924163ba9d54a4e2b))
* **template:** eliminates eternal loop when query if failing  ([ca93b51](https://github.com/akash-network/console/commit/ca93b5123725394094aada5149811de548717d94))
* typos in documentation files ([07a7858](https://github.com/akash-network/console/commit/07a7858d950fe5bb0a438e7205213a107c67874a))
* updates dockerfile for node apps ([#1068](https://github.com/akash-network/console/issues/1068)) ([54194a0](https://github.com/akash-network/console/commit/54194a08ca514f1be623a20e7a01cfbbf2e2244a))
* use string type for message amount & predictedClosedHeight ([6aab530](https://github.com/akash-network/console/commit/6aab530a0709bba834ce9b5bd55203ec22172033))
* use string type for tx fee ([a1a19ff](https://github.com/akash-network/console/commit/a1a19ffef42de8fb2ada2f27753caae534792572))


### Code Refactoring

* adds warmUpTemplatesCache script ([#962](https://github.com/akash-network/console/issues/962)) ([46b37eb](https://github.com/akash-network/console/commit/46b37eb632dc6da429da94b599160b2e587980c9))
* **api:** remove user address code from api ([57111b8](https://github.com/akash-network/console/commit/57111b82e57cd86d6bc25e59e5d0087bea84fcde))
* **dx:** fix linting issues ([1115a60](https://github.com/akash-network/console/commit/1115a609ba6a080e4c91331f45fb0d12b48c5504))
* enable eslint rules which restricts what dependencies can be used ([#1074](https://github.com/akash-network/console/issues/1074)) ([509fcd3](https://github.com/akash-network/console/commit/509fcd39831311950afdfb51c189ef46b02c855f))
* **forms:** zod form validation and components ([#283](https://github.com/akash-network/console/issues/283)) ([3b8279d](https://github.com/akash-network/console/commit/3b8279d3b7e6f2f1160c26383a04cf775140f1b5))
* **http:** extract http services to the package ([8196b4a](https://github.com/akash-network/console/commit/8196b4a0ff6503e9c057c9aea4409054cb4fc970)), closes [#247](https://github.com/akash-network/console/issues/247)
* migrates database package to strict types ([#954](https://github.com/akash-network/console/issues/954)) ([4a63a63](https://github.com/akash-network/console/commit/4a63a631367728ab3558d7d42ca581b9a5d545b5))
* moves trial authorization spending out of db transaction ([#1129](https://github.com/akash-network/console/issues/1129)) ([8c8e372](https://github.com/akash-network/console/commit/8c8e3729ce7c1f7ad2c387b471b326f1fbc0d353))
* refactors services in console-web to strict types ([#1004](https://github.com/akash-network/console/issues/1004)) ([fd85685](https://github.com/akash-network/console/commit/fd85685858b64ead49a946955fe8da48ea9cc49b))
* removes sentry from console-api ([#1220](https://github.com/akash-network/console/issues/1220)) ([8339158](https://github.com/akash-network/console/commit/8339158321771e716cddd7de4242d7de370697d0))
* simplifies api dbs config and removes redundant connections ([#759](https://github.com/akash-network/console/issues/759)) ([7cdbf6e](https://github.com/akash-network/console/commit/7cdbf6eca0ae13dfcb18d4cdeb10351ef9f7760b))
* **stats:** improve perf of gpu pricing endpoint ([#521](https://github.com/akash-network/console/issues/521)) ([6797e97](https://github.com/akash-network/console/commit/6797e976119d0282a7bdcb323fd7867ce7c13ca5))
* uses logger and http sdk from local pkgs for notification service ([fe3539b](https://github.com/akash-network/console/commit/fe3539b5995aca4f88fe281da5ac282779ee3f8e))


### Performance Improvements

* improve provider snapshot indexes ([63f5eea](https://github.com/akash-network/console/commit/63f5eeab8fb25e7bd26312a5f9cd38daa68852bf))
