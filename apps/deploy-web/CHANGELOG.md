

## [3.6.1](https://github.com/akash-network/console/compare/console-web/v3.6.0...console-web/v3.6.1) (2025-12-01)


### Bug Fixes

* fixing e2e test for authorizations ([#2176](https://github.com/akash-network/console/issues/2176)) ([7ba2f4e](https://github.com/akash-network/console/commit/7ba2f4edd83c17e86e82bdc5b9a01f757ea7f184))

## [3.6.0](https://github.com/akash-network/console/compare/console-web/v3.5.1...console-web/v3.6.0) (2025-11-29)


### Features

* adds CF-Ray to our application logging ([#2288](https://github.com/akash-network/console/issues/2288)) ([b2e8f53](https://github.com/akash-network/console/commit/b2e8f53df36468021743ca041e2430eb021b437a))

## [3.5.1](https://github.com/akash-network/console/compare/console-web/v3.5.0...console-web/v3.5.1) (2025-11-28)


### Bug Fixes

*  remove pending from active in provider page ([#2278](https://github.com/akash-network/console/issues/2278)) ([74a2415](https://github.com/akash-network/console/commit/74a2415bb2d32238eadfe64e19e198648e14ede8))
* make StripeInput work on light theme ([#2280](https://github.com/akash-network/console/issues/2280)) ([6512106](https://github.com/akash-network/console/commit/6512106b273b29a452bfa78749ce5aded7bd28a4)), closes [#1779](https://github.com/akash-network/console/issues/1779)
* onboarding create deployment ([#2279](https://github.com/akash-network/console/issues/2279)) ([1ea91ae](https://github.com/akash-network/console/commit/1ea91aef50bd9f75142c56422a9bc6ae8a22b04e))


### Code Refactoring

* improves encapsulation of console-api ([#2249](https://github.com/akash-network/console/issues/2249)) ([6462ef1](https://github.com/akash-network/console/commit/6462ef1159f79ba0fc901f6c752358ce18e2b43c))
* removes chainNetwork parameter when communicate to provider-proxy ([#2250](https://github.com/akash-network/console/issues/2250)) ([e8fdcfb](https://github.com/akash-network/console/commit/e8fdcfb55cfa178c505b7e6872681fe9e7572f98)), closes [#2189](https://github.com/akash-network/console/issues/2189)

## [3.5.0](https://github.com/akash-network/console/compare/console-web/v3.4.4...console-web/v3.5.0) (2025-11-24)


### Features

* **billing:** support old mnemonic ([#2264](https://github.com/akash-network/console/issues/2264)) ([6fe9d5f](https://github.com/akash-network/console/commit/6fe9d5fe03d411fe77829d76d039358be820e248))

## [3.4.4](https://github.com/akash-network/console/compare/console-web/v3.4.3...console-web/v3.4.4) (2025-11-17)


### Bug Fixes

* **billing:** disable payments ([#2239](https://github.com/akash-network/console/issues/2239)) ([6e41f25](https://github.com/akash-network/console/commit/6e41f25c1fe42d25863cd2d0f3b649fe87e7e8e1))

## [3.4.3](https://github.com/akash-network/console/compare/console-web/v3.4.2...console-web/v3.4.3) (2025-11-17)


### Bug Fixes

* tests ([#2237](https://github.com/akash-network/console/issues/2237)) ([dcc594d](https://github.com/akash-network/console/commit/dcc594d832f28b6c2bccaba05c6a7ca398d3158c))

## [3.4.2](https://github.com/akash-network/console/compare/console-web/v3.4.1...console-web/v3.4.2) (2025-11-17)


### Bug Fixes

* **billing:** keep connect managed button ([#2235](https://github.com/akash-network/console/issues/2235)) ([9fadab4](https://github.com/akash-network/console/commit/9fadab44e8753a207c74cdc3da9ea0faf3baaeb6))

## [3.4.1](https://github.com/akash-network/console/compare/console-web/v3.4.0...console-web/v3.4.1) (2025-11-17)


### Bug Fixes

* disable ([#2234](https://github.com/akash-network/console/issues/2234)) ([13ce5ee](https://github.com/akash-network/console/commit/13ce5ee50bc39665b0b5c261cfa6e315944c61c7))
* drop deprecated prop so no JS error is shown ([#2228](https://github.com/akash-network/console/issues/2228)) ([7efc4a7](https://github.com/akash-network/console/commit/7efc4a750714c491721cd922ee748472dc951f9b)), closes [#2105](https://github.com/akash-network/console/issues/2105)

## [3.4.0](https://github.com/akash-network/console/compare/console-web/v3.3.0...console-web/v3.4.0) (2025-11-17)


### Features

* upgrade Node.js to 24.11.1 LTS ([#2223](https://github.com/akash-network/console/issues/2223)) ([d9feb09](https://github.com/akash-network/console/commit/d9feb090d45408ec9835216bfc5c6fb3f1329abc))


### Bug Fixes

* convert provider AxiosError to HTTP errors in provider service ([#2207](https://github.com/akash-network/console/issues/2207)) ([b9a6436](https://github.com/akash-network/console/commit/b9a64369ec35ba933fa097f88db8b7d1385b296a))
* correct typos and formatting issues ([#2221](https://github.com/akash-network/console/issues/2221)) ([28e7a98](https://github.com/akash-network/console/commit/28e7a98d2a9f8a8cdefb6b538307c1ec4f34cf55))
* separate deployments for each provider proxy env/network ([#2211](https://github.com/akash-network/console/issues/2211)) ([728f449](https://github.com/akash-network/console/commit/728f449758e46ebf1359838440d9d114ebfee18b)), closes [#2190](https://github.com/akash-network/console/issues/2190)


### Code Refactoring

* **deployment:** replace node-forge with webcrypto for SSH key generation ([#2209](https://github.com/akash-network/console/issues/2209)) ([d621045](https://github.com/akash-network/console/commit/d621045b50a567267e9e3feb633cf5e5ddf29b2d))

## [3.3.0](https://github.com/akash-network/console/compare/console-web/v3.2.0...console-web/v3.3.0) (2025-11-12)


### Features

* **billing:** improve payment page layout ([#2214](https://github.com/akash-network/console/issues/2214)) ([7d9fbef](https://github.com/akash-network/console/commit/7d9fbeffc10da132a10d1b6eb47ce0142e2553f0))
* can accept base64 payload while proxying to provider ([#2201](https://github.com/akash-network/console/issues/2201)) ([4efd4b6](https://github.com/akash-network/console/commit/4efd4b696bf13df77b0ed9163a025b85f1f4a69c)), closes [#2178](https://github.com/akash-network/console/issues/2178)
* **deployment:** enable top up free trial ([#2175](https://github.com/akash-network/console/issues/2175)) ([825b24a](https://github.com/akash-network/console/commit/825b24a0e6d97df467154576933bdb906dce95a2))
* **onboarding:** improve onboarding analytics ([#2203](https://github.com/akash-network/console/issues/2203)) ([2a4070d](https://github.com/akash-network/console/commit/2a4070db69c451ece2db954f4579954debbc9eae))


### Bug Fixes

* updates jest in deploy-web to 30.x ([#2179](https://github.com/akash-network/console/issues/2179)) ([0e607dd](https://github.com/akash-network/console/commit/0e607dd98d73982613643733550b66a248f12fc3))


### Code Refactoring

* extracts logs/events/shell logic to service layer ([#2177](https://github.com/akash-network/console/issues/2177)) ([c754b6f](https://github.com/akash-network/console/commit/c754b6f6178a6d226e19332179f9a0b45375f64c))

## [3.2.0](https://github.com/akash-network/console/compare/console-web/v3.1.2...console-web/v3.2.0) (2025-11-07)


### Features

* **onboarding:** welcome step create deployment ([#2170](https://github.com/akash-network/console/issues/2170)) ([47c2a91](https://github.com/akash-network/console/commit/47c2a91aea877d4a06ea7953b20f3fa31151b0dd))

## [3.1.2](https://github.com/akash-network/console/compare/console-web/v3.1.1...console-web/v3.1.2) (2025-11-06)


### Bug Fixes

* skips logging chrome-extension errors to sentry ([#2164](https://github.com/akash-network/console/issues/2164)) ([07d783d](https://github.com/akash-network/console/commit/07d783d302057825738d5b6f542b7bced5ac915e))


### Code Refactoring

* rewrites SQL query to fetch transactions by address ref ([#2149](https://github.com/akash-network/console/issues/2149)) ([8d56cb0](https://github.com/akash-network/console/commit/8d56cb0fb4b67cc82191b368241927ae842745cf))

## [3.1.1](https://github.com/akash-network/console/compare/console-web/v3.1.0...console-web/v3.1.1) (2025-11-06)


### Bug Fixes

* **billing:** onboarding provider filter ([#2160](https://github.com/akash-network/console/issues/2160)) ([07b0a6a](https://github.com/akash-network/console/commit/07b0a6ac629671e044a3d3becd34179cc99a8624))
* **billing:** refill trial wallets for non-anonymous ([#2147](https://github.com/akash-network/console/issues/2147)) ([24d06d3](https://github.com/akash-network/console/commit/24d06d31bfa30ab38cd28599772e83a3b3c8083c))

## [3.1.0](https://github.com/akash-network/console/compare/console-web/v3.0.6...console-web/v3.1.0) (2025-11-05)


### Features

* add otel namespace to logging package ([#2075](https://github.com/akash-network/console/issues/2075)) ([557321a](https://github.com/akash-network/console/commit/557321a4a85144383e43fb35d28527649a396213))
* **auth:** adds offline_access scope to oauth to endure sessions with refresh token  ([f2b053f](https://github.com/akash-network/console/commit/f2b053f13efaef08275c4c188a0bd3e14cf0c1df))


### Bug Fixes

* **auth:** redirects user to a login page in case of an expired access token ([bde0a51](https://github.com/akash-network/console/commit/bde0a51210c94db28cc600a7efbbe989332db2c4)), closes [#2148](https://github.com/akash-network/console/issues/2148)

## [3.0.6](https://github.com/akash-network/console/compare/console-web/v3.0.5...console-web/v3.0.6) (2025-11-01)


### Code Refactoring

* sanitizes invalid UTF characters to prevent Loki crashes ([#2143](https://github.com/akash-network/console/issues/2143)) ([d339437](https://github.com/akash-network/console/commit/d3394371dc86791b8dc1f9abfba72c7d873f17fd))
* splits BackgroundTaskProvider into hook and service ([#2137](https://github.com/akash-network/console/issues/2137)) ([da9671d](https://github.com/akash-network/console/commit/da9671d84639434a9346453486b729a9a0e8619c))

## [3.0.5](https://github.com/akash-network/console/compare/console-web/v3.0.4...console-web/v3.0.5) (2025-10-29)


### Bug Fixes

* adds ibc types to default registry ([#2132](https://github.com/akash-network/console/issues/2132)) ([9e3c6b0](https://github.com/akash-network/console/commit/9e3c6b0a54e8f958be051e097a05d735f51e2c60))

## [3.0.4](https://github.com/akash-network/console/compare/console-web/v3.0.3...console-web/v3.0.4) (2025-10-29)


### Bug Fixes

* add logging batching client ([#2128](https://github.com/akash-network/console/issues/2128)) ([8bca2c8](https://github.com/akash-network/console/commit/8bca2c899af898da657b7f44de24323262962572))
* akashnet twitter handle ([#2125](https://github.com/akash-network/console/issues/2125)) ([10b4d28](https://github.com/akash-network/console/commit/10b4d280eac5173661688805841499314e8e1cc8))

## [3.0.3](https://github.com/akash-network/console/compare/console-web/v3.0.2...console-web/v3.0.3) (2025-10-28)


### Bug Fixes

* **deployment:** map denom ([#2120](https://github.com/akash-network/console/issues/2120)) ([5da7421](https://github.com/akash-network/console/commit/5da74215ccd3a1027da48283a3353f74de1502b8))

## [3.0.2](https://github.com/akash-network/console/compare/console-web/v3.0.1...console-web/v3.0.2) (2025-10-27)


### Bug Fixes

* stores partial deployment data in local storage ([#2119](https://github.com/akash-network/console/issues/2119)) ([6371677](https://github.com/akash-network/console/commit/6371677deb9c89c1be3786c06f3b33ac9c4caac2))

## [3.0.1](https://github.com/akash-network/console/compare/console-web/v3.0.0...console-web/v3.0.1) (2025-10-27)


### Bug Fixes

* **release:** triggers release  ([cd59471](https://github.com/akash-network/console/commit/cd594718d29ec1f7d1de13071fb2e999b5b8a088))

## [3.0.0](https://github.com/akash-network/console/compare/console-web/v2.118.0...console-web/v3.0.0) (2025-10-27)


### ⚠ BREAKING CHANGES

* targets sdk53
* removes GET /v1/version/{network}

* feat!(network): uses meta.json instead of version.txt and removes GET /v1/version/{network} ([46841af](https://github.com/akash-network/console/commit/46841af26f8510d18ce941240c49610caef642a4)), closes [#2091](https://github.com/akash-network/console/issues/2091)


### Features

* adds breaking change notice for the services targeting sdk53 ([cd8bf9b](https://github.com/akash-network/console/commit/cd8bf9bc618d32b42a4fa5ac9a38bb9e1168416f))
* chain sdk next api ([#2023](https://github.com/akash-network/console/issues/2023)) ([4453796](https://github.com/akash-network/console/commit/44537960721dced5388cc3d39b25352943fa8931)), closes [#1980](https://github.com/akash-network/console/issues/1980) [#1983](https://github.com/akash-network/console/issues/1983) [#2016](https://github.com/akash-network/console/issues/2016)
* chain sdk next web ([#2050](https://github.com/akash-network/console/issues/2050)) ([1bc10ea](https://github.com/akash-network/console/commit/1bc10ea201360054e53d65a21f845f22d842352b))
* **release:** implements console-web staging testnet deploy  ([38210f1](https://github.com/akash-network/console/commit/38210f1f9b06e6269b7adb158ea392d09a58eaa6))


### Bug Fixes

* **config:** handles absent nodes/versions files ([b41833f](https://github.com/akash-network/console/commit/b41833fa5267398700b02b0924fce42e4407ae88))
* fixes proto types of deployment authorization ([#2080](https://github.com/akash-network/console/issues/2080)) ([10dacaf](https://github.com/akash-network/console/commit/10dacaf9cec802bdbc5d62ca2be0d91e6ac7312f))
* freetrial account check ([#2094](https://github.com/akash-network/console/issues/2094)) ([a40f1df](https://github.com/akash-network/console/commit/a40f1dfc9cdf1fd6ff2eda4643322ed975e954da))
* name and right button link to deployment page, not the whole line ([3ea1f04](https://github.com/akash-network/console/commit/3ea1f0433cac42d13ce80d5c8e092519da423963)), closes [#1981](https://github.com/akash-network/console/issues/1981)
* network store mapping ([#2057](https://github.com/akash-network/console/issues/2057)) ([6b4a9db](https://github.com/akash-network/console/commit/6b4a9dbc888803586f1ac38d985671a853313405))
* removes duplicate query key def ([f04e205](https://github.com/akash-network/console/commit/f04e205ed02f1f2483098ab0b576ab906e83884e))
* upgrade chain-sdk to latest version and adds its transport options in indexer ([#2103](https://github.com/akash-network/console/issues/2103)) ([07ba99a](https://github.com/akash-network/console/commit/07ba99a93bf6fb7a0e67eb1fbd554855e66d322b))
* upgrades cosmjs dependencies and removes unused ones ([#2082](https://github.com/akash-network/console/issues/2082)) ([364f30e](https://github.com/akash-network/console/commit/364f30ee696c477caf7cd8ac6d080f8b933be062)), closes [#1679](https://github.com/akash-network/console/issues/1679)
* use Link to render deployment name ([#2111](https://github.com/akash-network/console/issues/2111)) ([7fedad6](https://github.com/akash-network/console/commit/7fedad6d6e16df811f51eb5deafdff216e56ec57))


### Code Refactoring

* converts deployment local storage utils into a service ([#2106](https://github.com/akash-network/console/issues/2106)) ([b379986](https://github.com/akash-network/console/commit/b379986c49c46434ad854d2db491ca555722a95e)), closes [#1927](https://github.com/akash-network/console/issues/1927)
* migrate provider-proxy to next chain sdk ([#1980](https://github.com/akash-network/console/issues/1980)) ([f6258f3](https://github.com/akash-network/console/commit/f6258f39ffc586e8a9c9454764a6a1e2113e1410))

## [2.118.0](https://github.com/akash-network/console/compare/console-web/v2.117.0...console-web/v2.118.0) (2025-10-21)


### Features

* can multi-select deployments when pressing shift ([4b3e777](https://github.com/akash-network/console/commit/4b3e77745dcd78c117cdefe16331cfae4b36845a))


### Bug Fixes

* checkbox can optionally have a larger clickable wrapper  ([e3c51dd](https://github.com/akash-network/console/commit/e3c51ddd7e1fa25d5933ad4dd5b8b58d9ac23a34)), closes [#1981](https://github.com/akash-network/console/issues/1981)
* **observability:** adds fatal method to the logger ([d89872c](https://github.com/akash-network/console/commit/d89872cd2824310a7a332e41ee8a42657c196b6e)), closes [#2087](https://github.com/akash-network/console/issues/2087)

## [2.117.0](https://github.com/akash-network/console/compare/console-web/v2.116.1...console-web/v2.117.0) (2025-10-17)


### Features

* displays blockchain upgrade/down banners in stats-web/deploy-web ([#2060](https://github.com/akash-network/console/issues/2060)) ([22312bf](https://github.com/akash-network/console/commit/22312bfba67626dbadd01a6e2db58c5074ab437c)), closes [#1924](https://github.com/akash-network/console/issues/1924)
* **network:** adjusts indexer for sdk53 network upgrade ([dfc7d05](https://github.com/akash-network/console/commit/dfc7d05123a52470fb527908c935c1ee12f66da5))
* **onboarding:** update "talk to an expert" URL to new HubSpot form ([6f0a134](https://github.com/akash-network/console/commit/6f0a1341e9dd4dd4c2772d2e8d6d06018754280d)), closes [#2056](https://github.com/akash-network/console/issues/2056)


### Bug Fixes

* adjusts maintenance message based on app ([#2072](https://github.com/akash-network/console/issues/2072)) ([a67be97](https://github.com/akash-network/console/commit/a67be979c9577271ca194481b3613476f7070b7c))

## [2.116.1](https://github.com/akash-network/console/compare/console-web/v2.116.0...console-web/v2.116.1) (2025-10-15)


### Code Refactoring

* migrates jwt signing in accordance to chain-sdk ([#2049](https://github.com/akash-network/console/issues/2049)) ([9b950c4](https://github.com/akash-network/console/commit/9b950c4609ef3757d6aa8e2e6741da2e950ff1e0))

## [2.116.0](https://github.com/akash-network/console/compare/console-web/v2.115.0...console-web/v2.116.0) (2025-10-14)


### Features

* adds support for jwt token in offline mode ([#2036](https://github.com/akash-network/console/issues/2036)) ([3c9b8f3](https://github.com/akash-network/console/commit/3c9b8f3c09610b666bd556ee1714d3b83db30c39))


### Code Refactoring

* simplifies multiple trx version support ([#2052](https://github.com/akash-network/console/issues/2052)) ([ebe8897](https://github.com/akash-network/console/commit/ebe88970a986aa3a692cce4cd78fda78c475934e))

## [2.115.0](https://github.com/akash-network/console/compare/console-web/v2.114.0...console-web/v2.115.0) (2025-10-10)


### Features

* **config:** uses correct sdk53 testnet config ([4ce80e5](https://github.com/akash-network/console/commit/4ce80e5fd7a5dc7dc6fb0d4f8b3ae34b7b7eef13))

## [2.114.0](https://github.com/akash-network/console/compare/console-web/v2.113.0...console-web/v2.114.0) (2025-10-08)


### Features

* adds fallbackChainApiClient ([#2009](https://github.com/akash-network/console/issues/2009)) ([e9237fc](https://github.com/akash-network/console/commit/e9237fcbf8a31f2f17241bcdeb6d7dc7422f6423))
* **network:** maps sandbox to sandbox-2 ([e1d32ef](https://github.com/akash-network/console/commit/e1d32ef3e699b9c7fcb95f203b02cdc81752b1fb))

## [2.113.0](https://github.com/akash-network/console/compare/console-web/v2.112.2...console-web/v2.113.0) (2025-10-06)


### Features

* **auth:** implements managed wallet API JWT auth  ([06b4e45](https://github.com/akash-network/console/commit/06b4e4540433b3b55fbc31f76d955e05e040a82e))
* **wallet:** ensures managed wallet supports read-only mode during blockchain outage ([2a005c6](https://github.com/akash-network/console/commit/2a005c61e845906962ebfc49116974d8fdd3d931))


### Bug Fixes

* **billing:** cleanup discount payments ([#1969](https://github.com/akash-network/console/issues/1969)) ([0a72177](https://github.com/akash-network/console/commit/0a721771bc39fc0b1995688cac032f52988c79bd))

## [2.112.2](https://github.com/akash-network/console/compare/console-web/v2.112.1...console-web/v2.112.2) (2025-10-01)


### Bug Fixes

* proxy build script ([#1987](https://github.com/akash-network/console/issues/1987)) ([7c0a504](https://github.com/akash-network/console/commit/7c0a5041d4618171563bdb7e6ce82e8cb93f4d7c))

## [2.112.1](https://github.com/akash-network/console/compare/console-web/v2.112.0...console-web/v2.112.1) (2025-10-01)


### Bug Fixes

* **billing:** fix payment polling and add create lease trial info ([#1986](https://github.com/akash-network/console/issues/1986)) ([f6a873c](https://github.com/akash-network/console/commit/f6a873ced45db3753a64787daacbf346e95bcc2e))

## [2.112.0](https://github.com/akash-network/console/compare/console-web/v2.111.0...console-web/v2.112.0) (2025-09-30)


### Features

* adds support for detecting whether blockchain is down ([#1973](https://github.com/akash-network/console/issues/1973)) ([384080c](https://github.com/akash-network/console/commit/384080ca2c9b906527c7a1b46c184b4118ea59df))
* **billing:** implement polling for balance update after payment ([#1975](https://github.com/akash-network/console/issues/1975)) ([9969a28](https://github.com/akash-network/console/commit/9969a28b52cfb79a95ff9bc00801b8b7b3dad8e4))
* disable some features when blockchain is down ([#1971](https://github.com/akash-network/console/issues/1971)) ([64d5bef](https://github.com/akash-network/console/commit/64d5befefc09479a09d5e1a829c9004ab2d6470e))


### Code Refactoring

* adjusts authz and provider services to work when blockchain is down ([#1977](https://github.com/akash-network/console/issues/1977)) ([52ed240](https://github.com/akash-network/console/commit/52ed240375312e37752da39315da0f0fad12e8cd))

## [2.111.0](https://github.com/akash-network/console/compare/console-web/v2.110.0...console-web/v2.111.0) (2025-09-26)


### Features

* control maintenance banner with a feature flag ([#1968](https://github.com/akash-network/console/issues/1968)) ([22654c9](https://github.com/akash-network/console/commit/22654c9d364f68e3bc137319b95069d0f8d51972)), closes [#1949](https://github.com/akash-network/console/issues/1949)


### Bug Fixes

* invalidate deployment when toggling alert status ([#1937](https://github.com/akash-network/console/issues/1937)) ([08ebc6a](https://github.com/akash-network/console/commit/08ebc6a3f7d52d72b71d1f576664ae7760dda191)), closes [#1768](https://github.com/akash-network/console/issues/1768) [#1768](https://github.com/akash-network/console/issues/1768)


### Code Refactoring

* network version is now taken from /net package in network-store ([#1966](https://github.com/akash-network/console/issues/1966)) ([61dc080](https://github.com/akash-network/console/commit/61dc08057419270e50d1b9ceed2f82331429e974))

## [2.110.0](https://github.com/akash-network/console/compare/console-web/v2.109.0...console-web/v2.110.0) (2025-09-24)


### Features

* **bid:** marks managed bids list with certs requirement ([75fed6f](https://github.com/akash-network/console/commit/75fed6f9d6575e3ff1676cb2250b912f7b8cc2a6)), closes [#1913](https://github.com/akash-network/console/issues/1913)

## [2.109.0](https://github.com/akash-network/console/compare/console-web/v2.108.0...console-web/v2.109.0) (2025-09-23)


### Features

* **billing:** add 3dsecure payments ui ([#1933](https://github.com/akash-network/console/issues/1933)) ([4c7ce23](https://github.com/akash-network/console/commit/4c7ce23c206fda498d87e0d015e0a69cf1970aa5))
* make Unleash session id visible for backend ([#1935](https://github.com/akash-network/console/issues/1935)) ([ed3c047](https://github.com/akash-network/console/commit/ed3c0474ef178a9ffc40c00555d137e6966885c6)), closes [#1867](https://github.com/akash-network/console/issues/1867)


### Bug Fixes

* ensure anonymous user does not cause sentry errors ([#1943](https://github.com/akash-network/console/issues/1943)) ([9132e39](https://github.com/akash-network/console/commit/9132e39b785c7c37d055c6db09377737b6b08a5e))

## [2.108.0](https://github.com/akash-network/console/compare/console-web/v2.107.2...console-web/v2.108.0) (2025-09-17)


### Features

* **billing:** test charge for free trial ([#1898](https://github.com/akash-network/console/issues/1898)) ([959ed00](https://github.com/akash-network/console/commit/959ed00936c6d90b5763ea024038ecca70cf9079))


### Bug Fixes

* **analytics:** uses gtag getter to make sure it's present after onload ([#1936](https://github.com/akash-network/console/issues/1936)) ([da4a70e](https://github.com/akash-network/console/commit/da4a70eb809974535461480c078df6f873117f87))
* set allowUrls for sentry on deploy-web ([#1895](https://github.com/akash-network/console/issues/1895)) ([016ef7d](https://github.com/akash-network/console/commit/016ef7dd5f7af7156ed95fe7d9d89fa48a2daff1))

## [2.107.2](https://github.com/akash-network/console/compare/console-web/v2.107.1...console-web/v2.107.2) (2025-09-16)


### Bug Fixes

* **billing:** prevent 0 amount payments ([#1904](https://github.com/akash-network/console/issues/1904)) ([e32155e](https://github.com/akash-network/console/commit/e32155ecfdc099b63d490f3294bb178c24a7dd53))

## [2.107.1](https://github.com/akash-network/console/compare/console-web/v2.107.0...console-web/v2.107.1) (2025-09-15)


### Bug Fixes

* sync email_verified from auth0 on demand  ([436e41a](https://github.com/akash-network/console/commit/436e41a6a1dc2c39552192d2ae648b011ccb44e2))

## [2.107.0](https://github.com/akash-network/console/compare/console-web/v2.106.0...console-web/v2.107.0) (2025-09-10)


### Features

* adds notification on first trial deployment ([#1872](https://github.com/akash-network/console/issues/1872)) ([3f2041f](https://github.com/akash-network/console/commit/3f2041f71fb1d5a2898aa78be36ba513c47f3fdd))


### Bug Fixes

* ensure that error is not thrown on undefined block ([#1892](https://github.com/akash-network/console/issues/1892)) ([9425d3b](https://github.com/akash-network/console/commit/9425d3b2b23e4223d29854e0458d39514108b03a))
* keep order of services when switching from yaml to editor ([68c3c67](https://github.com/akash-network/console/commit/68c3c670779c3f3859cdcc3da2845efd609309d3)), closes [#1862](https://github.com/akash-network/console/issues/1862)


### Code Refactoring

* changes LeaseHttpService to accept http client ([#1888](https://github.com/akash-network/console/issues/1888)) ([4a13f24](https://github.com/akash-network/console/commit/4a13f24f9119d7332ae27d0a4ec6a9c35b16e93a))

## [2.106.0](https://github.com/akash-network/console/compare/console-web/v2.105.0...console-web/v2.106.0) (2025-09-03)


### Features

* **log-collector:** integrate LogCollectorControl with SimpleSdlBuiderForm ([19a5180](https://github.com/akash-network/console/commit/19a51805fcb17dee3dd925c2c2e7d79b67bdb17e))


### Bug Fixes

* **log-collector:** ensures latest state updates in sdl env hook ([25afa73](https://github.com/akash-network/console/commit/25afa7319a739eee8545a325aa4986dc907b031d))

## [2.105.0](https://github.com/akash-network/console/compare/console-web/v2.104.0...console-web/v2.105.0) (2025-09-02)


### Features

* **log-collector:** adds log collector configuration to sdl ([7b7fe50](https://github.com/akash-network/console/commit/7b7fe50cb1c248d3d4e10ab10b95832843226551))


### Bug Fixes

* **network:** api proxy correct network url ([#1881](https://github.com/akash-network/console/issues/1881)) ([d561658](https://github.com/akash-network/console/commit/d5616587752f007e5fb015e17a0d9fd68e4c2659))

## [2.104.0](https://github.com/akash-network/console/compare/console-web/v2.103.0...console-web/v2.104.0) (2025-09-01)


### Features

* **log-collector:** implements basic log collector control in the sdl builder ([68e7fb7](https://github.com/akash-network/console/commit/68e7fb7321172de87d6193a40fa2d4e611ff7ba6))


### Bug Fixes

* anonymous user reassignment ([#1877](https://github.com/akash-network/console/issues/1877)) ([cde7e41](https://github.com/akash-network/console/commit/cde7e417cbbe279a98b856de532a69f6fe16cad7))
* **network:** sandbox for managed wallets staging ([#1879](https://github.com/akash-network/console/issues/1879)) ([e373bf9](https://github.com/akash-network/console/commit/e373bf979e06729726b2becbb6c046d11a351ac4))

## [2.103.0](https://github.com/akash-network/console/compare/console-web/v2.102.1...console-web/v2.103.0) (2025-08-28)


### Features

* **billing:** implement charges csv export  ([cbb3570](https://github.com/akash-network/console/commit/cbb3570a50876908c01006582a930590cf87f87d))


### Bug Fixes

* properly renames quantity to size during manifest submission ([#1854](https://github.com/akash-network/console/issues/1854)) ([2bf44f7](https://github.com/akash-network/console/commit/2bf44f7aef6202659efef70968d8080b466b02ba))

## [2.102.1](https://github.com/akash-network/console/compare/console-web/v2.102.0...console-web/v2.102.1) (2025-08-26)


### Bug Fixes

* billing usage page guard flicker ([52b25ba](https://github.com/akash-network/console/commit/52b25bad3c37dcb3bb1504f2d6b87ddbe4240268))

## [2.102.0](https://github.com/akash-network/console/compare/console-web/v2.101.1...console-web/v2.102.0) (2025-08-26)


### Features

* adds api background-jobs server setup ([#1833](https://github.com/akash-network/console/issues/1833)) ([d3e6214](https://github.com/akash-network/console/commit/d3e6214800722fafd872a876ddaff0591a6e6dd8))

## [2.101.1](https://github.com/akash-network/console/compare/console-web/v2.101.0...console-web/v2.101.1) (2025-08-25)


### Bug Fixes

* **deployment:** handles invalid manifest errors on POST /v1/leases ([f5da5c4](https://github.com/akash-network/console/commit/f5da5c4b02ef3e2977a8f5855eb5a8b81ac8281b)), closes [#1835](https://github.com/akash-network/console/issues/1835)

## [2.101.0](https://github.com/akash-network/console/compare/console-web/v2.100.0...console-web/v2.101.0) (2025-08-21)


### Features

* adds notification on start trial ([#1818](https://github.com/akash-network/console/issues/1818)) ([1eb381a](https://github.com/akash-network/console/commit/1eb381a3634313cc9135cf0a997ad551883ba862))
* **deployment:** hide custodial auto top up with feature flag ([#1825](https://github.com/akash-network/console/issues/1825)) ([431fa2a](https://github.com/akash-network/console/commit/431fa2ac8cfe74396ad123a610d465f8ac7d5fab))


### Bug Fixes

* refactor http-sdk services to accept httpClient ([#1829](https://github.com/akash-network/console/issues/1829)) ([abcb7dc](https://github.com/akash-network/console/commit/abcb7dc9eaeca626e6ba69edb561ff0172cf6c1a))

## [2.100.0](https://github.com/akash-network/console/compare/console-web/v2.99.0...console-web/v2.100.0) (2025-08-18)


### Features

* adds creation of default notification channel on user login/registration ([#1808](https://github.com/akash-network/console/issues/1808)) ([aa53ee6](https://github.com/akash-network/console/commit/aa53ee64f7d8a004521807c2cd32f55799e323dd))
* **auth:** enhance API key management with new hooks and tests ([#1813](https://github.com/akash-network/console/issues/1813)) ([ebfcbbe](https://github.com/akash-network/console/commit/ebfcbbe50812fb683e5e43136bb4147da85e75a9))


### Bug Fixes

* make date range picker scrollable if it overflows container ([ac6f2a8](https://github.com/akash-network/console/commit/ac6f2a87cea5eecfe5696c15af38bec09027087a))
* widens sentry sourcemaps ([#1819](https://github.com/akash-network/console/issues/1819)) ([2077603](https://github.com/akash-network/console/commit/20776032cffccccbc50ce40e2aa24ec304ebca3f))

## [2.99.0](https://github.com/akash-network/console/compare/console-web/v2.98.3...console-web/v2.99.0) (2025-08-14)


### Features

* enables sentry sourcemaps in deploy-web ([#1800](https://github.com/akash-network/console/issues/1800)) ([f7c83bf](https://github.com/akash-network/console/commit/f7c83bf749199d17e9d9b8cb7c2f7a3413a59887))


### Bug Fixes

* ensure that traceparent/tracestate are tracked in logs ([#1799](https://github.com/akash-network/console/issues/1799)) ([ace47e6](https://github.com/akash-network/console/commit/ace47e6fa75b3354e18995f36fc064a42afd5165))


### Code Refactoring

* moves user registraction logic under user controller ([#1796](https://github.com/akash-network/console/issues/1796)) ([b16573b](https://github.com/akash-network/console/commit/b16573b2e42856aff2332d62267d34aa3f27d201))

## [2.98.3](https://github.com/akash-network/console/compare/console-web/v2.98.2...console-web/v2.98.3) (2025-08-13)


### Code Refactoring

* improves types in jwt ([#1794](https://github.com/akash-network/console/issues/1794)) ([070910e](https://github.com/akash-network/console/commit/070910eb9b815c4acb64615d1d26d6d47fbdc26a))

## [2.98.2](https://github.com/akash-network/console/compare/console-web/v2.98.1...console-web/v2.98.2) (2025-08-07)


### Code Refactoring

* reduces usage of services variable ([#1772](https://github.com/akash-network/console/issues/1772)) ([67e5c30](https://github.com/akash-network/console/commit/67e5c30c407f27df1ca9f1ce56eb723765d50282))

## [2.98.1](https://github.com/akash-network/console/compare/console-web/v2.98.0...console-web/v2.98.1) (2025-08-04)


### Code Refactoring

* renames and moves di container files to different location ([#1767](https://github.com/akash-network/console/issues/1767)) ([b3625ed](https://github.com/akash-network/console/commit/b3625ed0b4653e3f266440da0d73697ca55fe886))
* switch http services in deploy-web to fetch API ([#1775](https://github.com/akash-network/console/issues/1775)) ([c6d1105](https://github.com/akash-network/console/commit/c6d110544bff4eb422954bcce8dd007e795e1213)), closes [#1423](https://github.com/akash-network/console/issues/1423)

## [2.98.0](https://github.com/akash-network/console/compare/console-web/v2.97.1...console-web/v2.98.0) (2025-07-31)


### Features

* **billing:** add composable guard for usage page ([#1710](https://github.com/akash-network/console/issues/1710)) ([a397e64](https://github.com/akash-network/console/commit/a397e640d1175e3b5c0f5ab7d334b2e9236522d5))
* **billing:** add date filtering to usage ui ([21debff](https://github.com/akash-network/console/commit/21debff21de5c78eec914ea101cbd1ffd8f16d37))
* **billing:** add stripe charges table list to usage ui  ([81e9d42](https://github.com/akash-network/console/commit/81e9d42d254bee6248451aecde8868ccbf018d89))
* **billing:** add usage trend indicator ui ([#1709](https://github.com/akash-network/console/issues/1709)) ([c25683c](https://github.com/akash-network/console/commit/c25683c3d89c5fa956dee091a9a967e9fdfe8704))
* **billing:** validate payment methods trial ([#1750](https://github.com/akash-network/console/issues/1750)) ([1776442](https://github.com/akash-network/console/commit/17764422232ac089fd4b48225d3b148e077947b6))
* **deployment:** implement trial deployment badge ([#1764](https://github.com/akash-network/console/issues/1764)) ([3e2fdae](https://github.com/akash-network/console/commit/3e2fdaee9f03bb95235f1f3171665111004807f8))

## [2.97.1](https://github.com/akash-network/console/compare/console-web/v2.97.0...console-web/v2.97.1) (2025-07-28)


### Code Refactoring

* removes old implementation of feature flags based on env variables ([#1480](https://github.com/akash-network/console/issues/1480)) ([fa722aa](https://github.com/akash-network/console/commit/fa722aae1baf9e5dbd034381a2b641cfd7a5bf8d))

## [2.97.0](https://github.com/akash-network/console/compare/console-web/v2.96.5...console-web/v2.97.0) (2025-07-27)


### Features

* adds handling of expired certificate in lease flow ([#1738](https://github.com/akash-network/console/issues/1738)) ([d4881a1](https://github.com/akash-network/console/commit/d4881a1f21675a2320a02f2607e5b437b611f545))
* adds safe node packages installation ([#1726](https://github.com/akash-network/console/issues/1726)) ([37acfee](https://github.com/akash-network/console/commit/37acfee5c1d053cec2316560ad220992d70b7cbf)), closes [#1549](https://github.com/akash-network/console/issues/1549)
* **billing:** new onboarding flow ([#1711](https://github.com/akash-network/console/issues/1711)) ([e05506c](https://github.com/akash-network/console/commit/e05506c89a762e8fa9111649357aa80c06e26fbe))
* displays information about expired cert ([#1730](https://github.com/akash-network/console/issues/1730)) ([971eec9](https://github.com/akash-network/console/commit/971eec9659d1510a6555d4bc54bfa0015b2b67aa))


### Bug Fixes

* **auth:** fetching api keys ([#1743](https://github.com/akash-network/console/issues/1743)) ([cda80ce](https://github.com/akash-network/console/commit/cda80cefacff2d677fdd4e334b9d1997b6b9bd95))

## [2.96.5](https://github.com/akash-network/console/compare/console-web/v2.96.4...console-web/v2.96.5) (2025-07-22)


### Bug Fixes

* uses a separate consoleApiHttpClient for public access ([#1719](https://github.com/akash-network/console/issues/1719)) ([f817d47](https://github.com/akash-network/console/commit/f817d47133411a70c47ea9ab3c48b55860801f77))

## [2.96.4](https://github.com/akash-network/console/compare/console-web/v2.96.3...console-web/v2.96.4) (2025-07-22)


### Code Refactoring

* creates separate axios instance per intent ([#1702](https://github.com/akash-network/console/issues/1702)) ([b15370f](https://github.com/akash-network/console/commit/b15370fccc676982705c41c7b659752a467aef0d)), closes [#1668](https://github.com/akash-network/console/issues/1668)

## [2.96.3](https://github.com/akash-network/console/compare/console-web/v2.96.2...console-web/v2.96.3) (2025-07-21)


### Bug Fixes

* exports jwt wallet utils ([#1696](https://github.com/akash-network/console/issues/1696)) ([356813b](https://github.com/akash-network/console/commit/356813ba0fb9b6b8dda9b7d52d777a134477437b))

## [2.96.2](https://github.com/akash-network/console/compare/console-web/v2.96.1...console-web/v2.96.2) (2025-07-16)


### Bug Fixes

* **template:** removes client side middleware from server side props ([9da8fdc](https://github.com/akash-network/console/commit/9da8fdc313203e6b3f752ced016ce684ed4a6d33))

## [2.96.1](https://github.com/akash-network/console/compare/console-web/v2.96.0...console-web/v2.96.1) (2025-07-16)


### Bug Fixes

* **alert:** properly displays deployment closed alert type in a list ([b001d29](https://github.com/akash-network/console/commit/b001d296374e4391701abd8389fdeedb2d94cd07))

## [2.96.0](https://github.com/akash-network/console/compare/console-web/v2.95.1...console-web/v2.96.0) (2025-07-16)


### Features

* add calendar and date-range-picker ui components ([cc96f0f](https://github.com/akash-network/console/commit/cc96f0f71ea9078f39775623144058785b745e6c))
* **alert:** implements deployment closed alert handler ([#1683](https://github.com/akash-network/console/issues/1683)) ([3253b75](https://github.com/akash-network/console/commit/3253b75cb2d2679996ed9df15265a5fd1a6401fe))
* allow filtering stripe charges list api by date created and endingBefore cursor  ([fe986bd](https://github.com/akash-network/console/commit/fe986bdd63051c9dfe3751c1c56fab0025205c1c))
* **billing:** add usage ui ([77b5d42](https://github.com/akash-network/console/commit/77b5d42aaf4e153a6fe9f6723567520434f3d25b))

## [2.95.1](https://github.com/akash-network/console/compare/console-web/v2.95.0...console-web/v2.95.1) (2025-07-15)


### Bug Fixes

* blockchain proxy cert expired, so ignoring it ([#1685](https://github.com/akash-network/console/issues/1685)) ([3a2e205](https://github.com/akash-network/console/commit/3a2e20587918b60bb836a83704129dba27df9bae))

## [2.95.0](https://github.com/akash-network/console/compare/console-web/v2.94.0...console-web/v2.95.0) (2025-07-15)


### Features

* **alert:** implements deployment closed alert management based on chain events ([cabd46a](https://github.com/akash-network/console/commit/cabd46ae63221fa219b336448e6e046202a585b5))
* **billing:** update tos ([#1671](https://github.com/akash-network/console/issues/1671)) ([80d4048](https://github.com/akash-network/console/commit/80d4048f0502a4289d56961b1ac54fb283ec0e84))


### Bug Fixes

* do not break on tx error ([#1682](https://github.com/akash-network/console/issues/1682)) ([db1b625](https://github.com/akash-network/console/commit/db1b6254458857153f04999e427daeaa354737ac)), closes [#1675](https://github.com/akash-network/console/issues/1675)

## [2.94.0](https://github.com/akash-network/console/compare/console-web/v2.93.1...console-web/v2.94.0) (2025-07-14)


### Features

* adds distributed trace propagation for deploy-web ([#1666](https://github.com/akash-network/console/issues/1666)) ([df003dd](https://github.com/akash-network/console/commit/df003ddc01ec3183333323e2c2c75dbc6369e511))
* **billing:** apply coupon to balance ([#1658](https://github.com/akash-network/console/issues/1658)) ([e5a0420](https://github.com/akash-network/console/commit/e5a04202cdd267aa55e9152a62a0066df45a5471))


### Bug Fixes

* prevent request to provider-proxy when deployment is closed ([#1660](https://github.com/akash-network/console/issues/1660)) ([db15052](https://github.com/akash-network/console/commit/db15052f76abc2419a8f87b6375be57b384d61f7))


### Code Refactoring

* creates reusable defineApiHandler ([#1656](https://github.com/akash-network/console/issues/1656)) ([768c503](https://github.com/akash-network/console/commit/768c5037a1a7db8be43f30f9fb65be20ca44d218))
* hides more services inside DI ([#1665](https://github.com/akash-network/console/issues/1665)) ([705bdb6](https://github.com/akash-network/console/commit/705bdb6a5c5c02f2f27dfb29926b39d231230fbc))
* replaces getServerSideProps with defineServerSideProps factory ([#1649](https://github.com/akash-network/console/issues/1649)) ([873dafb](https://github.com/akash-network/console/commit/873dafb6199ae5714a7b24cc5c26c80a136be379))

## [2.93.1](https://github.com/akash-network/console/compare/console-web/v2.93.0...console-web/v2.93.1) (2025-07-09)


### Bug Fixes

* **notification-channel:** goes back after successful form submission without prompt ([ed4b28c](https://github.com/akash-network/console/commit/ed4b28cffcc19849557f229b050be6db63ac73b6))

## [2.93.0](https://github.com/akash-network/console/compare/console-web/v2.92.1...console-web/v2.93.0) (2025-07-08)


### Features

* adds error code to collected error stack ([#1595](https://github.com/akash-network/console/issues/1595)) ([fef764f](https://github.com/akash-network/console/commit/fef764f8de77d501e7d0a136b5a9b5692d71d2ad))
* improves observability of SSR part of deploy-web ([#1642](https://github.com/akash-network/console/issues/1642)) ([ad55727](https://github.com/akash-network/console/commit/ad5572745235ce42691f314cfca61576607fbc1b))


### Code Refactoring

* fix hacky ref logic in ImageSelect ([#1624](https://github.com/akash-network/console/issues/1624)) ([e77e2df](https://github.com/akash-network/console/commit/e77e2dff0c198871cf14f98b68d62cf9b2bbc5dc)), closes [#1045](https://github.com/akash-network/console/issues/1045) [#1045](https://github.com/akash-network/console/issues/1045)
* moves services into DI ([#1636](https://github.com/akash-network/console/issues/1636)) ([d2756f0](https://github.com/akash-network/console/commit/d2756f0383e97578c441faade2ad8a1fe6c66235))

## [2.92.1](https://github.com/akash-network/console/compare/console-web/v2.92.0...console-web/v2.92.1) (2025-07-06)


### Bug Fixes

* ensure next uses app version as sentry release number ([#1634](https://github.com/akash-network/console/issues/1634)) ([68a86d1](https://github.com/akash-network/console/commit/68a86d1f448af8a4ba1d20c76a97f7026664f40c))


### Code Refactoring

* gets rid of next.js publicRuntimeConfig ([#1633](https://github.com/akash-network/console/issues/1633)) ([a4decb6](https://github.com/akash-network/console/commit/a4decb6655fc35c1195e3e3924cd1de46b6c1bfa))

## [2.92.0](https://github.com/akash-network/console/compare/console-web/v2.91.3...console-web/v2.92.0) (2025-07-05)


### Features

* adds error handling for react queries ([#1626](https://github.com/akash-network/console/issues/1626)) ([0b96968](https://github.com/akash-network/console/commit/0b96968346701b0b1f32a4b8f8f2445d6a54d6c2))


### Bug Fixes

* ignore errors in SQL formatting ([#1630](https://github.com/akash-network/console/issues/1630)) ([ad21ab0](https://github.com/akash-network/console/commit/ad21ab0e8c581db930d6e5987de9492a8d717f6d))

## [2.91.3](https://github.com/akash-network/console/compare/console-web/v2.91.2...console-web/v2.91.3) (2025-07-05)


### Bug Fixes

* fixes url for gpu-models ([#1627](https://github.com/akash-network/console/issues/1627)) ([aa15984](https://github.com/akash-network/console/commit/aa1598487a377f18dbe3387c9d82365b30037d35))
* properly propagate cpu value from slider ([#1629](https://github.com/akash-network/console/issues/1629)) ([0dc2174](https://github.com/akash-network/console/commit/0dc2174028105cff27d144e18e698cb1b50f5781))

## [2.91.2](https://github.com/akash-network/console/compare/console-web/v2.91.1...console-web/v2.91.2) (2025-07-04)


### Code Refactoring

* replaces direct dep on axios to injected via useServices one ([#1622](https://github.com/akash-network/console/issues/1622)) ([dfb52ae](https://github.com/akash-network/console/commit/dfb52ae5f154c854aaf9b9cfa4d1ef25892bce31))

## [2.91.1](https://github.com/akash-network/console/compare/console-web/v2.91.0...console-web/v2.91.1) (2025-07-02)


### Bug Fixes

* **auth:** revert absolute path to proxy ([#1611](https://github.com/akash-network/console/issues/1611)) ([b881749](https://github.com/akash-network/console/commit/b8817495a63ef6ccebcb7a3457e5941001b13e9e))

## [2.91.0](https://github.com/akash-network/console/compare/console-web/v2.90.2...console-web/v2.91.0) (2025-07-02)


### Features

* **billing:** filter payment methods ([#1610](https://github.com/akash-network/console/issues/1610)) ([3db9833](https://github.com/akash-network/console/commit/3db9833084e7dfcf5370298aead681ae527609db))


### Bug Fixes

* **auth:** recude cookie size for auth0 ([#1606](https://github.com/akash-network/console/issues/1606)) ([0536aff](https://github.com/akash-network/console/commit/0536aff17430887a74b64af759730c64c7bc44ab))
* **billing:** improve stripe error handling ([#1569](https://github.com/akash-network/console/issues/1569)) ([f567c75](https://github.com/akash-network/console/commit/f567c75f9c63ecadbd3f9eec8d58588be195743c))


### Code Refactoring

* move /v1/proposals to modules ([#1434](https://github.com/akash-network/console/issues/1434)) ([d6cd3c5](https://github.com/akash-network/console/commit/d6cd3c5cc53090784c79334195ae5c298a07a68e)), closes [#1269](https://github.com/akash-network/console/issues/1269) [#1269](https://github.com/akash-network/console/issues/1269)

## [2.90.2](https://github.com/akash-network/console/compare/console-web/v2.90.1...console-web/v2.90.2) (2025-07-01)


### Bug Fixes

* **config:** replace proxy url ([#1604](https://github.com/akash-network/console/issues/1604)) ([af9aa70](https://github.com/akash-network/console/commit/af9aa70755a176f6d9e8b1cbd981cf55eb181e99))


### Code Refactoring

* move /v1/addresses/* to modules ([#1468](https://github.com/akash-network/console/issues/1468)) ([ba0a0f7](https://github.com/akash-network/console/commit/ba0a0f75c56c1656ea4d8f88eaaaa812de5e3aec)), closes [#1267](https://github.com/akash-network/console/issues/1267) [#1267](https://github.com/akash-network/console/issues/1267) [#1267](https://github.com/akash-network/console/issues/1267)

## [2.90.1](https://github.com/akash-network/console/compare/console-web/v2.90.0...console-web/v2.90.1) (2025-06-30)


### Bug Fixes

* **alert:** properly submits existing deployment alert form ([91273df](https://github.com/akash-network/console/commit/91273df73ccb03eb669a16e3a0bc1676507bb2ff))

## [2.90.0](https://github.com/akash-network/console/compare/console-web/v2.89.6...console-web/v2.90.0) (2025-06-30)


### Features

* **alert:** only sends diff for deployment alerts upsert  ([b9fe702](https://github.com/akash-network/console/commit/b9fe7021cd90fe227cdb4c011fff6a31d17ed54b)), closes [#1548](https://github.com/akash-network/console/issues/1548)

## [2.89.6](https://github.com/akash-network/console/compare/console-web/v2.89.5...console-web/v2.89.6) (2025-06-28)


### Bug Fixes

* ensure getAllItems cyclic loop check happens after the 1st iteration ([#1573](https://github.com/akash-network/console/issues/1573)) ([349e15a](https://github.com/akash-network/console/commit/349e15a578df1a801a786d5b7a27e1354385d537))
* updates @akashnetwork/akashjs ([#1575](https://github.com/akash-network/console/issues/1575)) ([ae86837](https://github.com/akash-network/console/commit/ae868378ae35db3342ff5d44f9d270644178c507))
* upgrades nodejs to higher version ([#1563](https://github.com/akash-network/console/issues/1563)) ([dac08eb](https://github.com/akash-network/console/commit/dac08ebadcc29164eda2e76417ac85ec210ea1b0))

## [2.89.5](https://github.com/akash-network/console/compare/console-web/v2.89.4...console-web/v2.89.5) (2025-06-26)


### Bug Fixes

* ensure getAllItems doesn't stuck inside infinite loop ([#1562](https://github.com/akash-network/console/issues/1562)) ([f8a8ba2](https://github.com/akash-network/console/commit/f8a8ba277f5b8b8cd25d1c4a831d0642e9505557))

## [2.89.4](https://github.com/akash-network/console/compare/console-web/v2.89.3...console-web/v2.89.4) (2025-06-26)


### Bug Fixes

* makes axios not to throw on 400 error for getting deployment ([#1552](https://github.com/akash-network/console/issues/1552)) ([f85947e](https://github.com/akash-network/console/commit/f85947efd64ac4b566f020d9a4691ab092fb46ab))


### Code Refactoring

* ensure alerts are not rendered when they are disabled ([#1557](https://github.com/akash-network/console/issues/1557)) ([8c3d8b9](https://github.com/akash-network/console/commit/8c3d8b98f3ec640c1f49d2f0ac08f9db6e259ffe))

## [2.89.3](https://github.com/akash-network/console/compare/console-web/v2.89.2...console-web/v2.89.3) (2025-06-25)


### Bug Fixes

* adds blockchain node API proxy to the list of mainnet nework urls ([#1553](https://github.com/akash-network/console/issues/1553)) ([35cd01a](https://github.com/akash-network/console/commit/35cd01a5969b2bdd78abd4eaa8baacdd3a676bc3))

## [2.89.2](https://github.com/akash-network/console/compare/console-web/v2.89.1...console-web/v2.89.2) (2025-06-24)


### Bug Fixes

* **alert:** properly calculates deployment escrow balance ([4ea20e4](https://github.com/akash-network/console/commit/4ea20e4a7846a0fa588b9d8b8ad036f8165409c8))

## [2.89.1](https://github.com/akash-network/console/compare/console-web/v2.89.0...console-web/v2.89.1) (2025-06-24)


### Bug Fixes

* **alert:** clear up unsaved changes for a closed deployment ([8792ec7](https://github.com/akash-network/console/commit/8792ec771419e1a94e288b983e00530c88489e8d))

## [2.89.0](https://github.com/akash-network/console/compare/console-web/v2.88.0...console-web/v2.89.0) (2025-06-24)


### Features

* **alert:** uses back nav blocker having unsaved changes ([ace5358](https://github.com/akash-network/console/commit/ace53583d029387d54e3ae0714c8d995c0f7b2f3))


### Bug Fixes

* enable sourcemaps for deploy-web ([#1538](https://github.com/akash-network/console/issues/1538)) ([a9beccd](https://github.com/akash-network/console/commit/a9beccd9aa7a9c22853b70125ea10dbc625ae729))

## [2.88.0](https://github.com/akash-network/console/compare/console-web/v2.87.1...console-web/v2.88.0) (2025-06-23)


### Features

* **alert:** implements notification channel safe delete ([e023ce0](https://github.com/akash-network/console/commit/e023ce09fd6612c9c2d0d3e9dc3178648975bd5d))

## [2.87.1](https://github.com/akash-network/console/compare/console-web/v2.87.0...console-web/v2.87.1) (2025-06-23)


### Bug Fixes

* **alert:** convert akt denom to udenom when saving balance alert threshold ([5da379a](https://github.com/akash-network/console/commit/5da379ae430971637396f19f9784fc4806f6a505))

## [2.87.0](https://github.com/akash-network/console/compare/console-web/v2.86.0...console-web/v2.87.0) (2025-06-22)


### Features

* **alert:** disables form if deployment is closed ([cc46ea9](https://github.com/akash-network/console/commit/cc46ea9ed37e9fece145f4ce740fe190fd177ea6))
* **alert:** improves deployment alerts list UI ([d81d92d](https://github.com/akash-network/console/commit/d81d92da218186d2af454c4411a2d641762722b0))
* **alert:** improves deployment alerts UI  ([04a55a9](https://github.com/akash-network/console/commit/04a55a94d1bfac91acfc448f07641bab752192eb))


### Code Refactoring

* move /v1/nodes and /v1/version to a module ([#1458](https://github.com/akash-network/console/issues/1458)) ([fc814db](https://github.com/akash-network/console/commit/fc814db50418300b608b7ddeb7173b3a3882aa38)), closes [#1271](https://github.com/akash-network/console/issues/1271) [#1276](https://github.com/akash-network/console/issues/1276)

## [2.86.0](https://github.com/akash-network/console/compare/console-web/v2.85.0...console-web/v2.86.0) (2025-06-17)


### Features

* adds possibility to pass multiple env variables into Env variable popup ([#1501](https://github.com/akash-network/console/issues/1501)) ([9f7c89e](https://github.com/akash-network/console/commit/9f7c89e1c4363fe80b5d5ddeeef1bd0e4f0d2faf))

## [2.85.0](https://github.com/akash-network/console/compare/console-web/v2.84.0...console-web/v2.85.0) (2025-06-16)


### Features

* **notifications:** improves alerts list and forms UI ([aa9223c](https://github.com/akash-network/console/commit/aa9223c2ff0bf44cab9833e4d13cae7365173224))

## [2.84.0](https://github.com/akash-network/console/compare/console-web/v2.83.0...console-web/v2.84.0) (2025-06-16)


### Features

* **auth:** uses user aware feature flagging in console web ([19ae4e1](https://github.com/akash-network/console/commit/19ae4e1e015839621fcb9d5ba7ade2a1ad64bc7a))

## [2.83.0](https://github.com/akash-network/console/compare/console-web/v2.82.2...console-web/v2.83.0) (2025-06-16)


### Features

* adds feature flags support to console-api's notifications proxy ([#1472](https://github.com/akash-network/console/issues/1472)) ([c663c55](https://github.com/akash-network/console/commit/c663c552cb1d03e38fcf13efc2b89086cf7c4585))

## [2.82.2](https://github.com/akash-network/console/compare/console-web/v2.82.1...console-web/v2.82.2) (2025-06-12)


### Bug Fixes

* **deployment:** styling deployment detail ([#1478](https://github.com/akash-network/console/issues/1478)) ([d59ce15](https://github.com/akash-network/console/commit/d59ce15fe0a3378ac453777992e566b5efd36624))

## [2.82.1](https://github.com/akash-network/console/compare/console-web/v2.82.0...console-web/v2.82.1) (2025-06-12)


### Bug Fixes

* **billing:** staging stripe pk ([#1474](https://github.com/akash-network/console/issues/1474)) ([59aa45b](https://github.com/akash-network/console/commit/59aa45b387db77fd1e4ca7c0c9f4e2a681b1842d))

## [2.82.0](https://github.com/akash-network/console/compare/console-web/v2.81.0...console-web/v2.82.0) (2025-06-12)


### Features

* **alert:** authorizes deployment alerts by dseq+owner ([59d0a7c](https://github.com/akash-network/console/commit/59d0a7ccdec2060afe0ef8c89c0d1cf3bd9c0d0d)), closes [#1455](https://github.com/akash-network/console/issues/1455)


### Bug Fixes

* **billing:** stripe publish key ([#1473](https://github.com/akash-network/console/issues/1473)) ([80800a8](https://github.com/akash-network/console/commit/80800a89992b86d8c7f184b60d9d9761dec55670))

## [2.81.0](https://github.com/akash-network/console/compare/console-web/v2.80.1...console-web/v2.81.0) (2025-06-11)


### Features

* **billing:** stripe integration ([#1443](https://github.com/akash-network/console/issues/1443)) ([85c046b](https://github.com/akash-network/console/commit/85c046b1f7286b6c5fea41251712b3e89f413163))

## [2.80.1](https://github.com/akash-network/console/compare/console-web/v2.80.0...console-web/v2.80.1) (2025-06-11)


### Code Refactoring

* migrates another part of console api to strict types ([#1462](https://github.com/akash-network/console/issues/1462)) ([7d91eb8](https://github.com/akash-network/console/commit/7d91eb8c8539e1a264e0fcc5f963d162cadf8775))
* move /v1/leases-duration/{owner} to modules ([#1440](https://github.com/akash-network/console/issues/1440)) ([605bb55](https://github.com/akash-network/console/commit/605bb55060546974c4c32970c6572d8b315533bd)), closes [#1280](https://github.com/akash-network/console/issues/1280)

## [2.80.0](https://github.com/akash-network/console/compare/console-web/v2.79.3...console-web/v2.80.0) (2025-06-09)


### Features

* **alert:** add list ui ([f30775c](https://github.com/akash-network/console/commit/f30775c060675d8d35df6826dde0b88097ffece9))


### Bug Fixes

* fixes e2e tests and adds closeDeployments script ([#1446](https://github.com/akash-network/console/issues/1446)) ([92d7389](https://github.com/akash-network/console/commit/92d73895ff9f8422929365d3e4dfda10f6982796))


### Code Refactoring

* **notification-channel:** renames contact-point to notification-channel and alert statuses ([4b0ef57](https://github.com/akash-network/console/commit/4b0ef57029e00ac105ad8e82747ced8be552f9af))

## [2.79.3](https://github.com/akash-network/console/compare/console-web/v2.79.2...console-web/v2.79.3) (2025-06-08)


### Code Refactoring

* refactors turnstile and add tests ([#1421](https://github.com/akash-network/console/issues/1421)) ([79aadc2](https://github.com/akash-network/console/commit/79aadc2002520c8993fd20a3221511201512fd8d))

## [2.79.2](https://github.com/akash-network/console/compare/console-web/v2.79.1...console-web/v2.79.2) (2025-06-06)


### Bug Fixes

* **alert:** properly validates threshold limits ([1dcaff1](https://github.com/akash-network/console/commit/1dcaff141be75e6ffeddaedea91f6c1f8bf49951))

## [2.79.1](https://github.com/akash-network/console/compare/console-web/v2.79.0...console-web/v2.79.1) (2025-06-06)


### Bug Fixes

* fixes unathorized response from provider API ([#1438](https://github.com/akash-network/console/issues/1438)) ([959eae7](https://github.com/akash-network/console/commit/959eae7be87c0bcdcce2aeea3dc5ace4915b27f9))

## [2.79.0](https://github.com/akash-network/console/compare/console-web/v2.78.3...console-web/v2.79.0) (2025-06-06)


### Features

* **alert:** adds alerts name column ([5297d9f](https://github.com/akash-network/console/commit/5297d9fb9e80b67827292cb0385fdaa0587e508b)), closes [#1415](https://github.com/akash-network/console/issues/1415)
* **alert:** implements deployment alerts ([7fc89b3](https://github.com/akash-network/console/commit/7fc89b3a69131d496833d3ae0c297a884b100660))
* **contact-point:** fetches contact point on the backend for edit ([3d1b0e3](https://github.com/akash-network/console/commit/3d1b0e378dbdd7d1aa140515e309827c00b01042))
* **contact-point:** implements edit ui ([e370baf](https://github.com/akash-network/console/commit/e370baf8dcd8f2581c164f075e309391c8bcaa4b))
* **deployment:** use persistent tab query for details page  ([baeeb07](https://github.com/akash-network/console/commit/baeeb076f0a5d60109aaabf5d1a18817e33f680a))


### Code Refactoring

* move /v1/dashboard-data to modules ([#1372](https://github.com/akash-network/console/issues/1372)) ([1d165ad](https://github.com/akash-network/console/commit/1d165ad2bc78ad8a18521938e3720779c8da04c4)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* move /v1/deployment/{owner}/{dseq} to modules ([#1428](https://github.com/akash-network/console/issues/1428)) ([6138431](https://github.com/akash-network/console/commit/61384314fb6b3403192f14b2ea5290a53059f6e3)), closes [#1268](https://github.com/akash-network/console/issues/1268)
* move /v1/market-data to modules ([#1430](https://github.com/akash-network/console/issues/1430)) ([bd0e78c](https://github.com/akash-network/console/commit/bd0e78c5d29e2c520c8f7f64acd24d831ecd0006)), closes [#1278](https://github.com/akash-network/console/issues/1278)
* move /v1/validators to modules ([#1431](https://github.com/akash-network/console/issues/1431)) ([d2edc96](https://github.com/akash-network/console/commit/d2edc96dd2e70ffe91fec7bd86f25b658fb85c61)), closes [#1275](https://github.com/akash-network/console/issues/1275)

## [2.78.3](https://github.com/akash-network/console/compare/console-web/v2.78.2...console-web/v2.78.3) (2025-05-30)


### Bug Fixes

* another attempt to stabilize e2e tests for deploy hello world case ([#1414](https://github.com/akash-network/console/issues/1414)) ([ddddf57](https://github.com/akash-network/console/commit/ddddf57c21d5eab12b2590e7546928626fc45c67))

## [2.78.2](https://github.com/akash-network/console/compare/console-web/v2.78.1...console-web/v2.78.2) (2025-05-29)


### Bug Fixes

* docker node permissions ([#1410](https://github.com/akash-network/console/issues/1410)) ([073b43a](https://github.com/akash-network/console/commit/073b43aa1f89192bd9f96193f7d721d34840a441))

## [2.78.1](https://github.com/akash-network/console/compare/console-web/v2.78.0...console-web/v2.78.1) (2025-05-29)


### Code Refactoring

* **contact-point:** decouple list components, rename pagination methods  ([7b9d620](https://github.com/akash-network/console/commit/7b9d62072118352399debae136ae8b5554142e19))

## [2.78.0](https://github.com/akash-network/console/compare/console-web/v2.77.7...console-web/v2.78.0) (2025-05-28)


### Features

* **contact-point:** implements list ui ([b9d8c24](https://github.com/akash-network/console/commit/b9d8c24eb826897a4462949503b30ef6134a3bc7))

## [2.77.7](https://github.com/akash-network/console/compare/console-web/v2.77.6...console-web/v2.77.7) (2025-05-28)


### Bug Fixes

* **notifications:** allows alert pages to registered users only ([5b27148](https://github.com/akash-network/console/commit/5b271488c9e4839917dd48998ed10cf0086b1006))

## [2.77.6](https://github.com/akash-network/console/compare/console-web/v2.77.5...console-web/v2.77.6) (2025-05-28)


### Bug Fixes

* extracts injected config into a hook ([#1386](https://github.com/akash-network/console/issues/1386)) ([7ecfdad](https://github.com/akash-network/console/commit/7ecfdad29a6cbbf93e872938a3c72e255f14281f))

## [2.77.5](https://github.com/akash-network/console/compare/console-web/v2.77.4...console-web/v2.77.5) (2025-05-28)


### Bug Fixes

* **notifications:** improves interface loading and deps management  ([c9cd03a](https://github.com/akash-network/console/commit/c9cd03aa67a5e62ac43edcc9f819600e5e179dce))

## [2.77.4](https://github.com/akash-network/console/compare/console-web/v2.77.3...console-web/v2.77.4) (2025-05-28)


### Bug Fixes

* update auth0 audience and issuer ([#1382](https://github.com/akash-network/console/issues/1382)) ([6e66727](https://github.com/akash-network/console/commit/6e667277a8c4f9ed787bcdc2094377fe4ae625b1))

## [2.77.3](https://github.com/akash-network/console/compare/console-web/v2.77.2...console-web/v2.77.3) (2025-05-27)


### Bug Fixes

* **release:** builds notifications image w/o nginx ([d68bf9a](https://github.com/akash-network/console/commit/d68bf9a94c118aa65656e15924163ba9d54a4e2b))

## [2.77.2](https://github.com/akash-network/console/compare/console-web/v2.77.1...console-web/v2.77.2) (2025-05-26)


### Bug Fixes

* **release:** adds notifications to docker setup  ([6951faf](https://github.com/akash-network/console/commit/6951faf46850643515757c7c16c328bbf622fa76))

## [2.77.1](https://github.com/akash-network/console/compare/console-web/v2.77.0...console-web/v2.77.1) (2025-05-26)


### Bug Fixes

* ensure balances are not fetched before chain node API is selected ([#1365](https://github.com/akash-network/console/issues/1365)) ([e0109dc](https://github.com/akash-network/console/commit/e0109dcc5e5eca142693625e42e820f52171844b))

## [2.77.0](https://github.com/akash-network/console/compare/console-web/v2.76.0...console-web/v2.77.0) (2025-05-23)


### Features

* **contact-point:** implements list endpoint and auth ([0f11115](https://github.com/akash-network/console/commit/0f11115622a6cf58623f33e35902e4814793d9a8))
* integrates child di container ([#1358](https://github.com/akash-network/console/issues/1358)) ([554ea1e](https://github.com/akash-network/console/commit/554ea1e077ad4cad628311576bb9e4ced6a91f5a))


### Code Refactoring

* replaces server side turnstile config provision with injected config ([#1353](https://github.com/akash-network/console/issues/1353)) ([dafe16a](https://github.com/akash-network/console/commit/dafe16a02769ea638e837395f68829f42ccb93d5))

## [2.76.0](https://github.com/akash-network/console/compare/console-web/v2.75.0...console-web/v2.76.0) (2025-05-22)


### Features

* **analytics:** add gtm ([#1351](https://github.com/akash-network/console/issues/1351)) ([312899b](https://github.com/akash-network/console/commit/312899b9b2fe7ad7e3a1b93e79f37cb06e4eb6e3))

## [2.75.0](https://github.com/akash-network/console/compare/console-web/v2.74.2...console-web/v2.75.0) (2025-05-21)


### Features

* **contact-point:** implements unleash feature flagging and contact creation ui ([6ad02ce](https://github.com/akash-network/console/commit/6ad02ce382dc76b9d317aa3934416da3605ad53b))
* **notifications:** implements swagger and code generation  ([ed61a3a](https://github.com/akash-network/console/commit/ed61a3a7730ef088dd31f4db9006b106eac4c6c4))
* **styling:** improve sidebar ([#1344](https://github.com/akash-network/console/issues/1344)) ([77e88dd](https://github.com/akash-network/console/commit/77e88dd9a61b0d38ded8e108a58a6de093a29de7))


### Bug Fixes

* **provider:** websocket closure bug ([#1346](https://github.com/akash-network/console/issues/1346)) ([fe9803b](https://github.com/akash-network/console/commit/fe9803b49e02632bddc4f925d0a1bc5f8cd6ab14))

## [2.74.2](https://github.com/akash-network/console/compare/console-web/v2.74.1...console-web/v2.74.2) (2025-05-16)


### Bug Fixes

* **jwt:** add prettier file ([#1336](https://github.com/akash-network/console/issues/1336)) ([7460fd6](https://github.com/akash-network/console/commit/7460fd67750d916d1ee7b69aa97eee079b5da090))

## [2.74.1](https://github.com/akash-network/console/compare/console-web/v2.74.0...console-web/v2.74.1) (2025-05-16)


### Bug Fixes

* shows wallet balance on intial rendering ([#1333](https://github.com/akash-network/console/issues/1333)) ([0dc01ba](https://github.com/akash-network/console/commit/0dc01bace3d635d89ab833c464fba80f0401cec2)), closes [#1235](https://github.com/akash-network/console/issues/1235)

## [2.74.0](https://github.com/akash-network/console/compare/console-web/v2.73.3...console-web/v2.74.0) (2025-05-16)


### Features

* jwt provider schema ([#1312](https://github.com/akash-network/console/issues/1312)) ([379a2d3](https://github.com/akash-network/console/commit/379a2d3ceb519e8b49c75373b8aa7a4a735bf599))
* **wallet:** authz manager improve ([#1321](https://github.com/akash-network/console/issues/1321)) ([5d2d726](https://github.com/akash-network/console/commit/5d2d7262a931a3f2cc962a36c2b644258d025d5a))

## [2.73.3](https://github.com/akash-network/console/compare/console-web/v2.73.2...console-web/v2.73.3) (2025-05-16)


### Bug Fixes

* comment for test token in deploy-web ([#1328](https://github.com/akash-network/console/issues/1328)) ([1c9baff](https://github.com/akash-network/console/commit/1c9baff2b6c30b428be89c52a99d81e76f971a99))

## [2.73.2](https://github.com/akash-network/console/compare/console-web/v2.73.1...console-web/v2.73.2) (2025-05-16)


### Code Refactoring

* fetches turnstile sitekey from api ([#1318](https://github.com/akash-network/console/issues/1318)) ([eff83d0](https://github.com/akash-network/console/commit/eff83d0bca34c386658f93d01ded072f663aac08))

## [2.73.1](https://github.com/akash-network/console/compare/console-web/v2.73.0...console-web/v2.73.1) (2025-05-15)


### Code Refactoring

* move provider endpoints to modules ([#1309](https://github.com/akash-network/console/issues/1309)) ([6c5a434](https://github.com/akash-network/console/commit/6c5a4343c50b49b35833cfbce810a65ae3c75ed7)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* **notifications:** implement modular configuration architecture ([ead91e4](https://github.com/akash-network/console/commit/ead91e4fdc04a799b32f0d9725bcb62fbaeeb8fd))

## [2.73.0](https://github.com/akash-network/console/compare/console-web/v2.72.1...console-web/v2.73.0) (2025-05-12)


### Features

* **analytics:** removes amplitude sampling ([dedff8a](https://github.com/akash-network/console/commit/dedff8a062b182e3408a2d6bfc5915da90791a6c))


### Code Refactoring

* move provider-active-leases-graph-data to modules ([#1301](https://github.com/akash-network/console/issues/1301)) ([f1c004f](https://github.com/akash-network/console/commit/f1c004fb8379c1d6301c3cb1209924fcc64a8021)), closes [#1272](https://github.com/akash-network/console/issues/1272)

## [2.72.1](https://github.com/akash-network/console/compare/console-web/v2.72.0...console-web/v2.72.1) (2025-05-10)


### Bug Fixes

* manifest forbidden error ([#1295](https://github.com/akash-network/console/issues/1295)) ([80171b2](https://github.com/akash-network/console/commit/80171b23a25ded7c0998319cce87cf167d5deb0d))


### Code Refactoring

* move provider listing to its service ([#1291](https://github.com/akash-network/console/issues/1291)) ([1a44de4](https://github.com/akash-network/console/commit/1a44de4f46e52d68e2bda6f4c1b906d8cf7724b6)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* unify methods listing leases ([#1302](https://github.com/akash-network/console/issues/1302)) ([2876f9c](https://github.com/akash-network/console/commit/2876f9ccffc66d85537e6574ec3d6ad5b9399b70)), closes [#1272](https://github.com/akash-network/console/issues/1272)
* uses logger and http sdk from local pkgs for notification service ([fe3539b](https://github.com/akash-network/console/commit/fe3539b5995aca4f88fe281da5ac282779ee3f8e))

## [2.72.0](https://github.com/akash-network/console/compare/console-web/v2.71.0...console-web/v2.72.0) (2025-05-01)


### Features

* **deployment:** managed api all deployments ([#1243](https://github.com/akash-network/console/issues/1243)) ([d86d748](https://github.com/akash-network/console/commit/d86d7484fa5b683329a84c6bfba1f6bcb46132bc))


### Bug Fixes

* **deployment:** template list logo dark ([#1287](https://github.com/akash-network/console/issues/1287)) ([49f3fd3](https://github.com/akash-network/console/commit/49f3fd36c20e38bd6a6055804c2e9656881377b6))
* use placeholder in profile social inputs ([#1289](https://github.com/akash-network/console/issues/1289)) ([444788b](https://github.com/akash-network/console/commit/444788b4a841531239b4579256df358416f79804))


### Code Refactoring

* **authorization:** use react-table for deployment grants  ([cfd28ab](https://github.com/akash-network/console/commit/cfd28aba79a349f17293a669f8104b8565db8e8d)), closes [#595](https://github.com/akash-network/console/issues/595)
* drop react-query 3 ([#1244](https://github.com/akash-network/console/issues/1244)) ([8378b60](https://github.com/akash-network/console/commit/8378b6028610f98b013c09f03596af4506cca32e)), closes [#337](https://github.com/akash-network/console/issues/337) [#337](https://github.com/akash-network/console/issues/337)

## [2.71.0](https://github.com/akash-network/console/compare/console-web/v2.70.0...console-web/v2.71.0) (2025-04-24)


### Features

* **config:** specifies backend urls as relative paths ([9b2ab95](https://github.com/akash-network/console/commit/9b2ab95adad7e5a7b9d6018a0f2c6d712836b110))

## [2.70.0](https://github.com/akash-network/console/compare/console-web/v2.69.0...console-web/v2.70.0) (2025-04-23)


### Features

* **analytics:** add linkedin script ([#1255](https://github.com/akash-network/console/issues/1255)) ([12c9dd3](https://github.com/akash-network/console/commit/12c9dd3681eb94db0261d1358ccf33d565a5476f))


### Bug Fixes

* **styling:** sidebar collapsed styling ([#1254](https://github.com/akash-network/console/issues/1254)) ([920a570](https://github.com/akash-network/console/commit/920a570e1b9795b1366d73be1e9da6a9e79d90be))

## [2.69.0](https://github.com/akash-network/console/compare/console-web/v2.68.2...console-web/v2.69.0) (2025-04-17)


### Features

* **analytics:** track user action on the backend ([d0ae4da](https://github.com/akash-network/console/commit/d0ae4da0d176b03e6621db32a97cf36c8cd4c8d5))


### Bug Fixes

* **deployment:** provider name might be null ([#1209](https://github.com/akash-network/console/issues/1209)) ([5c622d4](https://github.com/akash-network/console/commit/5c622d44f0cd045b3e32cb7d2818977175c12551)), closes [#1197](https://github.com/akash-network/console/issues/1197) [#1197](https://github.com/akash-network/console/issues/1197)
* ensure SSR initiated request forward real client ip ([#1210](https://github.com/akash-network/console/issues/1210)) ([4fb0427](https://github.com/akash-network/console/commit/4fb0427c295141c572ff0b3c2d8874feadaa2590))


### Code Refactoring

* removes sentry from console-api ([#1220](https://github.com/akash-network/console/issues/1220)) ([8339158](https://github.com/akash-network/console/commit/8339158321771e716cddd7de4242d7de370697d0))

## [2.68.2](https://github.com/akash-network/console/compare/console-web/v2.68.1...console-web/v2.68.2) (2025-04-15)


### Bug Fixes

* update react-query in a few places ([#1159](https://github.com/akash-network/console/issues/1159)) ([be806c8](https://github.com/akash-network/console/commit/be806c8ce50a969198b7ba409750961f1a8e4363)), closes [#337](https://github.com/akash-network/console/issues/337)

## [2.68.1](https://github.com/akash-network/console/compare/console-web/v2.68.0...console-web/v2.68.1) (2025-04-15)


### Bug Fixes

* disables nodejs auto family selection ([#1212](https://github.com/akash-network/console/issues/1212)) ([c6be104](https://github.com/akash-network/console/commit/c6be104cf583a07d20fb9f92661ffa29e23b492a))

## [2.68.0](https://github.com/akash-network/console/compare/console-web/v2.67.2...console-web/v2.68.0) (2025-04-10)


### Features

* **billing:** managed wallet api balances endpoint ([#1183](https://github.com/akash-network/console/issues/1183)) ([68024bc](https://github.com/akash-network/console/commit/68024bc394d1d846779a82038abb8b52a694cf21))


### Bug Fixes

* **analytics:** fix default import for ga events ([#1202](https://github.com/akash-network/console/issues/1202)) ([a54d65f](https://github.com/akash-network/console/commit/a54d65f17c2db89a899e1e41c3a70d04a114f0d4))

## [2.67.2](https://github.com/akash-network/console/compare/console-web/v2.67.1...console-web/v2.67.2) (2025-04-10)


### Bug Fixes

* makes sure that deploy-web proxy sends real ip to console api ([#1188](https://github.com/akash-network/console/issues/1188)) ([b11cf5d](https://github.com/akash-network/console/commit/b11cf5dd1ff52a81ecfed411cda1d95abc2f7772))

## [2.67.1](https://github.com/akash-network/console/compare/console-web/v2.67.0...console-web/v2.67.1) (2025-04-08)


### Bug Fixes

* **release:** points web to sub-paths for the api and provider proxy in prod ([026af31](https://github.com/akash-network/console/commit/026af3165d83d4d73e1d42a90f6c3b7d1a9844a8))

## [2.67.0](https://github.com/akash-network/console/compare/console-web/v2.66.1...console-web/v2.67.0) (2025-04-08)


### Features

* **analytics:** sends analytics directly ([ba56b39](https://github.com/akash-network/console/commit/ba56b39ee24189303d58c0216debb55a0e215a6e))

## [2.66.1](https://github.com/akash-network/console/compare/console-web/v2.66.0...console-web/v2.66.1) (2025-04-07)


### Bug Fixes

* **release:** points to a sub-path for the api and provider proxy in beta ([eaef0f4](https://github.com/akash-network/console/commit/eaef0f4415f976f18079bd9b7a81256b7f0f2867))

## [2.66.0](https://github.com/akash-network/console/compare/console-web/v2.65.1...console-web/v2.66.0) (2025-04-02)


### Features

* dynamic amount of storages ([411aa68](https://github.com/akash-network/console/commit/411aa68273926d51eec4511929e17e09baae4b7a)), closes [#175](https://github.com/akash-network/console/issues/175)

## [2.65.1](https://github.com/akash-network/console/compare/console-web/v2.65.0...console-web/v2.65.1) (2025-04-01)


### Bug Fixes

* **deployment:** append trial attribute for anon only ([#1155](https://github.com/akash-network/console/issues/1155)) ([814e154](https://github.com/akash-network/console/commit/814e154a4bcaaea74507a87a3af3c9a628154835))

## [2.65.0](https://github.com/akash-network/console/compare/console-web/v2.64.0...console-web/v2.65.0) (2025-03-31)


### Features

* **deployment:** managed wallet api update deployment ([#1093](https://github.com/akash-network/console/issues/1093)) ([6998834](https://github.com/akash-network/console/commit/699883436cc1763a20f65cce17390403107b179a))
* show a popup on start trial ([#1116](https://github.com/akash-network/console/issues/1116)) ([fdee6e6](https://github.com/akash-network/console/commit/fdee6e6148a4b14d857aeb91f1612a634e72f5e0)), closes [#826](https://github.com/akash-network/console/issues/826)
* upgrade nodejs version to 22.14 (latest lts) ([#1095](https://github.com/akash-network/console/issues/1095)) ([8533b35](https://github.com/akash-network/console/commit/8533b355762016829c4435fd67c7885df79b251e))


### Bug Fixes

* **deployment:** fix import sdl in render ([#1127](https://github.com/akash-network/console/issues/1127)) ([7e34b7c](https://github.com/akash-network/console/commit/7e34b7c1703ae76d77bdb76269b7cd7e9626ea04))


### Code Refactoring

* moves trial authorization spending out of db transaction ([#1129](https://github.com/akash-network/console/issues/1129)) ([8c8e372](https://github.com/akash-network/console/commit/8c8e3729ce7c1f7ad2c387b471b326f1fbc0d353))

## [2.64.0](https://github.com/akash-network/console/compare/console-web/v2.63.0...console-web/v2.64.0) (2025-03-28)


### Features

* **deployment:** show banner for trial users with no bids ([#922](https://github.com/akash-network/console/issues/922)) ([344af36](https://github.com/akash-network/console/commit/344af36c7c9172f22e4bcfdc2ea3fe62284a49a8)), closes [#887](https://github.com/akash-network/console/issues/887)


### Bug Fixes

* change the link to "learn more" during tx sign ([#1122](https://github.com/akash-network/console/issues/1122)) ([e77d95a](https://github.com/akash-network/console/commit/e77d95ab4525fbae02bcca856040ae677f61fbf5))

## [2.63.0](https://github.com/akash-network/console/compare/console-web/v2.62.4...console-web/v2.63.0) (2025-03-26)


### Features

* adds basic feature flags support to api and deploy-web ([#1113](https://github.com/akash-network/console/issues/1113)) ([130407c](https://github.com/akash-network/console/commit/130407ce8632cde4cea49394ba01267a1962d158))


### Bug Fixes

* update nextjs version ([#1105](https://github.com/akash-network/console/issues/1105)) ([5d24cd8](https://github.com/akash-network/console/commit/5d24cd851eac88a0fbf04899ffdda689994c2b8b))
* update react-query in a few places ([#1084](https://github.com/akash-network/console/issues/1084)) ([7473929](https://github.com/akash-network/console/commit/7473929504ad9d3527688082084e521a64741a25)), closes [#337](https://github.com/akash-network/console/issues/337)

## [2.62.4](https://github.com/akash-network/console/compare/console-web/v2.62.3...console-web/v2.62.4) (2025-03-24)


### Bug Fixes

* **deployment:** sign up for trial ([#1098](https://github.com/akash-network/console/issues/1098)) ([777340d](https://github.com/akash-network/console/commit/777340da91505a3dd1754ee5aea4e9d9f47f8108))

## [2.62.3](https://github.com/akash-network/console/compare/console-web/v2.62.2...console-web/v2.62.3) (2025-03-21)


### Bug Fixes

* **auth:** removes turnstile widget before rendering ([bd32f01](https://github.com/akash-network/console/commit/bd32f0132e6151ebb46f6b03903cb0cbd82cbd4f))

## [2.62.2](https://github.com/akash-network/console/compare/console-web/v2.62.1...console-web/v2.62.2) (2025-03-21)


### Bug Fixes

* **auth:** removes a turnstile widget before rendering ([153c1d1](https://github.com/akash-network/console/commit/153c1d157e837abf4597d1f0439f183b2cd45b92))

## [2.62.1](https://github.com/akash-network/console/compare/console-web/v2.62.0...console-web/v2.62.1) (2025-03-20)


### Bug Fixes

* **auth:** removes a turnstile widget before rendering ([69bb2b0](https://github.com/akash-network/console/commit/69bb2b06c1c68fe96a16faf0f7e292c7d9a5aa9b))


### Code Refactoring

* enable eslint rules which restricts what dependencies can be used ([#1074](https://github.com/akash-network/console/issues/1074)) ([509fcd3](https://github.com/akash-network/console/commit/509fcd39831311950afdfb51c189ef46b02c855f))

## [2.62.0](https://github.com/akash-network/console/compare/console-web/v2.61.1...console-web/v2.62.0) (2025-03-20)


### Features

* improves error logging for AggregateError ([#1072](https://github.com/akash-network/console/issues/1072)) ([c0ca85c](https://github.com/akash-network/console/commit/c0ca85c13b608457e65b8e90dad2d6cc310dd643))
* introduce multi-line commands ([e58349b](https://github.com/akash-network/console/commit/e58349b7eeb5f28adc80dbedd4cf3b5ca304b72f)), closes [#175](https://github.com/akash-network/console/issues/175)


### Bug Fixes

* ensure release can detect changes for apps based on local packages ([#1070](https://github.com/akash-network/console/issues/1070)) ([e1053c4](https://github.com/akash-network/console/commit/e1053c456ba718fc58a93799e550e9338d9aea45))
* updates dockerfile for node apps ([#1068](https://github.com/akash-network/console/issues/1068)) ([54194a0](https://github.com/akash-network/console/commit/54194a08ca514f1be623a20e7a01cfbbf2e2244a))

## [2.61.1](https://github.com/akash-network/console/compare/console-web/v2.61.0...console-web/v2.61.1) (2025-03-19)


### Code Refactoring

* migrates console-web components to strict types ([#1050](https://github.com/akash-network/console/issues/1050)) ([bd1e3e7](https://github.com/akash-network/console/commit/bd1e3e734d249d36189d49e3fabad7d22d43fd99))
* refactors console-web pages to strict types ([#1052](https://github.com/akash-network/console/issues/1052)) ([68c0ef0](https://github.com/akash-network/console/commit/68c0ef07ab35ce2a2bc5e94b8d47ce1740c98236))

## [2.61.0](https://github.com/akash-network/console/compare/console-web/v2.60.0...console-web/v2.61.0) (2025-03-18)


### Features

* **deployment:** managed api deposit ([#1055](https://github.com/akash-network/console/issues/1055)) ([f407320](https://github.com/akash-network/console/commit/f40732079f79c39cceb533c82ac6d48f058dd388))

## [2.60.0](https://github.com/akash-network/console/compare/console-web/v2.59.0...console-web/v2.60.0) (2025-03-18)


### Features

* **deployment:** limit number of deployments for trials ([#923](https://github.com/akash-network/console/issues/923)) ([d681d51](https://github.com/akash-network/console/commit/d681d51c02501f61b81742fb4fd36aea6f536cea)), closes [#827](https://github.com/akash-network/console/issues/827)

## [2.59.0](https://github.com/akash-network/console/compare/console-web/v2.58.0...console-web/v2.59.0) (2025-03-17)


### Features

* **analytics:** move lease created script ([#1051](https://github.com/akash-network/console/issues/1051)) ([65ac516](https://github.com/akash-network/console/commit/65ac5163e2760ca25e71a9c8f686313304774413))

## [2.58.0](https://github.com/akash-network/console/compare/console-web/v2.57.1...console-web/v2.58.0) (2025-03-17)


### Features

* **wallet:** improve coupon codes ux ([#1028](https://github.com/akash-network/console/issues/1028)) ([b4a81c7](https://github.com/akash-network/console/commit/b4a81c79b97213ae72d37efe4771129f5b69b5ef))


### Code Refactoring

* refactors queries and hooks to strict types ([#1044](https://github.com/akash-network/console/issues/1044)) ([6f520ba](https://github.com/akash-network/console/commit/6f520ba6e0fe4b38b39a61841141513b1c6c8980))

## [2.57.1](https://github.com/akash-network/console/compare/console-web/v2.57.0...console-web/v2.57.1) (2025-03-14)


### Bug Fixes

* **wallet:** fix fetching of authz ([#1017](https://github.com/akash-network/console/issues/1017)) ([37a0b2d](https://github.com/akash-network/console/commit/37a0b2d0f29ed11e4aa0b11c1d4fd919094373fb))
* **wallet:** fix top-up amount button spacing ([#964](https://github.com/akash-network/console/issues/964)) ([15ab5a2](https://github.com/akash-network/console/commit/15ab5a240db371ec19f16cd52a3723243c3a0ece)), closes [#668](https://github.com/akash-network/console/issues/668)

## [2.57.0](https://github.com/akash-network/console/compare/console-web/v2.56.0...console-web/v2.57.0) (2025-03-13)


### Features

* **analytics:** adds more user onboarding events ([4e87ad4](https://github.com/akash-network/console/commit/4e87ad445d6e233dc1986e757b850082f65c172d))


### Code Refactoring

* refactors part of deploy-web to strict typescript types ([#1003](https://github.com/akash-network/console/issues/1003)) ([6ac6bb2](https://github.com/akash-network/console/commit/6ac6bb2ba919c933b923d40c56ea26f9788caed7))
* refactors services in console-web to strict types ([#1004](https://github.com/akash-network/console/issues/1004)) ([fd85685](https://github.com/akash-network/console/commit/fd85685858b64ead49a946955fe8da48ea9cc49b))

## [2.56.0](https://github.com/akash-network/console/compare/console-web/v2.55.0...console-web/v2.56.0) (2025-03-13)


### Features

* **analytics:** add pixels scripts ([#1005](https://github.com/akash-network/console/issues/1005)) ([010210b](https://github.com/akash-network/console/commit/010210b957f9cc53d867f26b635a6a0993bf5da6))
* **deployment:** remove maintenance banner ([#1006](https://github.com/akash-network/console/issues/1006)) ([705952e](https://github.com/akash-network/console/commit/705952e5d5f29429e98399878b32b24f557b618e))

## [2.55.0](https://github.com/akash-network/console/compare/console-web/v2.54.0...console-web/v2.55.0) (2025-03-11)


### Features

* **deployment:** re-add banner vars ([#992](https://github.com/akash-network/console/issues/992)) ([8575352](https://github.com/akash-network/console/commit/85753529636e238323f542db1c068304b60406de))

## [2.54.0](https://github.com/akash-network/console/compare/console-web/v2.53.4...console-web/v2.54.0) (2025-03-11)


### Features

* **deployment:** add maintenant banner component ([#991](https://github.com/akash-network/console/issues/991)) ([d939e25](https://github.com/akash-network/console/commit/d939e25a9d03ad3876e6fdef624105a70a60c45d))


### Code Refactoring

* moves ProviderRawData and its unit tests under a single folder ([#978](https://github.com/akash-network/console/issues/978)) ([962fe7e](https://github.com/akash-network/console/commit/962fe7ea106ce9f62bb772358508d94cacb6fd38))

## [2.53.4](https://github.com/akash-network/console/compare/console-web/v2.53.3...console-web/v2.53.4) (2025-03-10)


### Bug Fixes

* **template:** eliminates eternal loop when query if failing  ([ca93b51](https://github.com/akash-network/console/commit/ca93b5123725394094aada5149811de548717d94))

## [2.53.3](https://github.com/akash-network/console/compare/console-web/v2.53.2...console-web/v2.53.3) (2025-03-10)


### Bug Fixes

* fix border clipping on EnvFormModal ([e8b2d5f](https://github.com/akash-network/console/commit/e8b2d5f90c16d25330995a07bec436968111b318))

## [2.53.2](https://github.com/akash-network/console/compare/console-web/v2.53.1...console-web/v2.53.2) (2025-03-07)


### Bug Fixes

* ensure that sdl is truthy before passing it to `importSimpleDSL` ([#960](https://github.com/akash-network/console/issues/960)) ([08a00cd](https://github.com/akash-network/console/commit/08a00cd204f67c469da0ee607542cf6bcf0106a9))

## [2.53.1](https://github.com/akash-network/console/compare/console-web/v2.53.0...console-web/v2.53.1) (2025-03-06)


### Bug Fixes

* handles case when service.uris is null ([#957](https://github.com/akash-network/console/issues/957)) ([82b43c5](https://github.com/akash-network/console/commit/82b43c58786bf31af94cd1c12c2ab572dede4fb5))
* renders turnstile only on client side ([#949](https://github.com/akash-network/console/issues/949)) ([d282d20](https://github.com/akash-network/console/commit/d282d20ae2cb5e78704190a5016081766467d6ff))

## [2.53.0](https://github.com/akash-network/console/compare/console-web/v2.52.0...console-web/v2.53.0) (2025-03-05)


### Features

* **certificate:** managed wallet api create certificates ([#903](https://github.com/akash-network/console/issues/903)) ([e00ef07](https://github.com/akash-network/console/commit/e00ef07444a9a8bce9c5c4d5749b4adff5e8903b))


### Bug Fixes

* ensure user has local certificate before checking lease status ([#943](https://github.com/akash-network/console/issues/943)) ([c53dfc1](https://github.com/akash-network/console/commit/c53dfc1006f2eb3ea30092efd05715f842090150))

## [2.52.0](https://github.com/akash-network/console/compare/console-web/v2.51.0...console-web/v2.52.0) (2025-03-04)


### Features

* displays first lease service uri on deployment list if deployment name is unknown and small UX improvements ([#924](https://github.com/akash-network/console/issues/924)) ([f3e9b8d](https://github.com/akash-network/console/commit/f3e9b8d96878fab4cc89c37a2ad7747ab844c1b1))


### Bug Fixes

* **template:** forces templates seo meta rendering on the backend ([cc674d8](https://github.com/akash-network/console/commit/cc674d807526fde167c9a768ec2cd5be7075a040)), closes [#786](https://github.com/akash-network/console/issues/786)


### Code Refactoring

* replaces TemplatesContext with direct usage of useTemplates on top of react-query ([#935](https://github.com/akash-network/console/issues/935)) ([ce5dc1e](https://github.com/akash-network/console/commit/ce5dc1e04737765f76b486356d77d9ddc3723317))

## [2.51.0](https://github.com/akash-network/console/compare/console-web/v2.50.0...console-web/v2.51.0) (2025-03-03)


### Features

* **analytics:** improves amplitude reporting ([c8399ae](https://github.com/akash-network/console/commit/c8399ae3a08d13de35679bd6e6acac49f504a66a))


### Bug Fixes

* **auth:** patches fetch to retry on cloudflare challenge ([c6f4c7d](https://github.com/akash-network/console/commit/c6f4c7d5f97e318cef77d232011dcee9b10f5aa8)), closes [#836](https://github.com/akash-network/console/issues/836)

## [2.50.0](https://github.com/akash-network/console/compare/console-web/v2.49.1...console-web/v2.50.0) (2025-02-24)


### Features

* **billing:** unify deployment modals ([#804](https://github.com/akash-network/console/issues/804)) ([03137c6](https://github.com/akash-network/console/commit/03137c68740b76a7ad162415425b566148dd7bd3)), closes [#628](https://github.com/akash-network/console/issues/628) [#628](https://github.com/akash-network/console/issues/628) [#628](https://github.com/akash-network/console/issues/628) [#628](https://github.com/akash-network/console/issues/628) [#628](https://github.com/akash-network/console/issues/628)


### Bug Fixes

* **provider:** render longer provider names, make them copiable ([#898](https://github.com/akash-network/console/issues/898)) ([64f8fa0](https://github.com/akash-network/console/commit/64f8fa02a5b98a75b08382db97c0534ed26ed959)), closes [#858](https://github.com/akash-network/console/issues/858) [#858](https://github.com/akash-network/console/issues/858)

## [2.49.1](https://github.com/akash-network/console/compare/console-web/v2.49.0...console-web/v2.49.1) (2025-02-21)


### Bug Fixes

* **deployment:** only enables auto top up if deposit is successful ([151b781](https://github.com/akash-network/console/commit/151b78178ff392fd2106e598bb01e481ddf8086d))

## [2.49.0](https://github.com/akash-network/console/compare/console-web/v2.48.0...console-web/v2.49.0) (2025-02-20)


### Features

* **users:** api keys UI ([#857](https://github.com/akash-network/console/issues/857)) ([32f9567](https://github.com/akash-network/console/commit/32f9567f05590c2d9bbd6445366570c474f8e063))

## [2.48.0](https://github.com/akash-network/console/compare/console-web/v2.47.0...console-web/v2.48.0) (2025-02-20)


### Features

* **deployment:** requires a deposit to maintain a deployment till the next auto top up ([e3ad957](https://github.com/akash-network/console/commit/e3ad9579d6336912b1e51ca8f983f64322571d2d)), closes [#714](https://github.com/akash-network/console/issues/714)


### Bug Fixes

* **sdl:** can use AMD GPUs  ([1569a35](https://github.com/akash-network/console/commit/1569a35fda166bab34d3ba5e41207acf2545ed80)), closes [#64](https://github.com/akash-network/console/issues/64)

## [2.47.0](https://github.com/akash-network/console/compare/console-web/v2.46.0...console-web/v2.47.0) (2025-02-19)


### Features

* **auth:** adds turnstile interceptor to all the services ([f4b517a](https://github.com/akash-network/console/commit/f4b517a35a1bf54ccad26304f37c5213d8635ab8))

## [2.46.0](https://github.com/akash-network/console/compare/console-web/v2.45.0...console-web/v2.46.0) (2025-02-19)


### Features

* **analytics:** integrates amplitude ([c88ff59](https://github.com/akash-network/console/commit/c88ff59c19c0096916afa3774b2d15a1bd30d3eb))

## [2.45.0](https://github.com/akash-network/console/compare/console-web/v2.44.0...console-web/v2.45.0) (2025-02-14)


### Features

* **user:** add user api keys schema + api ([2eac7e9](https://github.com/akash-network/console/commit/2eac7e97246f63570bdd7d9d9700438e99948c7f)), closes [#787](https://github.com/akash-network/console/issues/787)


### Bug Fixes

* **sdl:** break controls earlier so columns don't overlap  ([c9d3b45](https://github.com/akash-network/console/commit/c9d3b4528a7a1e864f98541d1a93fbf7622f7cde)), closes [#828](https://github.com/akash-network/console/issues/828)

## [2.44.0](https://github.com/akash-network/console/compare/console-web/v2.43.0...console-web/v2.44.0) (2025-02-10)


### Features

* **analytics:** lease conversion events ([76beedf](https://github.com/akash-network/console/commit/76beedf2cb17d94ca53df127a40f9cfabb852231)), closes [#817](https://github.com/akash-network/console/issues/817)

## [2.43.0](https://github.com/akash-network/console/compare/console-web/v2.42.1...console-web/v2.43.0) (2025-02-07)


### Features

* **deployment:** creates setting if not exists on get ([66cd74b](https://github.com/akash-network/console/commit/66cd74b039e6fab8c848a296047d1669b9c5a574)), closes [#714](https://github.com/akash-network/console/issues/714)


### Bug Fixes

* ensure that deployment details are not fetched unless node api endpoint is not empty ([#806](https://github.com/akash-network/console/issues/806)) ([8fc4523](https://github.com/akash-network/console/commit/8fc4523034e06036bddc75378d1503d7ba8ead64))

## [2.42.1](https://github.com/akash-network/console/compare/console-web/v2.42.0...console-web/v2.42.1) (2025-02-06)


### Bug Fixes

* **deployment:** adds usdc option to parse pricing amount ([0f38c18](https://github.com/akash-network/console/commit/0f38c18c521b2cc68fe79d3634623baea5a59f64)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.42.0](https://github.com/akash-network/console/compare/console-web/v2.41.0...console-web/v2.42.0) (2025-02-06)


### Features

* **deployment:** adds auto top feature flag ([da008e9](https://github.com/akash-network/console/commit/da008e9251a52bbd53a0cc10ac3e026ddd8652f1)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.41.0](https://github.com/akash-network/console/compare/console-web/v2.40.0...console-web/v2.41.0) (2025-02-06)


### Features

* adds certificate validation to ws proxy ([#780](https://github.com/akash-network/console/issues/780)) ([2d1cc3d](https://github.com/akash-network/console/commit/2d1cc3d7c39ec50ea3ca292d3d3bce47db3185ca)), closes [#170](https://github.com/akash-network/console/issues/170)
* **deployment:** add new badge ([dd338ee](https://github.com/akash-network/console/commit/dd338ee7b4e6378a5627d4ea16fdf14a056145c6)), closes [#796](https://github.com/akash-network/console/issues/796)

## [2.40.0](https://github.com/akash-network/console/compare/console-web/v2.39.0...console-web/v2.40.0) (2025-02-05)


### Features

* **deployment:** add help sidebar link ([54c501c](https://github.com/akash-network/console/commit/54c501c65276c621b7bf440d758a7c5a4ae3acb6)), closes [#788](https://github.com/akash-network/console/issues/788)

## [2.39.0](https://github.com/akash-network/console/compare/console-web/v2.38.0...console-web/v2.39.0) (2025-02-05)


### Features

* **deployment:** implements ui auto top up toggle ([f03df32](https://github.com/akash-network/console/commit/f03df324e1064f76b477cf888278eb4ad8f443cf)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.38.0](https://github.com/akash-network/console/compare/console-web/v2.37.1...console-web/v2.38.0) (2025-02-03)


### Features

* **deployment:** reworks top up deployments to rely on db setting ([2762b97](https://github.com/akash-network/console/commit/2762b97bbbb8d63566a258a683a5a0989f6885b4)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.37.1](https://github.com/akash-network/console/compare/console-web/v2.37.0...console-web/v2.37.1) (2025-01-31)


### Bug Fixes

* **dx:** fix e2e tests ([9ab53ef](https://github.com/akash-network/console/commit/9ab53eff42a43c4f02757b4b19aa5877f25c366e)), closes [#741](https://github.com/akash-network/console/issues/741)

## [2.37.0](https://github.com/akash-network/console/compare/console-web/v2.36.2...console-web/v2.37.0) (2025-01-30)


### Features

* **auth:** forwards cf cookies in proxy ([3711a9d](https://github.com/akash-network/console/commit/3711a9d3b780c2fb3215168cc017dd4794233faa))

## [2.36.2](https://github.com/akash-network/console/compare/console-web/v2.36.1...console-web/v2.36.2) (2025-01-29)


### Bug Fixes

* **auth:** simplifies turnstile widget error display ([198fe5d](https://github.com/akash-network/console/commit/198fe5d893e6e0d501707a61711f0f8215b1849f))

## [2.36.1](https://github.com/akash-network/console/compare/console-web/v2.36.0...console-web/v2.36.1) (2025-01-29)


### Bug Fixes

* **auth:** checks for cf error more generally ([1582ff8](https://github.com/akash-network/console/commit/1582ff81eff9fa0546c7c372d24a061756261840))

## [2.36.0](https://github.com/akash-network/console/compare/console-web/v2.35.0...console-web/v2.36.0) (2025-01-29)


### Features

* adjusts logic to send provider and chain details to provider proxy ([#742](https://github.com/akash-network/console/issues/742)) ([a5ca831](https://github.com/akash-network/console/commit/a5ca8313c9ef545336889d8a536e4cf92c537c61))

## [2.35.0](https://github.com/akash-network/console/compare/console-web/v2.34.0...console-web/v2.35.0) (2025-01-28)


### Features

* only shows turnstile widget when cf rejects ([#722](https://github.com/akash-network/console/issues/722)) ([0537f2c](https://github.com/akash-network/console/commit/0537f2cece2c9e1a95547f41ac5c802471342b94))


### Code Refactoring

* changes provider-proxy URL for console-web staging env ([#731](https://github.com/akash-network/console/issues/731)) ([e89994e](https://github.com/akash-network/console/commit/e89994e2f1c00780ba1f5d333eb87c600669ca80))

## [2.34.0](https://github.com/akash-network/console/compare/console-web/v2.33.1...console-web/v2.34.0) (2025-01-27)


### Features

* **deployment:** add deepseek showcase ([#724](https://github.com/akash-network/console/issues/724)) ([926cae8](https://github.com/akash-network/console/commit/926cae830314c35cff8b03dfa76bc6719ab9da00))

## [2.33.1](https://github.com/akash-network/console/compare/console-web/v2.33.0...console-web/v2.33.1) (2025-01-24)


### Bug Fixes

* **deployment:** fix deployment not found ([#709](https://github.com/akash-network/console/issues/709)) ([548e538](https://github.com/akash-network/console/commit/548e5387f2265290af872e35393b1f430737c9a3))

## [2.33.0](https://github.com/akash-network/console/compare/console-web/v2.32.0...console-web/v2.33.0) (2025-01-21)


### Features

* **auth:** implement verification email re-send and rework relevant UI ([#676](https://github.com/akash-network/console/issues/676)) ([c2de6a6](https://github.com/akash-network/console/commit/c2de6a6f92dbb44b1758836f2a42de8eb81f4c94)), closes [#663](https://github.com/akash-network/console/issues/663)

## [2.32.0](https://github.com/akash-network/console/compare/console-web/v2.31.0...console-web/v2.32.0) (2025-01-20)


### Features

* **stats:** shows ephemeral and persistent storage separately on pie chart ([#647](https://github.com/akash-network/console/issues/647)) ([7512198](https://github.com/akash-network/console/commit/75121983391db0b932b324656a939370c47827c7)), closes [#645](https://github.com/akash-network/console/issues/645) [#665](https://github.com/akash-network/console/issues/665)


### Bug Fixes

* **wallet:** crash when spend limit not set ([0280e58](https://github.com/akash-network/console/commit/0280e58e09427f115ea1a73b614388af075b20b1)), closes [#651](https://github.com/akash-network/console/issues/651)

## [2.31.0](https://github.com/akash-network/console/compare/console-web/v2.30.1...console-web/v2.31.0) (2025-01-17)


### Features

* **auth:** improve turnstile widget UX ([#666](https://github.com/akash-network/console/issues/666)) ([b42714e](https://github.com/akash-network/console/commit/b42714e77fc0feed65af6f959cd0dc27e750994a))

## [2.30.1](https://github.com/akash-network/console/compare/console-web/v2.30.0...console-web/v2.30.1) (2025-01-16)


### Bug Fixes

* **auth:** revert cf clearance cookie forwarding to api via auth proxy ([ac6aca5](https://github.com/akash-network/console/commit/ac6aca5752fd66d144fcb6c5eafbe69c6bc91401))

## [2.30.0](https://github.com/akash-network/console/compare/console-web/v2.29.2...console-web/v2.30.0) (2025-01-16)


### Features

* **auth:** forward cf clearance cookie to api via auth proxy ([bd81f2f](https://github.com/akash-network/console/commit/bd81f2f36c8f8f53e01d5dd4c879f99de1b9d151))

## [2.29.2](https://github.com/akash-network/console/compare/console-web/v2.29.1...console-web/v2.29.2) (2025-01-16)


### Code Refactoring

* **dx:** fix linting issues ([1115a60](https://github.com/akash-network/console/commit/1115a609ba6a080e4c91331f45fb0d12b48c5504))

## [2.29.1](https://github.com/akash-network/console/compare/console-web/v2.29.0...console-web/v2.29.1) (2025-01-16)


### Bug Fixes

* **auth:** ensure turnstile widget is only shown initially on when interactive ([71f7ea8](https://github.com/akash-network/console/commit/71f7ea8ae843bade1a8fb4bbe7f71cc0731cf42e)), closes [#627](https://github.com/akash-network/console/issues/627)

## [2.29.0](https://github.com/akash-network/console/compare/console-web/v2.28.3...console-web/v2.29.0) (2025-01-15)


### Features

* **auth:** add a turnstile widget ([d485fbb](https://github.com/akash-network/console/commit/d485fbbf292a8a671d478eb1f03cfc208cda5e6f)), closes [#627](https://github.com/akash-network/console/issues/627)

## [2.28.3](https://github.com/akash-network/console/compare/console-web/v2.28.2...console-web/v2.28.3) (2025-01-14)


### Bug Fixes

* **deployment:** provider label ([#632](https://github.com/akash-network/console/issues/632)) ([f96c570](https://github.com/akash-network/console/commit/f96c570cf31b4ab3cb6470dc1ad043a7173c3792))

## [2.28.2](https://github.com/akash-network/console/compare/console-web/v2.28.1...console-web/v2.28.2) (2025-01-08)


### Bug Fixes

* **deployment:** validate max deposit amount correctly ([44c0274](https://github.com/akash-network/console/commit/44c02745635510b8b5eb6bb4f9462b232543f393)), closes [#603](https://github.com/akash-network/console/issues/603)

## [2.28.1](https://github.com/akash-network/console/compare/console-web/v2.28.0...console-web/v2.28.1) (2025-01-02)


### Bug Fixes

* **user:** revoke stale users expired grants ([21cbfa6](https://github.com/akash-network/console/commit/21cbfa654d2a3effa11b8b83404158256142c1d5))

## [2.28.0](https://github.com/akash-network/console/compare/console-web/v2.27.10...console-web/v2.28.0) (2025-01-02)


### Features

* **user:** remove anonymous user from localstorage if it's removed ([36298ee](https://github.com/akash-network/console/commit/36298ee0ba4426d5fe2e70cf741b90e26773fc01))


### Bug Fixes

* **billing:** properly reference a var in balances hook ([ba53d6b](https://github.com/akash-network/console/commit/ba53d6b70341f0bb03aaa609a05b8a73931b5120))

## [2.27.10](https://github.com/akash-network/console/compare/console-web/v2.27.9...console-web/v2.27.10) (2024-12-30)


### Bug Fixes

* **billing:** fix usdc balance calculation ([18b6ef3](https://github.com/akash-network/console/commit/18b6ef3a0785f115651eec5afcbe25ab433af386))

## [2.27.9](https://github.com/akash-network/console/compare/console-web/v2.27.8...console-web/v2.27.9) (2024-12-30)


### Bug Fixes

* **billing:** properly check fee grant before tx ([b721141](https://github.com/akash-network/console/commit/b72114172847514cbccbd831db3503d20f533aed))

## [2.27.8](https://github.com/akash-network/console/compare/console-web/v2.27.7...console-web/v2.27.8) (2024-12-30)


### Bug Fixes

* **billing:** disable grantee grants query for managed deployments deposit modal ([91bf940](https://github.com/akash-network/console/commit/91bf9401bf8d9558465f009a0c01b39afef6a349))

## [2.27.7](https://github.com/akash-network/console/compare/console-web/v2.27.6...console-web/v2.27.7) (2024-12-30)


### Bug Fixes

* **billing:** enable balances fetching back ([eaa42a5](https://github.com/akash-network/console/commit/eaa42a5ecd04db87bcbd5f4d9ac75771f4e20244))

## [2.27.6](https://github.com/akash-network/console/compare/console-web/v2.27.5...console-web/v2.27.6) (2024-12-30)


### Bug Fixes

* **billing:** use specific endpoint to check managed wallet grants ([d87d79f](https://github.com/akash-network/console/commit/d87d79fbe29350c57c625e61e7f9805c5dc0b6ea))

## [2.27.5](https://github.com/akash-network/console/compare/console-web/v2.27.4...console-web/v2.27.5) (2024-12-27)


### Bug Fixes

* make sure to deposit with 0 balance ([8246395](https://github.com/akash-network/console/commit/8246395ba15e622ba5c82824548e18b16ffc0101))

## [2.27.4](https://github.com/akash-network/console/compare/console-web/v2.27.3...console-web/v2.27.4) (2024-12-27)


### Bug Fixes

* make sure to deposit with 0 balance ([c166b0e](https://github.com/akash-network/console/commit/c166b0e5a76f7099160cde6dfbe449e0ff266058))

## [2.27.3](https://github.com/akash-network/console/compare/console-web/v2.27.2...console-web/v2.27.3) (2024-12-27)


### Bug Fixes

* update balance warning ([ec004a7](https://github.com/akash-network/console/commit/ec004a78631cc32bc281b50d1af3c0225faf2f19))

## [2.27.2](https://github.com/akash-network/console/compare/console-web/v2.27.0...console-web/v2.27.2) (2024-12-27)


### Bug Fixes

* disable grantee grants temporarily ([1a992c1](https://github.com/akash-network/console/commit/1a992c1031ca8b17d6c0c613d9eba4286e54175b))
* update package version ([a873df7](https://github.com/akash-network/console/commit/a873df7dcc77b57c065ac1bb5783603e921bf673))

## [2.27.1](https://github.com/akash-network/console/compare/console-web/v2.27.0...console-web/v2.27.1) (2024-12-27)


### Bug Fixes

* disable grantee grants temporarily ([1a992c1](https://github.com/akash-network/console/commit/1a992c1031ca8b17d6c0c613d9eba4286e54175b))

## [2.27.0](https://github.com/akash-network/console/compare/console-web/v2.26.0...console-web/v2.27.0) (2024-12-19)


### Features

* **billing:** resolve with valid only grants and allowances from http service ([77a0ffc](https://github.com/akash-network/console/commit/77a0ffcfe0ce912814d3e3803af6b1ac803cde71))

## [2.26.0](https://github.com/akash-network/console/compare/console-web/v2.25.4...console-web/v2.26.0) (2024-12-18)


### Features

* **wallet:** save selected wallet type local storage ([9d1c5b5](https://github.com/akash-network/console/commit/9d1c5b5a444633012cdda800a55b4ff904b6ee58)), closes [#570](https://github.com/akash-network/console/issues/570)

## [2.25.4](https://github.com/akash-network/console/compare/console-web/v2.25.4-beta.0...console-web/v2.25.4) (2024-12-10)

## [2.25.4-beta.0](https://github.com/akash-network/console/compare/console-web/v2.25.3...console-web/v2.25.4-beta.0) (2024-12-10)


### Bug Fixes

* **billing:** check for email verified to add funds ([e1cfa10](https://github.com/akash-network/console/commit/e1cfa10835ad29938f12812f8b28d582213850ec)), closes [#535](https://github.com/akash-network/console/issues/535)

## [2.25.3](https://github.com/akash-network/console/compare/console-web/v2.25.3-beta.1...console-web/v2.25.3) (2024-12-05)

## [2.25.3-beta.1](https://github.com/akash-network/console/compare/console-web/v2.25.3-beta.0...console-web/v2.25.3-beta.1) (2024-12-05)


### Bug Fixes

* **config:** increase nginx large header buffer limit ([#526](https://github.com/akash-network/console/issues/526)) ([192b9a2](https://github.com/akash-network/console/commit/192b9a27d1f43f88762cca625ff19460281a9995))

## [2.25.3-beta.0](https://github.com/akash-network/console/compare/console-web/v2.25.2...console-web/v2.25.3-beta.0) (2024-12-05)


### Bug Fixes

* **billing:** mobile banner styling ([566d941](https://github.com/akash-network/console/commit/566d9416149698d195e2463f32903496ff497a22)), closes [#525](https://github.com/akash-network/console/issues/525)

## [2.25.2](https://github.com/akash-network/console/compare/console-web/v2.25.2-beta.0...console-web/v2.25.2) (2024-12-04)

## [2.25.2-beta.0](https://github.com/akash-network/console/compare/console-web/v2.25.1...console-web/v2.25.2-beta.0) (2024-12-04)


### Bug Fixes

* **billing:** banner light mode styling ([a5aa61b](https://github.com/akash-network/console/commit/a5aa61bff15bfbb4f2e4bdf7664f983f79b10f3a)), closes [#520](https://github.com/akash-network/console/issues/520)

## [2.25.1](https://github.com/akash-network/console/compare/console-web/v2.25.1-beta.2...console-web/v2.25.1) (2024-12-04)

## [2.25.1-beta.2](https://github.com/akash-network/console/compare/console-web/v2.25.1-beta.1...console-web/v2.25.1-beta.2) (2024-12-04)

## [2.25.1-beta.1](https://github.com/akash-network/console/compare/console-web/v2.25.1-beta.0...console-web/v2.25.1-beta.1) (2024-12-03)


### Bug Fixes

* ensure proper schema type on server props getter ([aedf03d](https://github.com/akash-network/console/commit/aedf03d837fd6b2ebd6e76b32a694e043053a441))

## [2.25.1-beta.0](https://github.com/akash-network/console/compare/console-web/v2.25.0...console-web/v2.25.1-beta.0) (2024-11-28)


### Bug Fixes

* **observability:** ensure pino-pretty works in built app ([7f6f9ca](https://github.com/akash-network/console/commit/7f6f9ca7ca4e1ff4bc3b85735270f61cc8120242)), closes [#474](https://github.com/akash-network/console/issues/474)

## [2.25.0](https://github.com/akash-network/console/compare/console-web/v2.25.0-beta.1...console-web/v2.25.0) (2024-11-26)

## [2.25.0-beta.1](https://github.com/akash-network/console/compare/console-web/v2.25.0-beta.0...console-web/v2.25.0-beta.1) (2024-11-26)


### Features

* **deployment:** implement ato top up setting ([1301314](https://github.com/akash-network/console/commit/130131485a68f699587415f96283e0dc83072502)), closes [#412](https://github.com/akash-network/console/issues/412)


### Bug Fixes

* **billing:** ensure checkout pricing is displayed correctly ([3bcb4a8](https://github.com/akash-network/console/commit/3bcb4a881e3bb58e741de8bb8a0a661dede0d8ae))

## [2.25.0-beta.0](https://github.com/akash-network/console/compare/console-web/v2.24.1...console-web/v2.25.0-beta.0) (2024-11-23)


### Features

* **provider:** new provider trial endpoint ([2712e38](https://github.com/akash-network/console/commit/2712e380b8f5af0930abbdf9347a1dee3eb75f8a)), closes [#488](https://github.com/akash-network/console/issues/488)

## [2.24.1](https://github.com/akash-network/console/compare/console-web/v2.24.1-beta.2...console-web/v2.24.1) (2024-11-23)

## [2.24.1-beta.2](https://github.com/akash-network/console/compare/console-web/v2.24.1-beta.1...console-web/v2.24.1-beta.2) (2024-11-21)


### Bug Fixes

* **deployment:** latest processed height deployment stale ([8d8384f](https://github.com/akash-network/console/commit/8d8384f519ae958e324a81fbf5a2ae00383bddc3)), closes [#491](https://github.com/akash-network/console/issues/491)

## [2.24.1-beta.1](https://github.com/akash-network/console/compare/console-web/v2.24.1-beta.0...console-web/v2.24.1-beta.1) (2024-11-21)


### Bug Fixes

* **deployment:** git template fetch in deploy ([094aaf4](https://github.com/akash-network/console/commit/094aaf48b7b00ed4af3299fac0fb584a09e12866)), closes [#489](https://github.com/akash-network/console/issues/489)

## [2.24.1-beta.0](https://github.com/akash-network/console/compare/console-web/v2.24.0...console-web/v2.24.1-beta.0) (2024-11-21)


### Bug Fixes

* **billing:** only show pricing options when available ([6e31276](https://github.com/akash-network/console/commit/6e31276d4fcb56d9a74d7b1b04226a80a5795bec))

## [2.24.0](https://github.com/akash-network/console/compare/console-web/v2.24.0-beta.0...console-web/v2.24.0) (2024-11-21)

## [2.24.0-beta.0](https://github.com/akash-network/console/compare/console-web/v2.23.0...console-web/v2.24.0-beta.0) (2024-11-21)


### Features

* **billing:** enable checkout options with promo codes ([0cb439d](https://github.com/akash-network/console/commit/0cb439dcf4ca21974d7dacd784570cd032ee9f7b))

## [2.23.0](https://github.com/akash-network/console/compare/console-web/v2.23.0-beta.3...console-web/v2.23.0) (2024-11-19)

## [2.23.0-beta.3](https://github.com/akash-network/console/compare/console-web/v2.23.0-beta.2...console-web/v2.23.0-beta.3) (2024-11-19)


### Features

* **sdl:** sdl builder private containers ([95a6e2b](https://github.com/akash-network/console/commit/95a6e2b11353b1c07a23f763ef9c9216855025b1)), closes [#479](https://github.com/akash-network/console/issues/479)

## [2.23.0-beta.2](https://github.com/akash-network/console/compare/console-web/v2.23.0-beta.1...console-web/v2.23.0-beta.2) (2024-11-19)


### Bug Fixes

* **deployment:** managed wallet user template ([ab83f2f](https://github.com/akash-network/console/commit/ab83f2f699e84b3a4f90739d2d003a9f8e9d27aa)), closes [#483](https://github.com/akash-network/console/issues/483)

## [2.23.0-beta.1](https://github.com/akash-network/console/compare/console-web/v2.23.0-beta.0...console-web/v2.23.0-beta.1) (2024-11-19)


### Features

* **analytics:** add user analytics and refactor analytic related logic ([552cd82](https://github.com/akash-network/console/commit/552cd8244634bf1de49875ce0d9b7490466ae5b0))

## [2.23.0-beta.0](https://github.com/akash-network/console/compare/console-web/v2.22.1...console-web/v2.23.0-beta.0) (2024-11-18)


### Features

* **deployment:** implement concurrency option for stale deployments cleaner ([54cae5d](https://github.com/akash-network/console/commit/54cae5d0f3c37dd6fe6623bcc249379f99cad247))

## [2.22.1](https://github.com/akash-network/console/compare/console-web/v2.22.1-beta.0...console-web/v2.22.1) (2024-11-14)

## [2.22.1-beta.0](https://github.com/akash-network/console/compare/console-web/v2.22.0...console-web/v2.22.1-beta.0) (2024-11-14)


### Bug Fixes

* **wallet:** wallet connect managed to custodial ([037f3f6](https://github.com/akash-network/console/commit/037f3f689a6d7c86ef282771366e481eb6532ba7)), closes [#469](https://github.com/akash-network/console/issues/469)

## [2.22.0](https://github.com/akash-network/console/compare/console-web/v2.22.0-beta.0...console-web/v2.22.0) (2024-11-12)

## [2.22.0-beta.0](https://github.com/akash-network/console/compare/console-web/v2.21.1-beta.1...console-web/v2.22.0-beta.0) (2024-11-12)


### Features

* **deployment:** implement top up message sending ([f5d7233](https://github.com/akash-network/console/commit/f5d7233c6ce1e7fc880e817e7d8ff66967b8a547)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.21.1-beta.1](https://github.com/akash-network/console/compare/console-web/v2.21.1-beta.0...console-web/v2.21.1-beta.1) (2024-11-11)


### Bug Fixes

* **deployment:** trial provider attributes ([6f5c94d](https://github.com/akash-network/console/commit/6f5c94d41879a8d23ed129857f5d28285d4f9ee9)), closes [#453](https://github.com/akash-network/console/issues/453)

## [2.21.1-beta.0](https://github.com/akash-network/console/compare/console-web/v2.21.0...console-web/v2.21.1-beta.0) (2024-11-08)


### Bug Fixes

* **auth:** fix logout button not logging out completely ([#446](https://github.com/akash-network/console/issues/446)) ([96f45dd](https://github.com/akash-network/console/commit/96f45dd617ef32fe813de03026c9370498099f34))

## [2.21.0](https://github.com/akash-network/console/compare/console-web/v2.21.0-beta.2...console-web/v2.21.0) (2024-11-08)

## [2.21.0-beta.2](https://github.com/akash-network/console/compare/console-web/v2.21.0-beta.1...console-web/v2.21.0-beta.2) (2024-11-08)


### Features

* **deployment:** implement clean up of managed deployments ([882fac4](https://github.com/akash-network/console/commit/882fac457f91d968bd9ecd3129c9a2113c3dd0bf)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.21.0-beta.1](https://github.com/akash-network/console/compare/console-web/v2.21.0-beta.0...console-web/v2.21.0-beta.1) (2024-11-07)


### Features

* **deployment:** improve new deployment page ([3ffc38b](https://github.com/akash-network/console/commit/3ffc38b2e942f11fc1ab11624aaa653745de6637)), closes [#444](https://github.com/akash-network/console/issues/444)

## [2.21.0-beta.0](https://github.com/akash-network/console/compare/console-web/v2.20.3...console-web/v2.21.0-beta.0) (2024-11-04)


### Features

* **deployment:** enable deployment from git repositories ([dfbaeb7](https://github.com/akash-network/console/commit/dfbaeb78843341633025a0812a2fdb021de12c70)), closes [#417](https://github.com/akash-network/console/issues/417)


### Bug Fixes

* **wallet:** init nextPageKey with null when paginating grants ([2698b14](https://github.com/akash-network/console/commit/2698b14fc9ade6eab56e189daab753372677b9de))

## [2.20.3](https://github.com/akash-network/console/compare/console-web/v2.20.3-beta.0...console-web/v2.20.3) (2024-10-30)

## [2.20.3-beta.0](https://github.com/akash-network/console/compare/console-web/v2.20.2...console-web/v2.20.3-beta.0) (2024-10-30)


### Bug Fixes

* **network:** safely parse initial selected network ([8f0e2de](https://github.com/akash-network/console/commit/8f0e2de54b64469bfbb9e169030435c04060739b))

## [2.20.2](https://github.com/akash-network/console/compare/console-web/v2.20.2-beta.1...console-web/v2.20.2) (2024-10-30)

## [2.20.2-beta.1](https://github.com/akash-network/console/compare/console-web/v2.20.2-beta.0...console-web/v2.20.2-beta.1) (2024-10-30)


### Bug Fixes

* improve perf ([d9de0eb](https://github.com/akash-network/console/commit/d9de0eba93d0c4ee4d7e051f98843578ba30a258)), closes [#427](https://github.com/akash-network/console/issues/427)

## [2.20.2-beta.0](https://github.com/akash-network/console/compare/console-web/v2.20.1...console-web/v2.20.2-beta.0) (2024-10-29)


### Bug Fixes

* **wallet:** ensure proper network and manage wallet switch ([39ee991](https://github.com/akash-network/console/commit/39ee991731145c3d3d8b3a6cb0ef37fe453b0d29))

## [2.20.1](https://github.com/akash-network/console/compare/console-web/v2.20.1-beta.0...console-web/v2.20.1) (2024-10-26)

## [2.20.1-beta.0](https://github.com/akash-network/console/compare/console-web/v2.20.0...console-web/v2.20.1-beta.0) (2024-10-26)


### Bug Fixes

* **styling:** fix typo on homepage ([#420](https://github.com/akash-network/console/issues/420)) ([938f6b7](https://github.com/akash-network/console/commit/938f6b7fcbe1a990cb6911a83000243ca6bb835c))

## [2.20.0](https://github.com/akash-network/console/compare/console-web/v2.20.0-beta.0...console-web/v2.20.0) (2024-10-23)

## [2.20.0-beta.0](https://github.com/akash-network/console/compare/console-web/v2.19.1-beta.0...console-web/v2.20.0-beta.0) (2024-10-23)


### Features

* **deployment:** add new endpoint to query filtered bids for trial accounts ([3d95615](https://github.com/akash-network/console/commit/3d95615a067b50a4c468e25535089ef9ca0a058c))
* **deployment:** refactor trial providers to config file ([b18a57a](https://github.com/akash-network/console/commit/b18a57aaf01392fb62ee6b2801d022ac3e4e8958))


### Bug Fixes

* **deployment:** added provider validation for trial ([ae03311](https://github.com/akash-network/console/commit/ae03311c5189d3569cad3ae45c662069c2e1eaaa))
* **styling:** remove beta logo ([b052151](https://github.com/akash-network/console/commit/b0521518709e2487208dd83256b4c630a1c7ac29))
* **wallet:** fix your account usdc display ([1dedde4](https://github.com/akash-network/console/commit/1dedde4078cc64ac9443ad458a2058f364d9e48a))

## [2.19.1-beta.0](https://github.com/akash-network/console/compare/console-web/v2.19.0...console-web/v2.19.1-beta.0) (2024-10-18)


### Bug Fixes

* **wallet:** authz pagination ([6193df5](https://github.com/akash-network/console/commit/6193df5f0820f67095ed9fe9280654b278f398a1)), closes [#415](https://github.com/akash-network/console/issues/415)

## [2.19.0](https://github.com/akash-network/console/compare/console-web/v2.19.0-beta.1...console-web/v2.19.0) (2024-10-17)

## [2.19.0-beta.1](https://github.com/akash-network/console/compare/console-web/v2.19.0-beta.0...console-web/v2.19.0-beta.1) (2024-10-17)


### Features

* **billing:** update master wallet and enable billing for prod ([90e0235](https://github.com/akash-network/console/commit/90e023594e6135d0e99f4b734c7e3706159d0fb4))

## [2.19.0-beta.0](https://github.com/akash-network/console/compare/console-web/v2.17.0...console-web/v2.19.0-beta.0) (2024-10-17)


### Features

* **wallet:** improve fiat payments ux ([295e085](https://github.com/akash-network/console/commit/295e08542deb57634de624c5815e1e7127333a16)), closes [#411](https://github.com/akash-network/console/issues/411)

## [2.17.0](https://github.com/akash-network/console/compare/console-web/v2.17.0-beta.0...console-web/v2.17.0) (2024-10-14)

## 2.17.0-beta.0 (2024-10-14)


### Features

* add beta env ([#326](https://github.com/akash-network/console/issues/326)) ([855ff4b](https://github.com/akash-network/console/commit/855ff4b084a68d6042fcb3cd181fc91abe998520))
* **auth:** implement anonymous user authentication ([fa9de2f](https://github.com/akash-network/console/commit/fa9de2f0d0f8d0a0c483f07856cebdb58d8f5344)), closes [#247](https://github.com/akash-network/console/issues/247)
* **auth:** implements basic anonymous user auth ([ca816f5](https://github.com/akash-network/console/commit/ca816f5e4136c1b4e515c73b249e10d0dc0964e3)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** add wallet trialing flag ([e9cc512](https://github.com/akash-network/console/commit/e9cc5125d7bf9b8853ea48f6e8ded87fd490d24a)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** adjust migrations and env for deployment ([45656d7](https://github.com/akash-network/console/commit/45656d7848ac0fdd5689b46a32221d48a7b32469)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** adjust some UI features for managed wallet users ([6af49da](https://github.com/akash-network/console/commit/6af49daa796856b363284431721799755dda54a3)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** change managed wallet button copy and style ([0fa46ac](https://github.com/akash-network/console/commit/0fa46ac017fd7835b4b5695d5489701a3d7693ef)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** ensure master wallet sequence is correct ([8372f38](https://github.com/akash-network/console/commit/8372f387718dec9a8fed81e4048690c46f7e8b10)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** handle tx errors ([3430a08](https://github.com/akash-network/console/commit/3430a089629e40019b90fa712d668279b9774982)), closes [#340](https://github.com/akash-network/console/issues/340) [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement balance refresh ([9d54f44](https://github.com/akash-network/console/commit/9d54f44c4024457b5bc339b6c32c67b3f3d37486)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement balance wallets refill ([fa1f252](https://github.com/akash-network/console/commit/fa1f252468bd30106a67be2fb011870d5e5e6c8d)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet ([164d86b](https://github.com/akash-network/console/commit/164d86b56cb48d9ebb7b7102743d3c3fd363e6f6)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet top up ([04f5aad](https://github.com/akash-network/console/commit/04f5aad51079bea8c8d58c2147c78598b5bb409d)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet top up 1 ([bd4c06b](https://github.com/akash-network/console/commit/bd4c06bd49cc1c16380997b4af0185360ffd5f0b)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement wallet type switch ([155113c](https://github.com/akash-network/console/commit/155113c0aee2913d2cf4da839126a4a10768de05)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** remove some UI features for managed wallet users ([f021f07](https://github.com/akash-network/console/commit/f021f07458dd488f02ae37b6952b984fd70f1b71)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** update transactional messages for managed wallet ([efc0508](https://github.com/akash-network/console/commit/efc050860cc459625259be7ac041e15ce49dcfc1)), closes [#247](https://github.com/akash-network/console/issues/247)
* **console:** add all leap wallets ([#346](https://github.com/akash-network/console/issues/346)) ([f00c367](https://github.com/akash-network/console/commit/f00c3679ef997e5133dcdc46550deb2bcea81dd1))
* **console:** Add config from awesome akash for SSH toggle ([#301](https://github.com/akash-network/console/issues/301)) ([8765a4f](https://github.com/akash-network/console/commit/8765a4fe5123c868bacfa9c59cd0b6209a85224e))
* **console:** add llama 3.1 405 to staff picks ([#339](https://github.com/akash-network/console/issues/339)) ([6ad71ce](https://github.com/akash-network/console/commit/6ad71ce5e2f5339c6d791cf6759910a94ffeea83))
* **console:** add metamask ([#334](https://github.com/akash-network/console/issues/334)) ([bc68df8](https://github.com/akash-network/console/commit/bc68df8fe87c310f406663a73444f918d272422b))
* **console:** add rehypraw to display html for awesome akash templates ([#319](https://github.com/akash-network/console/issues/319)) ([0014109](https://github.com/akash-network/console/commit/00141098408668a542d65b77cf6084de9070ee7c))
* **console:** added application key to filter out third party exceptions ([#372](https://github.com/akash-network/console/issues/372)) ([d01b8d5](https://github.com/akash-network/console/commit/d01b8d5992ee12958562e73c7f06a333879e05ac))
* **console:** balance authz deployments ([#359](https://github.com/akash-network/console/issues/359)) ([abdb18a](https://github.com/akash-network/console/commit/abdb18a42af81e7e1724b7afbe8eb2b898b47f41))
* **console:** managed wallets popup confirmation ([#342](https://github.com/akash-network/console/issues/342)) ([c7d16d6](https://github.com/akash-network/console/commit/c7d16d6a0d942cef8e64c6978d9ff565a0336c0d))
* **console:** revoke all authz ([#308](https://github.com/akash-network/console/issues/308)) ([eb89ae0](https://github.com/akash-network/console/commit/eb89ae0bec1a50976389f05a172e3b451dff0029))
* **deploy-web:** improve provider detail uptime styling ([#221](https://github.com/akash-network/console/issues/221)) ([db1ee83](https://github.com/akash-network/console/commit/db1ee83a1ce3507b28d23312483b1978684f1874))
* **deploy-web:** show connect btn in authorization page if not connected ([1bb8618](https://github.com/akash-network/console/commit/1bb86187db8bdba578c567144ac9fb4650679c12))
* **deployment:** ensure usd values in deployments for managed wallets ([d1303d0](https://github.com/akash-network/console/commit/d1303d0bd6bc8917dec39fedb74fe46306cb2949)), closes [#247](https://github.com/akash-network/console/issues/247)
* **deployment:** ensure user can re-send manifest ([27e1289](https://github.com/akash-network/console/commit/27e12898755b720a0d5045225429e1e0c9bcb850))
* **deployment:** implement deployment deposit top up via managed wallet ([baa36d3](https://github.com/akash-network/console/commit/baa36d3b039c899fde0700bf3b1ae3c08209aa07)), closes [#247](https://github.com/akash-network/console/issues/247)
* **deployment:** implement plain linux deployment page ([6da5565](https://github.com/akash-network/console/commit/6da5565c049ab9f9debace6e42ec976347b6b3a0)), closes [#227](https://github.com/akash-network/console/issues/227)
* **deployment:** update ssh images ([6dbba51](https://github.com/akash-network/console/commit/6dbba511b3a0d10a148ddd71f0ccef97943cca79))
* **env:** implement unified file loading in console-web ([12f282a](https://github.com/akash-network/console/commit/12f282aa2798d9597a9f950520fb19d174cb635e)), closes [#313](https://github.com/akash-network/console/issues/313)
* **env:** unify app configs for api and indexer, update doc ([f3f7df4](https://github.com/akash-network/console/commit/f3f7df486e0feabdd672e3d7776c7dab49cde90d)), closes [#313](https://github.com/akash-network/console/issues/313)
* extract custom components ([#256](https://github.com/akash-network/console/issues/256)) ([2d3e889](https://github.com/akash-network/console/commit/2d3e8898f5d6e081f49da3ae5892023317f0b6e7))
* extract UI components shadcn ([#239](https://github.com/akash-network/console/issues/239)) ([f2da963](https://github.com/akash-network/console/commit/f2da963b4b56e6e006959216f35ca8cd7a4fb4f6))
* finish console rebrand ([#259](https://github.com/akash-network/console/issues/259)) ([ae272e8](https://github.com/akash-network/console/commit/ae272e81dc5bcadf6f8c8114514f2fee30d6e135))
* implement npm workspaces  ([#208](https://github.com/akash-network/console/issues/208)) ([c403dc1](https://github.com/akash-network/console/commit/c403dc155b9b213f5ba043d92ee1967e0b133fe3))
* improve provider leases graph ([#246](https://github.com/akash-network/console/issues/246)) ([f5fe74e](https://github.com/akash-network/console/commit/f5fe74e15d6b3d7fbccb28de141451ced5336823))
* merge "Upload SDL" to "Build your template" and add "Plain Linux" template ([#244](https://github.com/akash-network/console/issues/244)) ([0edf499](https://github.com/akash-network/console/commit/0edf4992b6e01f6243ab226f2666ec4e05c312e4))
* **network:** extract network store into a package ([608a16d](https://github.com/akash-network/console/commit/608a16dfd12e5beca628e3169a8fc6ea1c5d12c2))
* **network:** stick to a certain network for managed wallets ([652648a](https://github.com/akash-network/console/commit/652648ab7a765ff0ebe996aadf1680bab1ac7920)), closes [#247](https://github.com/akash-network/console/issues/247)
* **release:** implement release with image build ([a9fa7e8](https://github.com/akash-network/console/commit/a9fa7e80b373af4ca90438292f582e661680fb2d))
* **sdl:** add ssh to main builder ([868df46](https://github.com/akash-network/console/commit/868df46ab28f0a649bda48acf9b0adca995c2075)), closes [#227](https://github.com/akash-network/console/issues/227)
* **setting:** only show setting page for a connected user wallet ([66cadb0](https://github.com/akash-network/console/commit/66cadb0c7aa1bb37397a26ef4be37c52396aa735)), closes [#247](https://github.com/akash-network/console/issues/247)
* shared packages ([#237](https://github.com/akash-network/console/issues/237)) ([bd79006](https://github.com/akash-network/console/commit/bd79006abff3ee2d06657269ddd0e76d1554f275))
* templates logo url ([#315](https://github.com/akash-network/console/issues/315)) ([fd92d15](https://github.com/akash-network/console/commit/fd92d157884eab79e6dea7c248957fa1d61a58b3))
* **user:** implement anonymous user registration ([b58d74a](https://github.com/akash-network/console/commit/b58d74a8ba0412f1ff8eeeaecafa1a2369723cbf)), closes [#247](https://github.com/akash-network/console/issues/247)
* **wallet:** add fee granter to transaction signer ([2a06cc6](https://github.com/akash-network/console/commit/2a06cc64e831bb69763f7f32319f91982e64e09b)), closes [#219](https://github.com/akash-network/console/issues/219)
* **wallet:** ensure proper denom for a managed wallet ([2dbf6b1](https://github.com/akash-network/console/commit/2dbf6b15207530425415095c9cdb97429cadb32e)), closes [#247](https://github.com/akash-network/console/issues/247)
* **wallet:** implement fee granter as a global setting ([9fa3060](https://github.com/akash-network/console/commit/9fa3060098898115182f10916123abbf7768c34d)), closes [#219](https://github.com/akash-network/console/issues/219)
* **wallet:** update copy and remove allowance notifications ([022b219](https://github.com/akash-network/console/commit/022b2194102f6d969ccfadb38c99d0a0606530fa)), closes [#247](https://github.com/akash-network/console/issues/247)


### Bug Fixes

* **auth:** avoid fetching profile via proxy ([ffce24e](https://github.com/akash-network/console/commit/ffce24e64ea4e89423634ece4cdb047aeee21d92))
* **auth:** properly authenticate new endpoints ([ce241e1](https://github.com/akash-network/console/commit/ce241e1a7edb079e014f2d95bab1ce1902b94656)), closes [#247](https://github.com/akash-network/console/issues/247)
* **certificate:** certificates pagination bug ([#384](https://github.com/akash-network/console/issues/384)) ([a068b15](https://github.com/akash-network/console/commit/a068b15024f0d1f0b45526eda5ecc83763b95625))
* console your account ([#328](https://github.com/akash-network/console/issues/328)) ([f26958b](https://github.com/akash-network/console/commit/f26958b0cfacd5b39829fc43236ae064dae7d44b))
* **console:** add null check for user in sign and broadcast ([#304](https://github.com/akash-network/console/issues/304)) ([8eae178](https://github.com/akash-network/console/commit/8eae17825dc401c3776be492ca853e27b7e6a934))
* **console:** default uakt 10000 ([#324](https://github.com/akash-network/console/issues/324)) ([7b5f258](https://github.com/akash-network/console/commit/7b5f25899cb0f44f09878673d5c48db23c143b8e))
* **console:** managed wallet manifest fix error ([#351](https://github.com/akash-network/console/issues/351)) ([69880b0](https://github.com/akash-network/console/commit/69880b0390dfc632b55fe56e9db27cd0bd8db8d6))
* **console:** refactor useAllowance hook ([#336](https://github.com/akash-network/console/issues/336)) ([269d227](https://github.com/akash-network/console/commit/269d22709a485bb0b1bec8f34e8a66a2c3625480))
* **console:** return 404 when template is not found ([6c6e0a9](https://github.com/akash-network/console/commit/6c6e0a9585037934e12ecd47ce579e84e902152d))
* **console:** update CustomGoogleAnalytics.tsx ([#290](https://github.com/akash-network/console/issues/290)) ([48d855b](https://github.com/akash-network/console/commit/48d855b30af3bca7baf90303f6839b241d27508e))
* **deploy-web:** fix provider uptime sorting during ssr ([3ece973](https://github.com/akash-network/console/commit/3ece9735e5c7f69f58aa5ad56b58b34d7a82c52e))
* **deploy-web:** fix spacing for uptime ([#222](https://github.com/akash-network/console/issues/222)) ([3f7193a](https://github.com/akash-network/console/commit/3f7193ab053e4f008cd661ae5a869fe92e475615))
* **deploy-web:** fixed error handling for transaction page ([#213](https://github.com/akash-network/console/issues/213)) ([a006e03](https://github.com/akash-network/console/commit/a006e03ad7a18679eee1d0870dec724f3a632d84))
* **deploy-web:** handle sdl parsing error in sdl builder ([#228](https://github.com/akash-network/console/issues/228)) ([5da2bc9](https://github.com/akash-network/console/commit/5da2bc9647ac8b6ba189eb67632a43697304511d))
* **deployment:** managed walllet fixes ([#382](https://github.com/akash-network/console/issues/382)) ([4a43483](https://github.com/akash-network/console/commit/4a4348390c56d0f2794b6689cf19ef84edaf9c54))
* **deployment:** only set the template and redirect once when loading new deployment ([#394](https://github.com/akash-network/console/issues/394)) ([654dbae](https://github.com/akash-network/console/commit/654dbaed6bc7fbd37b6261c0a65510fde1859a51))
* **deployment:** remove control over deployment detail fetching ([7c2263b](https://github.com/akash-network/console/commit/7c2263b5cc99a0886e7ee1a1b018691d7a64782f)), closes [#247](https://github.com/akash-network/console/issues/247)
* **deployment:** templates new deploy ([#403](https://github.com/akash-network/console/issues/403)) ([c0d50b1](https://github.com/akash-network/console/commit/c0d50b1d50a1f083105afd877a2c370dfcb34dd8))
* ensure apps build consistently in docker and locally ([f4dbd88](https://github.com/akash-network/console/commit/f4dbd88a886d683062eebd7495375bff0bd4aa54)), closes [#209](https://github.com/akash-network/console/issues/209)
* ensure deploy web type check is passing ([62acb44](https://github.com/akash-network/console/commit/62acb44e7625063a39a53ac87e4902a3dfc6d4fb))
* **env:** parse process env with zod to ensure default values ([0224f79](https://github.com/akash-network/console/commit/0224f79a231df9acc66f965469e5df59b60896ad))
* handle provider active leases graph when no leases or new provider ([#253](https://github.com/akash-network/console/issues/253)) ([a7feeda](https://github.com/akash-network/console/commit/a7feedaa50cc37960323182a97f4d26df59960c5))
* improve the settings node fetching to avoid having a failing node ([#262](https://github.com/akash-network/console/issues/262)) ([07fd696](https://github.com/akash-network/console/commit/07fd696989d9d16c6e5b07071e2260f749fab4d0))
* move leapwallet CSS library import to component-specific usage ([#281](https://github.com/akash-network/console/issues/281)) ([333e29a](https://github.com/akash-network/console/commit/333e29afd5a05602e58760234b171278b6f7960e))
* type button code snippet ([51bd8cc](https://github.com/akash-network/console/commit/51bd8cc45caf50b39574771da866b1893a5f2704))
* **user:** ensure user pages are properly loaded ([463bfee](https://github.com/akash-network/console/commit/463bfeeb531ba79bfc8bba3d8e3f7520fb4803d6)), closes [#247](https://github.com/akash-network/console/issues/247)
* **wallet:** ensure managed wallet is gone after logout ([a7d4873](https://github.com/akash-network/console/commit/a7d4873ed9e94f037d3ee3e78397f3da33b32f17))
* **wallet:** ensure managed wallet selected on create ([9f5bd71](https://github.com/akash-network/console/commit/9f5bd71faca4b64c427ed6dfa7c458e3fdc52314))
* **wallet:** refetch using query directly to avoid circular dep ([e88ed70](https://github.com/akash-network/console/commit/e88ed706efd5e6e1b27969a7efaa09f8b4157be5))
* **wallet:** remove managed wallet on registered user logout ([ab6188e](https://github.com/akash-network/console/commit/ab6188e1f100e9598afc8524daa8fd50fc860b1a)), closes [#247](https://github.com/akash-network/console/issues/247)
