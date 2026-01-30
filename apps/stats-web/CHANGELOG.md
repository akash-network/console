

## [1.13.5](https://github.com/akash-network/console/compare/stats-web/v1.13.4...stats-web/v1.13.5) (2026-01-30)


### Bug Fixes

* ensure that tsbuild picks proper dependencies for internal packages ([#2596](https://github.com/akash-network/console/issues/2596)) ([c869c78](https://github.com/akash-network/console/commit/c869c78a19e7a6569d62bf1cdd2ab5be0340cdd6))
* set timestamp setting in env-loader ([#2594](https://github.com/akash-network/console/issues/2594)) ([ab74ab0](https://github.com/akash-network/console/commit/ab74ab03465148ce9761e2f21408f33c6ac1c2e0))

## [1.13.4](https://github.com/akash-network/console/compare/stats-web/v1.13.3...stats-web/v1.13.4) (2026-01-28)


### Bug Fixes

* replaces fetch API with octokit.getContent ([#2570](https://github.com/akash-network/console/issues/2570)) ([079f0d4](https://github.com/akash-network/console/commit/079f0d4640aa3936d6ef337e46ae4bcb2a8104d4))


### Code Refactoring

* migrates from webpack to tsup in console-api ([#2547](https://github.com/akash-network/console/issues/2547)) ([43c75c0](https://github.com/akash-network/console/commit/43c75c07282b88c3776545a6134754ab97901734))

## [1.13.3](https://github.com/akash-network/console/compare/stats-web/v1.13.2...stats-web/v1.13.3) (2026-01-26)


### Bug Fixes

* install sharp lib for image optimization ([#2546](https://github.com/akash-network/console/issues/2546)) ([4790cd6](https://github.com/akash-network/console/commit/4790cd6ff2053229ec6faaad26a7e18d67e60f74))

## [1.13.2](https://github.com/akash-network/console/compare/stats-web/v1.13.0...stats-web/v1.13.2) (2026-01-22)


### Bug Fixes

* passes required vars for stats-web sentry to work ([#2554](https://github.com/akash-network/console/issues/2554)) ([2073e9f](https://github.com/akash-network/console/commit/2073e9fdc809259c0227fced997b455287b36061))


### Code Refactoring

* defines explicit exports inside internal packages ([#2551](https://github.com/akash-network/console/issues/2551)) ([71f907f](https://github.com/akash-network/console/commit/71f907fe6b8b85a042bd351ec5b2b3621ba8d89d))

## [1.13.1](https://github.com/akash-network/console/compare/stats-web/v1.13.0...stats-web/v1.13.1) (2026-01-22)


### Bug Fixes

* passes required vars for stats-web sentry to work ([#2554](https://github.com/akash-network/console/issues/2554)) ([2073e9f](https://github.com/akash-network/console/commit/2073e9fdc809259c0227fced997b455287b36061))


### Code Refactoring

* defines explicit exports inside internal packages ([#2551](https://github.com/akash-network/console/issues/2551)) ([71f907f](https://github.com/akash-network/console/commit/71f907fe6b8b85a042bd351ec5b2b3621ba8d89d))

## [1.13.0](https://github.com/akash-network/console/compare/stats-web/v1.12.1...stats-web/v1.13.0) (2026-01-20)


### Features

* **stats:** add Sentry observability with distributed tracing ([#2530](https://github.com/akash-network/console/issues/2530)) ([1a42dd4](https://github.com/akash-network/console/commit/1a42dd4fc9dc540a86bf23ce43b4520556c1ef56))

## [1.12.1](https://github.com/akash-network/console/compare/stats-web/v1.12.0...stats-web/v1.12.1) (2026-01-17)


### Bug Fixes

* add proper logging for ssr ([#2502](https://github.com/akash-network/console/issues/2502)) ([563a7bb](https://github.com/akash-network/console/commit/563a7bbb61917c4070ba654fec7716212e2e1bee))
* upgrades chain-sdk dependency ([#2508](https://github.com/akash-network/console/issues/2508)) ([adae126](https://github.com/akash-network/console/commit/adae126f86b55250412a93f5a96e7505c0bf36df))

## [1.12.0](https://github.com/akash-network/console/compare/stats-web/v1.11.0...stats-web/v1.12.0) (2026-01-13)


### Features

* **deployment:** implements deploy button flow ([46004d4](https://github.com/akash-network/console/commit/46004d4429dc3b4ebb47bb88edf97cd99b1a0c0f)), closes [#2470](https://github.com/akash-network/console/issues/2470)

## [1.11.0](https://github.com/akash-network/console/compare/stats-web/v1.10.5...stats-web/v1.11.0) (2026-01-08)


### Features

* improve stats app styling similar to console ([#2461](https://github.com/akash-network/console/issues/2461)) ([273c8dc](https://github.com/akash-network/console/commit/273c8dc2a31234c33c241547a3db3a9575b510db))
* **observability:** forward client IP headers in stats-web to API requests  ([7b23468](https://github.com/akash-network/console/commit/7b23468a25385c11e6b51fd560c9336e11116ec5))

## [1.10.5](https://github.com/akash-network/console/compare/stats-web/v1.10.4...stats-web/v1.10.5) (2026-01-06)


### Bug Fixes

* add global-error handling ([#2456](https://github.com/akash-network/console/issues/2456)) ([08fedde](https://github.com/akash-network/console/commit/08feddea144d416a32e5f25593ce5f899be8cade))

## [1.10.4](https://github.com/akash-network/console/compare/stats-web/v1.10.3...stats-web/v1.10.4) (2026-01-06)


### Bug Fixes

* stats web styling + instrumentation ([#2454](https://github.com/akash-network/console/issues/2454)) ([e12b74a](https://github.com/akash-network/console/commit/e12b74a2a732de91bd78b4a52e54101813e8a9c6))

## [1.10.3](https://github.com/akash-network/console/compare/stats-web/v1.10.2...stats-web/v1.10.3) (2026-01-05)


### Bug Fixes

* add healthz endpoint for stats ([#2450](https://github.com/akash-network/console/issues/2450)) ([3b8c7a0](https://github.com/akash-network/console/commit/3b8c7a01d8fff344bfd8a1db61c6b9929ec55451))

## [1.10.2](https://github.com/akash-network/console/compare/stats-web/v1.10.1...stats-web/v1.10.2) (2025-12-29)


### Code Refactoring

* enables serializers in logger by default for browser ([#2424](https://github.com/akash-network/console/issues/2424)) ([dccb96d](https://github.com/akash-network/console/commit/dccb96d6c41f87e06775c38215d248f867d7b596))

## [1.10.1](https://github.com/akash-network/console/compare/stats-web/v1.10.0...stats-web/v1.10.1) (2025-12-23)


### Bug Fixes

* **billing:** auto credit reload ui and setting update ([#2409](https://github.com/akash-network/console/issues/2409)) ([d0f0fb8](https://github.com/akash-network/console/commit/d0f0fb8c3247b4c29aba50cd7ec2ae6b2fa6854e))

## [1.10.0](https://github.com/akash-network/console/compare/stats-web/v1.9.1...stats-web/v1.10.0) (2025-12-18)


### Features

* adds forget password form to embedded login page ([#2372](https://github.com/akash-network/console/issues/2372)) ([cd51331](https://github.com/akash-network/console/commit/cd51331e9bb2089de69751f527ca565512477d9b))
* update frontend styling and theme ([#2331](https://github.com/akash-network/console/issues/2331)) ([0ae3a55](https://github.com/akash-network/console/commit/0ae3a557181a0eecaa3cdcf27d48513c0c09f79f))

## [1.9.1](https://github.com/akash-network/console/compare/stats-web/v1.9.0...stats-web/v1.9.1) (2025-12-12)


### Bug Fixes

* upgrades nextjs to latest 14.x ([#2345](https://github.com/akash-network/console/issues/2345)) ([46d0b23](https://github.com/akash-network/console/commit/46d0b2315f7aed4dabdc31f75dac964f43a4264d))

## [1.9.0](https://github.com/akash-network/console/compare/stats-web/v1.8.0...stats-web/v1.9.0) (2025-12-11)


### Features

* adds api for password authentication via auth0 ([#2333](https://github.com/akash-network/console/issues/2333)) ([f8d2a9a](https://github.com/akash-network/console/commit/f8d2a9a9136c688bc07d503e4042687bb54c3949))

## [1.8.0](https://github.com/akash-network/console/compare/stats-web/v1.7.0...stats-web/v1.8.0) (2025-12-09)


### Features

* account overview, auto reload, and separate payment method page  ([46b0a99](https://github.com/akash-network/console/commit/46b0a99e66be7beab0e1908f687cece6880aa268)), closes [#1779](https://github.com/akash-network/console/issues/1779)

## [1.7.0](https://github.com/akash-network/console/compare/stats-web/v1.6.0...stats-web/v1.7.0) (2025-12-05)


### Features

* **observability:** wraps jobs handlers into otel context and logs jobId ([1f55f3f](https://github.com/akash-network/console/commit/1f55f3fefb7c6a88d66cc58ad6f8807d5bc10558))

## [1.6.0](https://github.com/akash-network/console/compare/stats-web/v1.5.1...stats-web/v1.6.0) (2025-11-29)


### Features

* adds CF-Ray to our application logging ([#2288](https://github.com/akash-network/console/issues/2288)) ([b2e8f53](https://github.com/akash-network/console/commit/b2e8f53df36468021743ca041e2430eb021b437a))

## [1.5.1](https://github.com/akash-network/console/compare/stats-web/v1.5.0...stats-web/v1.5.1) (2025-11-28)


### Code Refactoring

* removes chainNetwork parameter when communicate to provider-proxy ([#2250](https://github.com/akash-network/console/issues/2250)) ([e8fdcfb](https://github.com/akash-network/console/commit/e8fdcfb55cfa178c505b7e6872681fe9e7572f98)), closes [#2189](https://github.com/akash-network/console/issues/2189)

## [1.5.0](https://github.com/akash-network/console/compare/stats-web/v1.4.0...stats-web/v1.5.0) (2025-11-23)


### Features

* add maintenance page stats app ([#2270](https://github.com/akash-network/console/issues/2270)) ([1678bba](https://github.com/akash-network/console/commit/1678bba791c9e8af903e2c1451362e0c31211cc8))

## [1.4.0](https://github.com/akash-network/console/compare/stats-web/v1.3.0...stats-web/v1.4.0) (2025-11-20)


### Features

* adds generic banner to stats-web ([#2265](https://github.com/akash-network/console/issues/2265)) ([d63afef](https://github.com/akash-network/console/commit/d63afef1dbb1c7ceeac227d2a2ded3eb02ba99d9))

## [1.3.0](https://github.com/akash-network/console/compare/stats-web/v1.2.0...stats-web/v1.3.0) (2025-11-17)


### Features

* upgrade Node.js to 24.11.1 LTS ([#2223](https://github.com/akash-network/console/issues/2223)) ([d9feb09](https://github.com/akash-network/console/commit/d9feb090d45408ec9835216bfc5c6fb3f1329abc))


### Bug Fixes

* convert provider AxiosError to HTTP errors in provider service ([#2207](https://github.com/akash-network/console/issues/2207)) ([b9a6436](https://github.com/akash-network/console/commit/b9a64369ec35ba933fa097f88db8b7d1385b296a))

## [1.2.0](https://github.com/akash-network/console/compare/stats-web/v1.1.2...stats-web/v1.2.0) (2025-11-07)


### Features

* **onboarding:** welcome step create deployment ([#2170](https://github.com/akash-network/console/issues/2170)) ([47c2a91](https://github.com/akash-network/console/commit/47c2a91aea877d4a06ea7953b20f3fa31151b0dd))

## [1.1.2](https://github.com/akash-network/console/compare/stats-web/v1.1.1...stats-web/v1.1.2) (2025-11-06)


### Code Refactoring

* rewrites SQL query to fetch transactions by address ref ([#2149](https://github.com/akash-network/console/issues/2149)) ([8d56cb0](https://github.com/akash-network/console/commit/8d56cb0fb4b67cc82191b368241927ae842745cf))

## [1.1.1](https://github.com/akash-network/console/compare/stats-web/v1.1.0...stats-web/v1.1.1) (2025-11-06)


### Bug Fixes

* **billing:** onboarding provider filter ([#2160](https://github.com/akash-network/console/issues/2160)) ([07b0a6a](https://github.com/akash-network/console/commit/07b0a6ac629671e044a3d3becd34179cc99a8624))
* **billing:** refill trial wallets for non-anonymous ([#2147](https://github.com/akash-network/console/issues/2147)) ([24d06d3](https://github.com/akash-network/console/commit/24d06d31bfa30ab38cd28599772e83a3b3c8083c))

## [1.1.0](https://github.com/akash-network/console/compare/stats-web/v1.0.5...stats-web/v1.1.0) (2025-11-05)


### Features

* add otel namespace to logging package ([#2075](https://github.com/akash-network/console/issues/2075)) ([557321a](https://github.com/akash-network/console/commit/557321a4a85144383e43fb35d28527649a396213))

## [1.0.5](https://github.com/akash-network/console/compare/stats-web/v1.0.4...stats-web/v1.0.5) (2025-11-01)


### Code Refactoring

* sanitizes invalid UTF characters to prevent Loki crashes ([#2143](https://github.com/akash-network/console/issues/2143)) ([d339437](https://github.com/akash-network/console/commit/d3394371dc86791b8dc1f9abfba72c7d873f17fd))

## [1.0.4](https://github.com/akash-network/console/compare/stats-web/v1.0.3...stats-web/v1.0.4) (2025-10-29)


### Bug Fixes

* remove mapping from deposit detail sources because it shows numbers ([#2134](https://github.com/akash-network/console/issues/2134)) ([fd47387](https://github.com/akash-network/console/commit/fd4738703b17c376226056ef04e9f052942c5952))

## [1.0.3](https://github.com/akash-network/console/compare/stats-web/v1.0.2...stats-web/v1.0.3) (2025-10-29)


### Bug Fixes

* add logging batching client ([#2128](https://github.com/akash-network/console/issues/2128)) ([8bca2c8](https://github.com/akash-network/console/commit/8bca2c899af898da657b7f44de24323262962572))
* akashnet twitter handle ([#2125](https://github.com/akash-network/console/issues/2125)) ([10b4d28](https://github.com/akash-network/console/commit/10b4d280eac5173661688805841499314e8e1cc8))

## [1.0.2](https://github.com/akash-network/console/compare/stats-web/v1.0.1...stats-web/v1.0.2) (2025-10-28)


### Bug Fixes

* **deployment:** map denom ([#2120](https://github.com/akash-network/console/issues/2120)) ([5da7421](https://github.com/akash-network/console/commit/5da74215ccd3a1027da48283a3353f74de1502b8))

## [1.0.1](https://github.com/akash-network/console/compare/stats-web/v1.0.0...stats-web/v1.0.1) (2025-10-27)


### Bug Fixes

* **release:** triggers release  ([cd59471](https://github.com/akash-network/console/commit/cd594718d29ec1f7d1de13071fb2e999b5b8a088))

## [1.0.0](https://github.com/akash-network/console/compare/stats-web/v0.40.1...stats-web/v1.0.0) (2025-10-27)


### ⚠ BREAKING CHANGES

* removes GET /v1/version/{network}

* feat!(network): uses meta.json instead of version.txt and removes GET /v1/version/{network} ([46841af](https://github.com/akash-network/console/commit/46841af26f8510d18ce941240c49610caef642a4)), closes [#2091](https://github.com/akash-network/console/issues/2091)


### Features

* chain sdk next web ([#2050](https://github.com/akash-network/console/issues/2050)) ([1bc10ea](https://github.com/akash-network/console/commit/1bc10ea201360054e53d65a21f845f22d842352b))


### Bug Fixes

* **config:** handles absent nodes/versions files ([b41833f](https://github.com/akash-network/console/commit/b41833fa5267398700b02b0924fce42e4407ae88))
* name and right button link to deployment page, not the whole line ([3ea1f04](https://github.com/akash-network/console/commit/3ea1f0433cac42d13ce80d5c8e092519da423963)), closes [#1981](https://github.com/akash-network/console/issues/1981)
* network store mapping ([#2057](https://github.com/akash-network/console/issues/2057)) ([6b4a9db](https://github.com/akash-network/console/commit/6b4a9dbc888803586f1ac38d985671a853313405))
* upgrade chain-sdk to latest version and adds its transport options in indexer ([#2103](https://github.com/akash-network/console/issues/2103)) ([07ba99a](https://github.com/akash-network/console/commit/07ba99a93bf6fb7a0e67eb1fbd554855e66d322b))
* upgrades cosmjs dependencies and removes unused ones ([#2082](https://github.com/akash-network/console/issues/2082)) ([364f30e](https://github.com/akash-network/console/commit/364f30ee696c477caf7cd8ac6d080f8b933be062)), closes [#1679](https://github.com/akash-network/console/issues/1679)
* uses formatDistanceToNow instead of differenceInX to calc time left ([#2112](https://github.com/akash-network/console/issues/2112)) ([bb25b00](https://github.com/akash-network/console/commit/bb25b0087073410b1c21550d330ac6d9b73ce106))

## [0.40.1](https://github.com/akash-network/console/compare/stats-web/v0.40.0...stats-web/v0.40.1) (2025-10-21)


### Bug Fixes

* checkbox can optionally have a larger clickable wrapper  ([e3c51dd](https://github.com/akash-network/console/commit/e3c51ddd7e1fa25d5933ad4dd5b8b58d9ac23a34)), closes [#1981](https://github.com/akash-network/console/issues/1981)
* **observability:** adds fatal method to the logger ([d89872c](https://github.com/akash-network/console/commit/d89872cd2824310a7a332e41ee8a42657c196b6e)), closes [#2087](https://github.com/akash-network/console/issues/2087)

## [0.40.0](https://github.com/akash-network/console/compare/stats-web/v0.39.1...stats-web/v0.40.0) (2025-10-17)


### Features

* displays blockchain upgrade/down banners in stats-web/deploy-web ([#2060](https://github.com/akash-network/console/issues/2060)) ([22312bf](https://github.com/akash-network/console/commit/22312bfba67626dbadd01a6e2db58c5074ab437c)), closes [#1924](https://github.com/akash-network/console/issues/1924)
* **network:** adjusts indexer for sdk53 network upgrade ([dfc7d05](https://github.com/akash-network/console/commit/dfc7d05123a52470fb527908c935c1ee12f66da5))


### Bug Fixes

* adjusts maintenance message based on app ([#2072](https://github.com/akash-network/console/issues/2072)) ([a67be97](https://github.com/akash-network/console/commit/a67be979c9577271ca194481b3613476f7070b7c))

## [0.39.1](https://github.com/akash-network/console/compare/stats-web/v0.39.0...stats-web/v0.39.1) (2025-10-14)


### Code Refactoring

* simplifies multiple trx version support ([#2052](https://github.com/akash-network/console/issues/2052)) ([ebe8897](https://github.com/akash-network/console/commit/ebe88970a986aa3a692cce4cd78fda78c475934e))

## [0.39.0](https://github.com/akash-network/console/compare/stats-web/v0.38.0...stats-web/v0.39.0) (2025-10-08)


### Features

* **network:** maps sandbox to sandbox-2 ([e1d32ef](https://github.com/akash-network/console/commit/e1d32ef3e699b9c7fcb95f203b02cdc81752b1fb))

## [0.38.0](https://github.com/akash-network/console/compare/stats-web/v0.37.1...stats-web/v0.38.0) (2025-10-06)


### Features

* **auth:** implements managed wallet API JWT auth  ([06b4e45](https://github.com/akash-network/console/commit/06b4e4540433b3b55fbc31f76d955e05e040a82e))

## [0.37.1](https://github.com/akash-network/console/compare/stats-web/v0.37.0...stats-web/v0.37.1) (2025-10-01)


### Bug Fixes

* proxy build script ([#1987](https://github.com/akash-network/console/issues/1987)) ([7c0a504](https://github.com/akash-network/console/commit/7c0a5041d4618171563bdb7e6ce82e8cb93f4d7c))

## [0.37.0](https://github.com/akash-network/console/compare/stats-web/v0.36.2...stats-web/v0.37.0) (2025-09-30)


### Features

* disable some features when blockchain is down ([#1971](https://github.com/akash-network/console/issues/1971)) ([64d5bef](https://github.com/akash-network/console/commit/64d5befefc09479a09d5e1a829c9004ab2d6470e))

## [0.36.2](https://github.com/akash-network/console/compare/stats-web/v0.36.1...stats-web/v0.36.2) (2025-09-26)


### Code Refactoring

* network version is now taken from /net package in network-store ([#1966](https://github.com/akash-network/console/issues/1966)) ([61dc080](https://github.com/akash-network/console/commit/61dc08057419270e50d1b9ceed2f82331429e974))

## [0.36.1](https://github.com/akash-network/console/compare/stats-web/v0.36.0...stats-web/v0.36.1) (2025-09-15)


### Bug Fixes

* sync email_verified from auth0 on demand  ([436e41a](https://github.com/akash-network/console/commit/436e41a6a1dc2c39552192d2ae648b011ccb44e2))

## [0.36.0](https://github.com/akash-network/console/compare/stats-web/v0.35.0...stats-web/v0.36.0) (2025-08-28)


### Features

* **billing:** implement charges csv export  ([cbb3570](https://github.com/akash-network/console/commit/cbb3570a50876908c01006582a930590cf87f87d))

## [0.35.0](https://github.com/akash-network/console/compare/stats-web/v0.34.1...stats-web/v0.35.0) (2025-08-26)


### Features

* adds api background-jobs server setup ([#1833](https://github.com/akash-network/console/issues/1833)) ([d3e6214](https://github.com/akash-network/console/commit/d3e6214800722fafd872a876ddaff0591a6e6dd8))

## [0.34.1](https://github.com/akash-network/console/compare/stats-web/v0.34.0...stats-web/v0.34.1) (2025-08-25)


### Bug Fixes

* **deployment:** handles invalid manifest errors on POST /v1/leases ([f5da5c4](https://github.com/akash-network/console/commit/f5da5c4b02ef3e2977a8f5855eb5a8b81ac8281b)), closes [#1835](https://github.com/akash-network/console/issues/1835)

## [0.34.0](https://github.com/akash-network/console/compare/stats-web/v0.33.0...stats-web/v0.34.0) (2025-08-18)


### Features

* **auth:** enhance API key management with new hooks and tests ([#1813](https://github.com/akash-network/console/issues/1813)) ([ebfcbbe](https://github.com/akash-network/console/commit/ebfcbbe50812fb683e5e43136bb4147da85e75a9))


### Bug Fixes

* make date range picker scrollable if it overflows container ([ac6f2a8](https://github.com/akash-network/console/commit/ac6f2a87cea5eecfe5696c15af38bec09027087a))

## [0.33.0](https://github.com/akash-network/console/compare/stats-web/v0.32.1...stats-web/v0.33.0) (2025-08-14)


### Features

* enables sentry sourcemaps in deploy-web ([#1800](https://github.com/akash-network/console/issues/1800)) ([f7c83bf](https://github.com/akash-network/console/commit/f7c83bf749199d17e9d9b8cb7c2f7a3413a59887))

## [0.32.1](https://github.com/akash-network/console/compare/stats-web/v0.32.0...stats-web/v0.32.1) (2025-08-04)


### Code Refactoring

* switch http services in deploy-web to fetch API ([#1775](https://github.com/akash-network/console/issues/1775)) ([c6d1105](https://github.com/akash-network/console/commit/c6d110544bff4eb422954bcce8dd007e795e1213)), closes [#1423](https://github.com/akash-network/console/issues/1423)

## [0.32.0](https://github.com/akash-network/console/compare/stats-web/v0.31.0...stats-web/v0.32.0) (2025-07-31)


### Features

* **billing:** add stripe charges table list to usage ui  ([81e9d42](https://github.com/akash-network/console/commit/81e9d42d254bee6248451aecde8868ccbf018d89))
* **deployment:** implement trial deployment badge ([#1764](https://github.com/akash-network/console/issues/1764)) ([3e2fdae](https://github.com/akash-network/console/commit/3e2fdaee9f03bb95235f1f3171665111004807f8))

## [0.31.0](https://github.com/akash-network/console/compare/stats-web/v0.30.0...stats-web/v0.31.0) (2025-07-27)


### Features

* adds safe node packages installation ([#1726](https://github.com/akash-network/console/issues/1726)) ([37acfee](https://github.com/akash-network/console/commit/37acfee5c1d053cec2316560ad220992d70b7cbf)), closes [#1549](https://github.com/akash-network/console/issues/1549)

## [0.30.0](https://github.com/akash-network/console/compare/stats-web/v0.29.0...stats-web/v0.30.0) (2025-07-16)


### Features

* add calendar and date-range-picker ui components ([cc96f0f](https://github.com/akash-network/console/commit/cc96f0f71ea9078f39775623144058785b745e6c))
* **billing:** add usage ui ([77b5d42](https://github.com/akash-network/console/commit/77b5d42aaf4e153a6fe9f6723567520434f3d25b))

## [0.29.0](https://github.com/akash-network/console/compare/stats-web/v0.28.6...stats-web/v0.29.0) (2025-07-08)


### Features

* adds error code to collected error stack ([#1595](https://github.com/akash-network/console/issues/1595)) ([fef764f](https://github.com/akash-network/console/commit/fef764f8de77d501e7d0a136b5a9b5692d71d2ad))

## [0.28.6](https://github.com/akash-network/console/compare/stats-web/v0.28.5...stats-web/v0.28.6) (2025-07-06)


### Bug Fixes

* ensure next uses app version as sentry release number ([#1634](https://github.com/akash-network/console/issues/1634)) ([68a86d1](https://github.com/akash-network/console/commit/68a86d1f448af8a4ba1d20c76a97f7026664f40c))

## [0.28.5](https://github.com/akash-network/console/compare/stats-web/v0.28.4...stats-web/v0.28.5) (2025-07-05)


### Bug Fixes

* ignore errors in SQL formatting ([#1630](https://github.com/akash-network/console/issues/1630)) ([ad21ab0](https://github.com/akash-network/console/commit/ad21ab0e8c581db930d6e5987de9492a8d717f6d))

## [0.28.4](https://github.com/akash-network/console/compare/stats-web/v0.28.3...stats-web/v0.28.4) (2025-07-04)


### Code Refactoring

* replaces direct dep on axios to injected via useServices one ([#1622](https://github.com/akash-network/console/issues/1622)) ([dfb52ae](https://github.com/akash-network/console/commit/dfb52ae5f154c854aaf9b9cfa4d1ef25892bce31))

## [0.28.3](https://github.com/akash-network/console/compare/stats-web/v0.28.2...stats-web/v0.28.3) (2025-06-28)


### Bug Fixes

* updates @akashnetwork/akashjs ([#1575](https://github.com/akash-network/console/issues/1575)) ([ae86837](https://github.com/akash-network/console/commit/ae868378ae35db3342ff5d44f9d270644178c507))
* upgrades nodejs to higher version ([#1563](https://github.com/akash-network/console/issues/1563)) ([dac08eb](https://github.com/akash-network/console/commit/dac08ebadcc29164eda2e76417ac85ec210ea1b0))

## [0.28.2](https://github.com/akash-network/console/compare/stats-web/v0.28.1...stats-web/v0.28.2) (2025-06-26)


### Bug Fixes

* ensure getAllItems doesn't stuck inside infinite loop ([#1562](https://github.com/akash-network/console/issues/1562)) ([f8a8ba2](https://github.com/akash-network/console/commit/f8a8ba277f5b8b8cd25d1c4a831d0642e9505557))

## [0.28.1](https://github.com/akash-network/console/compare/stats-web/v0.28.0...stats-web/v0.28.1) (2025-06-26)


### Bug Fixes

* makes axios not to throw on 400 error for getting deployment ([#1552](https://github.com/akash-network/console/issues/1552)) ([f85947e](https://github.com/akash-network/console/commit/f85947efd64ac4b566f020d9a4691ab092fb46ab))

## [0.28.0](https://github.com/akash-network/console/compare/stats-web/v0.27.0...stats-web/v0.28.0) (2025-06-17)


### Features

* adds possibility to pass multiple env variables into Env variable popup ([#1501](https://github.com/akash-network/console/issues/1501)) ([9f7c89e](https://github.com/akash-network/console/commit/9f7c89e1c4363fe80b5d5ddeeef1bd0e4f0d2faf))

## [0.27.0](https://github.com/akash-network/console/compare/stats-web/v0.26.0...stats-web/v0.27.0) (2025-06-16)


### Features

* adds feature flags support to console-api's notifications proxy ([#1472](https://github.com/akash-network/console/issues/1472)) ([c663c55](https://github.com/akash-network/console/commit/c663c552cb1d03e38fcf13efc2b89086cf7c4585))

## [0.26.0](https://github.com/akash-network/console/compare/stats-web/v0.25.3...stats-web/v0.26.0) (2025-06-11)


### Features

* **billing:** stripe integration ([#1443](https://github.com/akash-network/console/issues/1443)) ([85c046b](https://github.com/akash-network/console/commit/85c046b1f7286b6c5fea41251712b3e89f413163))

## [0.25.3](https://github.com/akash-network/console/compare/stats-web/v0.25.2...stats-web/v0.25.3) (2025-06-11)


### Code Refactoring

* move /v1/leases-duration/{owner} to modules ([#1440](https://github.com/akash-network/console/issues/1440)) ([605bb55](https://github.com/akash-network/console/commit/605bb55060546974c4c32970c6572d8b315533bd)), closes [#1280](https://github.com/akash-network/console/issues/1280)

## [0.25.2](https://github.com/akash-network/console/compare/stats-web/v0.25.1...stats-web/v0.25.2) (2025-06-09)


### Bug Fixes

* fixes e2e tests and adds closeDeployments script ([#1446](https://github.com/akash-network/console/issues/1446)) ([92d7389](https://github.com/akash-network/console/commit/92d73895ff9f8422929365d3e4dfda10f6982796))

## [0.25.1](https://github.com/akash-network/console/compare/stats-web/v0.25.0...stats-web/v0.25.1) (2025-05-29)


### Bug Fixes

* docker node permissions ([#1410](https://github.com/akash-network/console/issues/1410)) ([073b43a](https://github.com/akash-network/console/commit/073b43aa1f89192bd9f96193f7d721d34840a441))

## [0.25.0](https://github.com/akash-network/console/compare/stats-web/v0.24.3...stats-web/v0.25.0) (2025-05-28)


### Features

* **contact-point:** implements list ui ([b9d8c24](https://github.com/akash-network/console/commit/b9d8c24eb826897a4462949503b30ef6134a3bc7))

## [0.24.3](https://github.com/akash-network/console/compare/stats-web/v0.24.2...stats-web/v0.24.3) (2025-05-28)


### Bug Fixes

* **notifications:** improves interface loading and deps management  ([c9cd03a](https://github.com/akash-network/console/commit/c9cd03aa67a5e62ac43edcc9f819600e5e179dce))

## [0.24.2](https://github.com/akash-network/console/compare/stats-web/v0.24.1...stats-web/v0.24.2) (2025-05-27)


### Bug Fixes

* **release:** builds notifications image w/o nginx ([d68bf9a](https://github.com/akash-network/console/commit/d68bf9a94c118aa65656e15924163ba9d54a4e2b))

## [0.24.1](https://github.com/akash-network/console/compare/stats-web/v0.24.0...stats-web/v0.24.1) (2025-05-26)


### Bug Fixes

* **release:** adds notifications to docker setup  ([6951faf](https://github.com/akash-network/console/commit/6951faf46850643515757c7c16c328bbf622fa76))

## [0.24.0](https://github.com/akash-network/console/compare/stats-web/v0.23.0...stats-web/v0.24.0) (2025-05-21)


### Features

* **contact-point:** implements unleash feature flagging and contact creation ui ([6ad02ce](https://github.com/akash-network/console/commit/6ad02ce382dc76b9d317aa3934416da3605ad53b))
* **styling:** improve sidebar ([#1344](https://github.com/akash-network/console/issues/1344)) ([77e88dd](https://github.com/akash-network/console/commit/77e88dd9a61b0d38ded8e108a58a6de093a29de7))

## [0.23.0](https://github.com/akash-network/console/compare/stats-web/v0.22.6...stats-web/v0.23.0) (2025-05-16)


### Features

* jwt provider schema ([#1312](https://github.com/akash-network/console/issues/1312)) ([379a2d3](https://github.com/akash-network/console/commit/379a2d3ceb519e8b49c75373b8aa7a4a735bf599))

## [0.22.6](https://github.com/akash-network/console/compare/stats-web/v0.22.5...stats-web/v0.22.6) (2025-05-15)


### Code Refactoring

* **notifications:** implement modular configuration architecture ([ead91e4](https://github.com/akash-network/console/commit/ead91e4fdc04a799b32f0d9725bcb62fbaeeb8fd))

## [0.22.5](https://github.com/akash-network/console/compare/stats-web/v0.22.4...stats-web/v0.22.5) (2025-05-10)


### Code Refactoring

* uses logger and http sdk from local pkgs for notification service ([fe3539b](https://github.com/akash-network/console/commit/fe3539b5995aca4f88fe281da5ac282779ee3f8e))

## [0.22.4](https://github.com/akash-network/console/compare/stats-web/v0.22.3...stats-web/v0.22.4) (2025-05-01)


### Code Refactoring

* **authorization:** use react-table for deployment grants  ([cfd28ab](https://github.com/akash-network/console/commit/cfd28aba79a349f17293a669f8104b8565db8e8d)), closes [#595](https://github.com/akash-network/console/issues/595)

## [0.22.3](https://github.com/akash-network/console/compare/stats-web/v0.22.2...stats-web/v0.22.3) (2025-04-17)


### Bug Fixes

* ensure SSR initiated request forward real client ip ([#1210](https://github.com/akash-network/console/issues/1210)) ([4fb0427](https://github.com/akash-network/console/commit/4fb0427c295141c572ff0b3c2d8874feadaa2590))


### Code Refactoring

* removes sentry from console-api ([#1220](https://github.com/akash-network/console/issues/1220)) ([8339158](https://github.com/akash-network/console/commit/8339158321771e716cddd7de4242d7de370697d0))

## [0.22.2](https://github.com/akash-network/console/compare/stats-web/v0.22.1...stats-web/v0.22.2) (2025-04-15)


### Bug Fixes

* disables nodejs auto family selection ([#1212](https://github.com/akash-network/console/issues/1212)) ([c6be104](https://github.com/akash-network/console/commit/c6be104cf583a07d20fb9f92661ffa29e23b492a))

## [0.22.1](https://github.com/akash-network/console/compare/stats-web/v0.22.0...stats-web/v0.22.1) (2025-04-01)


### Bug Fixes

* adds google tag manger id to stats-web config ([#1150](https://github.com/akash-network/console/issues/1150)) ([49bb3d8](https://github.com/akash-network/console/commit/49bb3d8e6aa76f638f4909a3215e196f97296585))

## [0.22.0](https://github.com/akash-network/console/compare/stats-web/v0.21.0...stats-web/v0.22.0) (2025-03-31)


### Features

* **deployment:** managed wallet api update deployment ([#1093](https://github.com/akash-network/console/issues/1093)) ([6998834](https://github.com/akash-network/console/commit/699883436cc1763a20f65cce17390403107b179a))
* upgrade nodejs version to 22.14 (latest lts) ([#1095](https://github.com/akash-network/console/issues/1095)) ([8533b35](https://github.com/akash-network/console/commit/8533b355762016829c4435fd67c7885df79b251e))


### Code Refactoring

* moves trial authorization spending out of db transaction ([#1129](https://github.com/akash-network/console/issues/1129)) ([8c8e372](https://github.com/akash-network/console/commit/8c8e3729ce7c1f7ad2c387b471b326f1fbc0d353))

## 0.21.0 (2025-03-26)


### Features

* adds support for logging error cause ([#1064](https://github.com/akash-network/console/issues/1064)) ([6cd48e6](https://github.com/akash-network/console/commit/6cd48e6eb8ce7eb2c899d2f97f7154ee72e8a3e2))
* adds support for logging error cause ([#1064](https://github.com/akash-network/console/issues/1064)) ([#1066](https://github.com/akash-network/console/issues/1066)) ([ef8d604](https://github.com/akash-network/console/commit/ef8d60447f98e699189c852b8d18f173458386ec))
* **analytics:** integrates amplitude ([c88ff59](https://github.com/akash-network/console/commit/c88ff59c19c0096916afa3774b2d15a1bd30d3eb))
* **auth:** implement verification email re-send and rework relevant UI ([#676](https://github.com/akash-network/console/issues/676)) ([c2de6a6](https://github.com/akash-network/console/commit/c2de6a6f92dbb44b1758836f2a42de8eb81f4c94)), closes [#663](https://github.com/akash-network/console/issues/663)
* **billing:** add billing module with trial wallet creation ([d1ca550](https://github.com/akash-network/console/commit/d1ca550ae3d94e08de15f2d329ed6f81d192653b)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet ([164d86b](https://github.com/akash-network/console/commit/164d86b56cb48d9ebb7b7102743d3c3fd363e6f6)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet top up ([04f5aad](https://github.com/akash-network/console/commit/04f5aad51079bea8c8d58c2147c78598b5bb409d)), closes [#247](https://github.com/akash-network/console/issues/247)
* **config:** extract date constants to a dedicated config ([0663a12](https://github.com/akash-network/console/commit/0663a12a9e4eeb465dae8ed566c9ed86ac287725)), closes [#163](https://github.com/akash-network/console/issues/163) [#313](https://github.com/akash-network/console/issues/313)
* **config:** extract denom constants to a dedicated config ([c3e761e](https://github.com/akash-network/console/commit/c3e761e9fb4523f4527f86704d9bf238fafa4b2f)), closes [#163](https://github.com/akash-network/console/issues/163) [#313](https://github.com/akash-network/console/issues/313)
* **config:** replace api url definitions with env var configs ([6cf640d](https://github.com/akash-network/console/commit/6cf640dccba598deeb229fd4e2110e1d7e412270)), closes [#163](https://github.com/akash-network/console/issues/163) [#313](https://github.com/akash-network/console/issues/313)
* **config:** replace network ids constants with imports from network store ([149c1b5](https://github.com/akash-network/console/commit/149c1b5abfd5dfcbaf6db714f5bdb05b23c9748c)), closes [#163](https://github.com/akash-network/console/issues/163) [#313](https://github.com/akash-network/console/issues/313)
* **config:** replace network management with network store package ([3d804d5](https://github.com/akash-network/console/commit/3d804d5b4f332dd702fb1be346c593bfb6c6ff71)), closes [#163](https://github.com/akash-network/console/issues/163) [#313](https://github.com/akash-network/console/issues/313)
* **config:** setup doppler env for api ([ed22ad7](https://github.com/akash-network/console/commit/ed22ad7181e12f4e30583be2a9c118596146bf14))
* **console:** add metamask ([#334](https://github.com/akash-network/console/issues/334)) ([bc68df8](https://github.com/akash-network/console/commit/bc68df8fe87c310f406663a73444f918d272422b))
* **console:** balance authz deployments ([#359](https://github.com/akash-network/console/issues/359)) ([abdb18a](https://github.com/akash-network/console/commit/abdb18a42af81e7e1724b7afbe8eb2b898b47f41))
* **console:** managed wallets popup confirmation ([#342](https://github.com/akash-network/console/issues/342)) ([c7d16d6](https://github.com/akash-network/console/commit/c7d16d6a0d942cef8e64c6978d9ff565a0336c0d))
* **deployment:** ensure there's sufficient fees allowance on cleanup ([fbbec68](https://github.com/akash-network/console/commit/fbbec68e3e430f41ab12424a5ffb47aff059a79d))
* **deployment:** implement ato top up setting ([1301314](https://github.com/akash-network/console/commit/130131485a68f699587415f96283e0dc83072502)), closes [#412](https://github.com/akash-network/console/issues/412)
* **deployment:** implement clean up of managed deployments ([882fac4](https://github.com/akash-network/console/commit/882fac457f91d968bd9ecd3129c9a2113c3dd0bf)), closes [#395](https://github.com/akash-network/console/issues/395)
* **deployment:** implement plain linux deployment page ([6da5565](https://github.com/akash-network/console/commit/6da5565c049ab9f9debace6e42ec976347b6b3a0)), closes [#227](https://github.com/akash-network/console/issues/227)
* **deployment:** implements custodial deployments top up data collection ([108f073](https://github.com/akash-network/console/commit/108f0736359cc866bb9aa01e3935105c413c8aae)), closes [#39](https://github.com/akash-network/console/issues/39)
* **deployment:** improve new deployment page ([3ffc38b](https://github.com/akash-network/console/commit/3ffc38b2e942f11fc1ab11624aaa653745de6637)), closes [#444](https://github.com/akash-network/console/issues/444)
* displays first lease service uri on deployment list if deployment name is unknown and small UX improvements ([#924](https://github.com/akash-network/console/issues/924)) ([f3e9b8d](https://github.com/akash-network/console/commit/f3e9b8d96878fab4cc89c37a2ad7747ab844c1b1))
* **env:** implement unified file loading in console-web ([12f282a](https://github.com/akash-network/console/commit/12f282aa2798d9597a9f950520fb19d174cb635e)), closes [#313](https://github.com/akash-network/console/issues/313)
* extract custom components ([#256](https://github.com/akash-network/console/issues/256)) ([2d3e889](https://github.com/akash-network/console/commit/2d3e8898f5d6e081f49da3ae5892023317f0b6e7))
* extract UI components shadcn ([#239](https://github.com/akash-network/console/issues/239)) ([f2da963](https://github.com/akash-network/console/commit/f2da963b4b56e6e006959216f35ca8cd7a4fb4f6))
* finish console rebrand ([#259](https://github.com/akash-network/console/issues/259)) ([ae272e8](https://github.com/akash-network/console/commit/ae272e81dc5bcadf6f8c8114514f2fee30d6e135))
* implement npm workspaces  ([#208](https://github.com/akash-network/console/issues/208)) ([c403dc1](https://github.com/akash-network/console/commit/c403dc155b9b213f5ba043d92ee1967e0b133fe3))
* improve provider leases graph ([#246](https://github.com/akash-network/console/issues/246)) ([f5fe74e](https://github.com/akash-network/console/commit/f5fe74e15d6b3d7fbccb28de141451ced5336823))
* improves error logging for AggregateError ([#1072](https://github.com/akash-network/console/issues/1072)) ([c0ca85c](https://github.com/akash-network/console/commit/c0ca85c13b608457e65b8e90dad2d6cc310dd643))
* introduce multi-line commands ([e58349b](https://github.com/akash-network/console/commit/e58349b7eeb5f28adc80dbedd4cf3b5ca304b72f)), closes [#175](https://github.com/akash-network/console/issues/175)
* merge "Upload SDL" to "Build your template" and add "Plain Linux" template ([#244](https://github.com/akash-network/console/issues/244)) ([0edf499](https://github.com/akash-network/console/commit/0edf4992b6e01f6243ab226f2666ec4e05c312e4))
* **network:** extract network store into a package ([608a16d](https://github.com/akash-network/console/commit/608a16dfd12e5beca628e3169a8fc6ea1c5d12c2))
* **notifications:** adds basic alerts service ([5d4d6fc](https://github.com/akash-network/console/commit/5d4d6fcf23ceb2b317453a001d4043855df5c5d1))
* **observability:** ensure logger can be configured in browser ([9ac2fdb](https://github.com/akash-network/console/commit/9ac2fdb58d182413378d67e900d0dc2f2dd14746)), closes [#430](https://github.com/akash-network/console/issues/430)
* **observability:** implements client side logging configuration ([da9923e](https://github.com/akash-network/console/commit/da9923eebe673cbdddc475a80a1c2d272dad383e)), closes [#436](https://github.com/akash-network/console/issues/436)
* **observability:** utilise new logger in stats-web ([62aefe3](https://github.com/akash-network/console/commit/62aefe30a501b6f5fe9ac65b64e1a40a5a8d4d1b)), closes [#436](https://github.com/akash-network/console/issues/436)
* **package:** extract logger into packages ([bac463b](https://github.com/akash-network/console/commit/bac463b4f4f18ef73a630d69eba7355cb20d4643)), closes [#429](https://github.com/akash-network/console/issues/429)
* provider deployments on provider console ([#416](https://github.com/akash-network/console/issues/416)) ([62374e1](https://github.com/akash-network/console/commit/62374e15d4e02ffa9f44080a2d41a676b403d70b))
* **provider:** new provider trial endpoint ([2712e38](https://github.com/akash-network/console/commit/2712e380b8f5af0930abbdf9347a1dee3eb75f8a)), closes [#488](https://github.com/akash-network/console/issues/488)
* **provider:** provider pricing feature ([#475](https://github.com/akash-network/console/issues/475)) ([14d73fa](https://github.com/akash-network/console/commit/14d73fa4c3b099e9d530db76949394e16557aa73))
* **release:** implement release with image build ([a9fa7e8](https://github.com/akash-network/console/commit/a9fa7e80b373af4ca90438292f582e661680fb2d))
* shared packages ([#237](https://github.com/akash-network/console/issues/237)) ([bd79006](https://github.com/akash-network/console/commit/bd79006abff3ee2d06657269ddd0e76d1554f275))
* **stats:** improve stats app resiliency ([34dbbf1](https://github.com/akash-network/console/commit/34dbbf14b75d5ef2cc97a4f634a8401955070c4e))
* **wallet:** improve coupon codes ux ([#1028](https://github.com/akash-network/console/issues/1028)) ([b4a81c7](https://github.com/akash-network/console/commit/b4a81c79b97213ae72d37efe4771129f5b69b5ef))
* **wallet:** improve fiat payments ux ([295e085](https://github.com/akash-network/console/commit/295e08542deb57634de624c5815e1e7127333a16)), closes [#411](https://github.com/akash-network/console/issues/411)


### Bug Fixes

* **config:** stats app use client improvements ([b7537fc](https://github.com/akash-network/console/commit/b7537fc4a469a05d5fb78110aa991bcbb0bb1365)), closes [#703](https://github.com/akash-network/console/issues/703)
* **deploy-web:** fixed error handling for transaction page ([#213](https://github.com/akash-network/console/issues/213)) ([a006e03](https://github.com/akash-network/console/commit/a006e03ad7a18679eee1d0870dec724f3a632d84))
* **deployment:** managed wallet user template ([ab83f2f](https://github.com/akash-network/console/commit/ab83f2f699e84b3a4f90739d2d003a9f8e9d27aa)), closes [#483](https://github.com/akash-network/console/issues/483)
* **deployment:** managed walllet fixes ([#382](https://github.com/akash-network/console/issues/382)) ([4a43483](https://github.com/akash-network/console/commit/4a4348390c56d0f2794b6689cf19ef84edaf9c54))
* **deployment:** validate max deposit amount correctly ([44c0274](https://github.com/akash-network/console/commit/44c02745635510b8b5eb6bb4f9462b232543f393)), closes [#603](https://github.com/akash-network/console/issues/603)
* ensure apps build consistently in docker and locally ([f4dbd88](https://github.com/akash-network/console/commit/f4dbd88a886d683062eebd7495375bff0bd4aa54)), closes [#209](https://github.com/akash-network/console/issues/209)
* ensure release can detect changes for apps based on local packages ([#1070](https://github.com/akash-network/console/issues/1070)) ([e1053c4](https://github.com/akash-network/console/commit/e1053c456ba718fc58a93799e550e9338d9aea45))
* ensure that akash prebuilt templates exist in the final docker image ([#1020](https://github.com/akash-network/console/issues/1020)) ([2a940a3](https://github.com/akash-network/console/commit/2a940a349a85182f88fb8a83990bf3a78b0bab3f))
* ensures provider-proxy has valid blockchain API_URL on sandbox env ([#1032](https://github.com/akash-network/console/issues/1032)) ([325461e](https://github.com/akash-network/console/commit/325461e684a547669ac9765a3ac378ceadb86ee1))
* fallbacks to `local` if DEPLOYMENT_ENV is not specified ([#1029](https://github.com/akash-network/console/issues/1029)) ([f9bc424](https://github.com/akash-network/console/commit/f9bc4242900c58b0bd519e5c755616aedccfb71b))
* fixes warnings in ui package ([#979](https://github.com/akash-network/console/issues/979)) ([3279d94](https://github.com/akash-network/console/commit/3279d948179edd5473fd507ebb66c8532616c774))
* **network:** safely parse initial selected network ([8f0e2de](https://github.com/akash-network/console/commit/8f0e2de54b64469bfbb9e169030435c04060739b))
* **observability:** bump logger version ([b258c63](https://github.com/akash-network/console/commit/b258c6389d22c0bf57e9c702b51a1280faf74eb7))
* **observability:** ensure pino-pretty works in built app ([7f6f9ca](https://github.com/akash-network/console/commit/7f6f9ca7ca4e1ff4bc3b85735270f61cc8120242)), closes [#474](https://github.com/akash-network/console/issues/474)
* **observability:** make sure otl data is added to logs ([820870d](https://github.com/akash-network/console/commit/820870d43203ddec5d3cd101d5c46b4b67e1d16d))
* **observability:** set logger time format to iso ([3fc959e](https://github.com/akash-network/console/commit/3fc959eb1f7ac1132eab054909a6336263482db8))
* **provider:** added missing types and added error handling ([#751](https://github.com/akash-network/console/issues/751)) ([aee3589](https://github.com/akash-network/console/commit/aee35895d9d632194907c9f04f5d50b7d0f52b58))
* shows dates in UTC for provider-graph/graphics-gpu stats ([#1101](https://github.com/akash-network/console/issues/1101)) ([da363ff](https://github.com/akash-network/console/commit/da363ff52dc5143f4dee772274ff687b7c5a3bc0))
* **template:** eliminates eternal loop when query if failing  ([ca93b51](https://github.com/akash-network/console/commit/ca93b5123725394094aada5149811de548717d94))
* **ui:** fix tailwind.config.js content paths ([73de799](https://github.com/akash-network/console/commit/73de799719ac916132dea08b2070e7d4b613fd26))
* update nextjs version ([#1105](https://github.com/akash-network/console/issues/1105)) ([5d24cd8](https://github.com/akash-network/console/commit/5d24cd851eac88a0fbf04899ffdda689994c2b8b))
* updates dockerfile for node apps ([#1068](https://github.com/akash-network/console/issues/1068)) ([54194a0](https://github.com/akash-network/console/commit/54194a08ca514f1be623a20e7a01cfbbf2e2244a))
* **wallet:** ensure proper network and manage wallet switch ([39ee991](https://github.com/akash-network/console/commit/39ee991731145c3d3d8b3a6cb0ef37fe453b0d29))


### Code Refactoring

* adds warmUpTemplatesCache script ([#962](https://github.com/akash-network/console/issues/962)) ([46b37eb](https://github.com/akash-network/console/commit/46b37eb632dc6da429da94b599160b2e587980c9))
* changes structure and reduce side-effects in provider proxy ([#831](https://github.com/akash-network/console/issues/831)) ([3002e00](https://github.com/akash-network/console/commit/3002e00508019c5adaca4a0bdc42e3b9bf0e4ef1))
* **deployment:** splits some top up logic ([0747c20](https://github.com/akash-network/console/commit/0747c200ae58cd31d06e2bc6a2a9976a0bfecc41)), closes [#395](https://github.com/akash-network/console/issues/395)
* **dx:** fix linting issues ([1115a60](https://github.com/akash-network/console/commit/1115a609ba6a080e4c91331f45fb0d12b48c5504))
* enable eslint rules which restricts what dependencies can be used ([#1074](https://github.com/akash-network/console/issues/1074)) ([509fcd3](https://github.com/akash-network/console/commit/509fcd39831311950afdfb51c189ef46b02c855f))
* enables strict ts mode for logging package ([#951](https://github.com/akash-network/console/issues/951)) ([1086ec2](https://github.com/akash-network/console/commit/1086ec2db2df5ea981fe90417085208254b335c9))
* enables strict types for net & network-store package ([#952](https://github.com/akash-network/console/issues/952)) ([ccc6dc2](https://github.com/akash-network/console/commit/ccc6dc2513006ce1c2522c359d7c946f0946da69))
* enables strict types for ui package ([#953](https://github.com/akash-network/console/issues/953)) ([216ac0e](https://github.com/akash-network/console/commit/216ac0e59e739c34d1d7acb2e14fd1a9d94bc816))
* extracts graph mapping logic into a function ([#1103](https://github.com/akash-network/console/issues/1103)) ([7755238](https://github.com/akash-network/console/commit/775523897306a512ccdc591108a4d19b11db9a2e))
* **forms:** zod form validation and components ([#283](https://github.com/akash-network/console/issues/283)) ([3b8279d](https://github.com/akash-network/console/commit/3b8279d3b7e6f2f1160c26383a04cf775140f1b5))
* **http:** extract http services to the package ([8196b4a](https://github.com/akash-network/console/commit/8196b4a0ff6503e9c057c9aea4409054cb4fc970)), closes [#247](https://github.com/akash-network/console/issues/247)
* **observability:** ensure logger can be configured with options and env ([bb84492](https://github.com/akash-network/console/commit/bb84492b3402688c19af79fce0ad19af25af8bd8)), closes [#430](https://github.com/akash-network/console/issues/430)
* refactors services in console-web to strict types ([#1004](https://github.com/akash-network/console/issues/1004)) ([fd85685](https://github.com/akash-network/console/commit/fd85685858b64ead49a946955fe8da48ea9cc49b))
* update react-query in stats-web ([#1001](https://github.com/akash-network/console/issues/1001)) ([3cc4c27](https://github.com/akash-network/console/commit/3cc4c27a6f22d3c7822478b4e6ab57d4827dab4e)), closes [#337](https://github.com/akash-network/console/issues/337)
