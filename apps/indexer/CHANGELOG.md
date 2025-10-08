

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
