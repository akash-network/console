

## [1.14.1](https://github.com/akash-network/console/compare/notifications/v1.14.0...notifications/v1.14.1) (2025-07-05)


### Bug Fixes

* ignore errors in SQL formatting ([#1630](https://github.com/akash-network/console/issues/1630)) ([ad21ab0](https://github.com/akash-network/console/commit/ad21ab0e8c581db930d6e5987de9492a8d717f6d))

## [1.14.0](https://github.com/akash-network/console/compare/notifications/v1.13.7...notifications/v1.14.0) (2025-07-02)


### Features

* **billing:** filter payment methods ([#1610](https://github.com/akash-network/console/issues/1610)) ([3db9833](https://github.com/akash-network/console/commit/3db9833084e7dfcf5370298aead681ae527609db))


### Bug Fixes

* **billing:** improve stripe error handling ([#1569](https://github.com/akash-network/console/issues/1569)) ([f567c75](https://github.com/akash-network/console/commit/f567c75f9c63ecadbd3f9eec8d58588be195743c))


### Code Refactoring

* move /v1/proposals to modules ([#1434](https://github.com/akash-network/console/issues/1434)) ([d6cd3c5](https://github.com/akash-network/console/commit/d6cd3c5cc53090784c79334195ae5c298a07a68e)), closes [#1269](https://github.com/akash-network/console/issues/1269) [#1269](https://github.com/akash-network/console/issues/1269)

## [1.13.7](https://github.com/akash-network/console/compare/notifications/v1.13.6...notifications/v1.13.7) (2025-07-01)


### Code Refactoring

* move /v1/addresses/* to modules ([#1468](https://github.com/akash-network/console/issues/1468)) ([ba0a0f7](https://github.com/akash-network/console/commit/ba0a0f75c56c1656ea4d8f88eaaaa812de5e3aec)), closes [#1267](https://github.com/akash-network/console/issues/1267) [#1267](https://github.com/akash-network/console/issues/1267) [#1267](https://github.com/akash-network/console/issues/1267)

## [1.13.6](https://github.com/akash-network/console/compare/notifications/v1.13.5...notifications/v1.13.6) (2025-06-30)


### Bug Fixes

* **alert:** properly submits existing deployment alert form ([91273df](https://github.com/akash-network/console/commit/91273df73ccb03eb669a16e3a0bc1676507bb2ff))

## [1.13.5](https://github.com/akash-network/console/compare/notifications/v1.13.4...notifications/v1.13.5) (2025-06-28)


### Bug Fixes

* ensure getAllItems cyclic loop check happens after the 1st iteration ([#1573](https://github.com/akash-network/console/issues/1573)) ([349e15a](https://github.com/akash-network/console/commit/349e15a578df1a801a786d5b7a27e1354385d537))
* upgrades nodejs to higher version ([#1563](https://github.com/akash-network/console/issues/1563)) ([dac08eb](https://github.com/akash-network/console/commit/dac08ebadcc29164eda2e76417ac85ec210ea1b0))

## [1.13.4](https://github.com/akash-network/console/compare/notifications/v1.13.3...notifications/v1.13.4) (2025-06-26)


### Bug Fixes

* ensure getAllItems doesn't stuck inside infinite loop ([#1562](https://github.com/akash-network/console/issues/1562)) ([f8a8ba2](https://github.com/akash-network/console/commit/f8a8ba277f5b8b8cd25d1c4a831d0642e9505557))

## [1.13.3](https://github.com/akash-network/console/compare/notifications/v1.13.2...notifications/v1.13.3) (2025-06-26)


### Bug Fixes

* makes axios not to throw on 400 error for getting deployment ([#1552](https://github.com/akash-network/console/issues/1552)) ([f85947e](https://github.com/akash-network/console/commit/f85947efd64ac4b566f020d9a4691ab092fb46ab))


### Code Refactoring

* ensure alerts are not rendered when they are disabled ([#1557](https://github.com/akash-network/console/issues/1557)) ([8c3d8b9](https://github.com/akash-network/console/commit/8c3d8b98f3ec640c1f49d2f0ac08f9db6e259ffe))

## [1.13.2](https://github.com/akash-network/console/compare/notifications/v1.13.1...notifications/v1.13.2) (2025-06-24)


### Bug Fixes

* **alert:** properly calculates deployment escrow balance ([4ea20e4](https://github.com/akash-network/console/commit/4ea20e4a7846a0fa588b9d8b8ad036f8165409c8))

## [1.13.1](https://github.com/akash-network/console/compare/notifications/v1.13.0...notifications/v1.13.1) (2025-06-23)


### Bug Fixes

* **alert:** extracts permitted alert fields correctly ([f1ce6ea](https://github.com/akash-network/console/commit/f1ce6ea4b46e620eccff31c1c3dfeb502ccd81bc))

## [1.13.0](https://github.com/akash-network/console/compare/notifications/v1.12.0...notifications/v1.13.0) (2025-06-23)


### Features

* **alert:** implements notification channel safe delete ([e023ce0](https://github.com/akash-network/console/commit/e023ce09fd6612c9c2d0d3e9dc3178648975bd5d))

## [1.12.0](https://github.com/akash-network/console/compare/notifications/v1.11.0...notifications/v1.12.0) (2025-06-22)


### Features

* **alert:** improves deployment alerts list UI ([d81d92d](https://github.com/akash-network/console/commit/d81d92da218186d2af454c4411a2d641762722b0))


### Bug Fixes

* adds suppressBySystem flag to alerts params ([#1521](https://github.com/akash-network/console/issues/1521)) ([46e8a19](https://github.com/akash-network/console/commit/46e8a19d2758abe7c749a19e67bc842e85c6957d))


### Code Refactoring

* move /v1/nodes and /v1/version to a module ([#1458](https://github.com/akash-network/console/issues/1458)) ([fc814db](https://github.com/akash-network/console/commit/fc814db50418300b608b7ddeb7173b3a3882aa38)), closes [#1271](https://github.com/akash-network/console/issues/1271) [#1276](https://github.com/akash-network/console/issues/1276)

## [1.11.0](https://github.com/akash-network/console/compare/notifications/v1.10.0...notifications/v1.11.0) (2025-06-17)


### Features

* adds logging of NODE_OPTIONS on startup ([#1500](https://github.com/akash-network/console/issues/1500)) ([a544080](https://github.com/akash-network/console/commit/a5440809c1bbdaed74bf8e7e69d3f5c2dc38acce))

## [1.10.0](https://github.com/akash-network/console/compare/notifications/v1.9.0...notifications/v1.10.0) (2025-06-16)


### Features

* **notifications:** improves alerts list and forms UI ([aa9223c](https://github.com/akash-network/console/commit/aa9223c2ff0bf44cab9833e4d13cae7365173224))

## [1.9.0](https://github.com/akash-network/console/compare/notifications/v1.8.0...notifications/v1.9.0) (2025-06-16)


### Features

* adds feature flags support to console-api's notifications proxy ([#1472](https://github.com/akash-network/console/issues/1472)) ([c663c55](https://github.com/akash-network/console/commit/c663c552cb1d03e38fcf13efc2b89086cf7c4585))

## [1.8.0](https://github.com/akash-network/console/compare/notifications/v1.7.0...notifications/v1.8.0) (2025-06-14)


### Features

* **notifications:** adds db indexes  ([d415932](https://github.com/akash-network/console/commit/d4159328ca90058dadfd152442860d099447b6d1)), closes [#1456](https://github.com/akash-network/console/issues/1456)

## [1.7.0](https://github.com/akash-network/console/compare/notifications/v1.6.0...notifications/v1.7.0) (2025-06-12)


### Features

* **alert:** authorizes deployment alerts by dseq+owner ([59d0a7c](https://github.com/akash-network/console/commit/59d0a7ccdec2060afe0ef8c89c0d1cf3bd9c0d0d)), closes [#1455](https://github.com/akash-network/console/issues/1455)

## [1.6.0](https://github.com/akash-network/console/compare/notifications/v1.5.0...notifications/v1.6.0) (2025-06-11)


### Features

* **billing:** stripe integration ([#1443](https://github.com/akash-network/console/issues/1443)) ([85c046b](https://github.com/akash-network/console/commit/85c046b1f7286b6c5fea41251712b3e89f413163))

## [1.5.0](https://github.com/akash-network/console/compare/notifications/v1.4.0...notifications/v1.5.0) (2025-06-11)


### Features

* **alert:** implements handlebars templating for alert contents ([d01b645](https://github.com/akash-network/console/commit/d01b645ad6393dc0e671c0e31532ce339dfaeb4d)), closes [#1452](https://github.com/akash-network/console/issues/1452)


### Code Refactoring

* migrates another part of console api to strict types ([#1462](https://github.com/akash-network/console/issues/1462)) ([7d91eb8](https://github.com/akash-network/console/commit/7d91eb8c8539e1a264e0fcc5f963d162cadf8775))

## [1.4.0](https://github.com/akash-network/console/compare/notifications/v1.3.0...notifications/v1.4.0) (2025-06-09)


### Features

* **alert:** add list ui ([f30775c](https://github.com/akash-network/console/commit/f30775c060675d8d35df6826dde0b88097ffece9))


### Code Refactoring

* **notification-channel:** renames contact-point to notification-channel and alert statuses ([4b0ef57](https://github.com/akash-network/console/commit/4b0ef57029e00ac105ad8e82747ced8be552f9af))

## [1.3.0](https://github.com/akash-network/console/compare/notifications/v1.2.3...notifications/v1.3.0) (2025-06-06)


### Features

* **alert:** adds alerts name column ([5297d9f](https://github.com/akash-network/console/commit/5297d9fb9e80b67827292cb0385fdaa0587e508b)), closes [#1415](https://github.com/akash-network/console/issues/1415)
* **alert:** implements deployment alerts ([7fc89b3](https://github.com/akash-network/console/commit/7fc89b3a69131d496833d3ae0c297a884b100660))
* **contact-point:** fetches contact point on the backend for edit ([3d1b0e3](https://github.com/akash-network/console/commit/3d1b0e378dbdd7d1aa140515e309827c00b01042))


### Code Refactoring

* move /v1/dashboard-data to modules ([#1372](https://github.com/akash-network/console/issues/1372)) ([1d165ad](https://github.com/akash-network/console/commit/1d165ad2bc78ad8a18521938e3720779c8da04c4)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* move /v1/deployment/{owner}/{dseq} to modules ([#1428](https://github.com/akash-network/console/issues/1428)) ([6138431](https://github.com/akash-network/console/commit/61384314fb6b3403192f14b2ea5290a53059f6e3)), closes [#1268](https://github.com/akash-network/console/issues/1268)
* move /v1/market-data to modules ([#1430](https://github.com/akash-network/console/issues/1430)) ([bd0e78c](https://github.com/akash-network/console/commit/bd0e78c5d29e2c520c8f7f64acd24d831ecd0006)), closes [#1278](https://github.com/akash-network/console/issues/1278)
* move /v1/validators to modules ([#1431](https://github.com/akash-network/console/issues/1431)) ([d2edc96](https://github.com/akash-network/console/commit/d2edc96dd2e70ffe91fec7bd86f25b658fb85c61)), closes [#1275](https://github.com/akash-network/console/issues/1275)

## [1.2.3](https://github.com/akash-network/console/compare/notifications/v1.2.2...notifications/v1.2.3) (2025-05-29)


### Bug Fixes

* docker node permissions ([#1410](https://github.com/akash-network/console/issues/1410)) ([073b43a](https://github.com/akash-network/console/commit/073b43aa1f89192bd9f96193f7d721d34840a441))

## [1.2.2](https://github.com/akash-network/console/compare/notifications/v1.2.1...notifications/v1.2.2) (2025-05-29)


### Bug Fixes

* **notifications:** properly names send queue ([dabb2e5](https://github.com/akash-network/console/commit/dabb2e51331011a765532ff20d5da90a635e2556))

## [1.2.1](https://github.com/akash-network/console/compare/notifications/v1.2.0...notifications/v1.2.1) (2025-05-28)


### Bug Fixes

* **notifications:** uses provided conditional logger ([fa03a17](https://github.com/akash-network/console/commit/fa03a17906e0fe82e683e3f839957cc3d9b717b7))

## [1.2.0](https://github.com/akash-network/console/compare/notifications/v1.1.7...notifications/v1.2.0) (2025-05-28)


### Features

* **notifications:** cleans up successful jobs ([b6f7ed0](https://github.com/akash-network/console/commit/b6f7ed0002b4c5ed4a53159b5745085aa6d72538))

## [1.1.7](https://github.com/akash-network/console/compare/notifications/v1.1.6...notifications/v1.1.7) (2025-05-28)


### Bug Fixes

* **notifications:** improves interface loading and deps management  ([c9cd03a](https://github.com/akash-network/console/commit/c9cd03aa67a5e62ac43edcc9f819600e5e179dce))

## [1.1.6](https://github.com/akash-network/console/compare/notifications/v1.1.5...notifications/v1.1.6) (2025-05-27)


### Bug Fixes

* **release:** points migrator to the proper migrations dir ([f124409](https://github.com/akash-network/console/commit/f1244091492c60001e30ca9ced3c26cd926aa5f4))

## [1.1.5](https://github.com/akash-network/console/compare/notifications/v1.1.4...notifications/v1.1.5) (2025-05-27)


### Bug Fixes

* **release:** adds migrations to the build ([cf74792](https://github.com/akash-network/console/commit/cf74792f824ee7ce8cf1859c72b0e1690e8365ea))

## [1.1.4](https://github.com/akash-network/console/compare/notifications/v1.1.3...notifications/v1.1.4) (2025-05-27)


### Bug Fixes

* **release:** adds db migrator to the prod deps  ([9ed7888](https://github.com/akash-network/console/commit/9ed78887e58147a493645b339f466118f977a6f9))

## [1.1.3](https://github.com/akash-network/console/compare/notifications/v1.1.2...notifications/v1.1.3) (2025-05-27)


### Bug Fixes

* **release:** separates db init from migrations ([821f2f1](https://github.com/akash-network/console/commit/821f2f162e19ef3df4e61e563a569d943322763d))

## [1.1.2](https://github.com/akash-network/console/compare/notifications/v1.1.1...notifications/v1.1.2) (2025-05-27)


### Bug Fixes

* **release:** builds notifications image w/o nginx ([d68bf9a](https://github.com/akash-network/console/commit/d68bf9a94c118aa65656e15924163ba9d54a4e2b))

## [1.1.1](https://github.com/akash-network/console/compare/notifications/v1.1.0...notifications/v1.1.1) (2025-05-26)


### Bug Fixes

* **release:** adds notifications to docker setup  ([6951faf](https://github.com/akash-network/console/commit/6951faf46850643515757c7c16c328bbf622fa76))

## 1.1.0 (2025-05-26)


### Features

* adds support for logging error cause ([#1064](https://github.com/akash-network/console/issues/1064)) ([6cd48e6](https://github.com/akash-network/console/commit/6cd48e6eb8ce7eb2c899d2f97f7154ee72e8a3e2))
* adds support for logging error cause ([#1064](https://github.com/akash-network/console/issues/1064)) ([#1066](https://github.com/akash-network/console/issues/1066)) ([ef8d604](https://github.com/akash-network/console/commit/ef8d60447f98e699189c852b8d18f173458386ec))
* **alert:** implements sufficient notification send interface  ([79ae647](https://github.com/akash-network/console/commit/79ae647c6f01ad91e04290b943517df3b53abc43))
* **auth:** enable credentials on api and start-trial client ([c64d15e](https://github.com/akash-network/console/commit/c64d15ecd02fc9ae632bd4cc2abdfff591be6a08)), closes [#627](https://github.com/akash-network/console/issues/627)
* **auth:** implement anonymous user authentication ([fa9de2f](https://github.com/akash-network/console/commit/fa9de2f0d0f8d0a0c483f07856cebdb58d8f5344)), closes [#247](https://github.com/akash-network/console/issues/247)
* **auth:** implement verification email re-send and rework relevant UI ([#676](https://github.com/akash-network/console/issues/676)) ([c2de6a6](https://github.com/akash-network/console/commit/c2de6a6f92dbb44b1758836f2a42de8eb81f4c94)), closes [#663](https://github.com/akash-network/console/issues/663)
* **billing:** add billing module with trial wallet creation ([d1ca550](https://github.com/akash-network/console/commit/d1ca550ae3d94e08de15f2d329ed6f81d192653b)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** add wallet trialing flag ([e9cc512](https://github.com/akash-network/console/commit/e9cc5125d7bf9b8853ea48f6e8ded87fd490d24a)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** enable checkout options with promo codes ([0cb439d](https://github.com/akash-network/console/commit/0cb439dcf4ca21974d7dacd784570cd032ee9f7b))
* **billing:** implement balance refresh ([9d54f44](https://github.com/akash-network/console/commit/9d54f44c4024457b5bc339b6c32c67b3f3d37486)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet top up ([04f5aad](https://github.com/akash-network/console/commit/04f5aad51079bea8c8d58c2147c78598b5bb409d)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** managed wallet api balances endpoint ([#1183](https://github.com/akash-network/console/issues/1183)) ([68024bc](https://github.com/akash-network/console/commit/68024bc394d1d846779a82038abb8b52a694cf21))
* **billing:** rename POST /v1/wallets to POST /v1/start-trial ([b39b057](https://github.com/akash-network/console/commit/b39b057315251c6b94532c4b3bfbf99380f46d62)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** resolve with valid only grants and allowances from http service ([77a0ffc](https://github.com/akash-network/console/commit/77a0ffcfe0ce912814d3e3803af6b1ac803cde71))
* **console:** add metamask ([#334](https://github.com/akash-network/console/issues/334)) ([bc68df8](https://github.com/akash-network/console/commit/bc68df8fe87c310f406663a73444f918d272422b))
* **contact-point:** implements list endpoint and auth ([0f11115](https://github.com/akash-network/console/commit/0f11115622a6cf58623f33e35902e4814793d9a8))
* **contact-point:** implements unleash feature flagging and contact creation ui ([6ad02ce](https://github.com/akash-network/console/commit/6ad02ce382dc76b9d317aa3934416da3605ad53b))
* **deployment:** auto top up custodial deployment with available amount ([0792a36](https://github.com/akash-network/console/commit/0792a367f64d83ed040043c021b98e5be2d82c80)), closes [#524](https://github.com/akash-network/console/issues/524)
* **deployment:** ensure there's sufficient fees allowance on cleanup ([fbbec68](https://github.com/akash-network/console/commit/fbbec68e3e430f41ab12424a5ffb47aff059a79d))
* **deployment:** implement ato top up setting ([1301314](https://github.com/akash-network/console/commit/130131485a68f699587415f96283e0dc83072502)), closes [#412](https://github.com/akash-network/console/issues/412)
* **deployment:** implement clean up of managed deployments ([882fac4](https://github.com/akash-network/console/commit/882fac457f91d968bd9ecd3129c9a2113c3dd0bf)), closes [#395](https://github.com/akash-network/console/issues/395)
* **deployment:** implement plain linux deployment page ([6da5565](https://github.com/akash-network/console/commit/6da5565c049ab9f9debace6e42ec976347b6b3a0)), closes [#227](https://github.com/akash-network/console/issues/227)
* **deployment:** implements custodial deployments top up data collection ([108f073](https://github.com/akash-network/console/commit/108f0736359cc866bb9aa01e3935105c413c8aae)), closes [#39](https://github.com/akash-network/console/issues/39)
* **deployment:** implements custodial wallet balances collection for top up ([0b08cd3](https://github.com/akash-network/console/commit/0b08cd3d4faeb818e00f0025a1c1bea818bcb213)), closes [#395](https://github.com/akash-network/console/issues/395)
* **deployment:** implements ui auto top up toggle ([f03df32](https://github.com/akash-network/console/commit/f03df324e1064f76b477cf888278eb4ad8f443cf)), closes [#714](https://github.com/akash-network/console/issues/714)
* **deployment:** managed api all deployments ([#1243](https://github.com/akash-network/console/issues/1243)) ([d86d748](https://github.com/akash-network/console/commit/d86d7484fa5b683329a84c6bfba1f6bcb46132bc))
* **deployment:** managed api create leases ([#969](https://github.com/akash-network/console/issues/969)) ([1193b0c](https://github.com/akash-network/console/commit/1193b0cc4015778f0363958e296db2462be11273))
* **env:** implement unified file loading in console-web ([12f282a](https://github.com/akash-network/console/commit/12f282aa2798d9597a9f950520fb19d174cb635e)), closes [#313](https://github.com/akash-network/console/issues/313)
* improves error logging for AggregateError ([#1072](https://github.com/akash-network/console/issues/1072)) ([c0ca85c](https://github.com/akash-network/console/commit/c0ca85c13b608457e65b8e90dad2d6cc310dd643))
* jwt provider schema ([#1312](https://github.com/akash-network/console/issues/1312)) ([379a2d3](https://github.com/akash-network/console/commit/379a2d3ceb519e8b49c75373b8aa7a4a735bf599))
* merge "Upload SDL" to "Build your template" and add "Plain Linux" template ([#244](https://github.com/akash-network/console/issues/244)) ([0edf499](https://github.com/akash-network/console/commit/0edf4992b6e01f6243ab226f2666ec4e05c312e4))
* **network:** add API endpoints for deployment ([#860](https://github.com/akash-network/console/issues/860)) ([5a58c29](https://github.com/akash-network/console/commit/5a58c298e6ad15944a93b7cd1d82837b78235c9a)), closes [#767](https://github.com/akash-network/console/issues/767)
* **network:** API endpoint listing bids ([#859](https://github.com/akash-network/console/issues/859)) ([0c7a8b9](https://github.com/akash-network/console/commit/0c7a8b97bd8bfaeaee78640a7256ef8cf279eb70)), closes [#767](https://github.com/akash-network/console/issues/767)
* **notifications:** adds alerts module ([11b6ddf](https://github.com/akash-network/console/commit/11b6ddf08e6a05b7fd3779bd38a78fa74dfd3861))
* **notifications:** adds basic alerts service ([5d4d6fc](https://github.com/akash-network/console/commit/5d4d6fcf23ceb2b317453a001d4043855df5c5d1))
* **notifications:** implements healthz ([973acd3](https://github.com/akash-network/console/commit/973acd384beff2998d265ecfff17d0f4dbdc7f37))
* **notifications:** implements swagger and code generation  ([ed61a3a](https://github.com/akash-network/console/commit/ed61a3a7730ef088dd31f4db9006b106eac4c6c4))
* **notifications:** improves chain polling reliability ([7623a61](https://github.com/akash-network/console/commit/7623a615df5e12ba04e5ba091729c3eb7a1ab013))
* **notifications:** refactors app structure to separate concerts ([9d64416](https://github.com/akash-network/console/commit/9d64416e2edd0843fdf31cbde975ae2ea75e17fc))
* **observability:** ensure logger can be configured in browser ([9ac2fdb](https://github.com/akash-network/console/commit/9ac2fdb58d182413378d67e900d0dc2f2dd14746)), closes [#430](https://github.com/akash-network/console/issues/430)
* **observability:** implements client side logging configuration ([da9923e](https://github.com/akash-network/console/commit/da9923eebe673cbdddc475a80a1c2d272dad383e)), closes [#436](https://github.com/akash-network/console/issues/436)
* **package:** extract logger into packages ([bac463b](https://github.com/akash-network/console/commit/bac463b4f4f18ef73a630d69eba7355cb20d4643)), closes [#429](https://github.com/akash-network/console/issues/429)
* provider deployments on provider console ([#416](https://github.com/akash-network/console/issues/416)) ([62374e1](https://github.com/akash-network/console/commit/62374e15d4e02ffa9f44080a2d41a676b403d70b))
* **release:** adds notifications release ci configs ([87655e2](https://github.com/akash-network/console/commit/87655e236f6266d3e1254f7e7326d72a841e7e40))
* **release:** implement release with image build ([a9fa7e8](https://github.com/akash-network/console/commit/a9fa7e80b373af4ca90438292f582e661680fb2d))
* shared packages ([#237](https://github.com/akash-network/console/issues/237)) ([bd79006](https://github.com/akash-network/console/commit/bd79006abff3ee2d06657269ddd0e76d1554f275))
* upgrade nodejs version to 22.14 (latest lts) ([#1095](https://github.com/akash-network/console/issues/1095)) ([8533b35](https://github.com/akash-network/console/commit/8533b355762016829c4435fd67c7885df79b251e))
* **user:** implement anonymous user registration ([b58d74a](https://github.com/akash-network/console/commit/b58d74a8ba0412f1ff8eeeaecafa1a2369723cbf)), closes [#247](https://github.com/akash-network/console/issues/247)
* **user:** implement stale anonymous users cleanup cli command ([a936f44](https://github.com/akash-network/console/commit/a936f44c6e532efc1f559986c352594237ce3691)), closes [#464](https://github.com/akash-network/console/issues/464)
* **users:** api keys UI ([#857](https://github.com/akash-network/console/issues/857)) ([32f9567](https://github.com/akash-network/console/commit/32f9567f05590c2d9bbd6445366570c474f8e063))
* **wallet:** authz manager improve ([#1321](https://github.com/akash-network/console/issues/1321)) ([5d2d726](https://github.com/akash-network/console/commit/5d2d7262a931a3f2cc962a36c2b644258d025d5a))
* **wallet:** improve fiat payments ux ([295e085](https://github.com/akash-network/console/commit/295e08542deb57634de624c5815e1e7127333a16)), closes [#411](https://github.com/akash-network/console/issues/411)


### Bug Fixes

* **billing:** properly check fee grant before tx ([b721141](https://github.com/akash-network/console/commit/b72114172847514cbccbd831db3503d20f533aed))
* **billing:** use specific endpoint to check managed wallet grants ([d87d79f](https://github.com/akash-network/console/commit/d87d79fbe29350c57c625e61e7f9805c5dc0b6ea))
* **billing:** use specific endpoint to check managed wallet grants ([a8f265b](https://github.com/akash-network/console/commit/a8f265b345da62cfa33c5c57c274d691a8062ed1))
* **deployment:** template list logo dark ([#1287](https://github.com/akash-network/console/issues/1287)) ([49f3fd3](https://github.com/akash-network/console/commit/49f3fd36c20e38bd6a6055804c2e9656881377b6))
* **deployment:** validate max deposit amount correctly ([44c0274](https://github.com/akash-network/console/commit/44c02745635510b8b5eb6bb4f9462b232543f393)), closes [#603](https://github.com/akash-network/console/issues/603)
* disable grantee grants temporarily ([1a992c1](https://github.com/akash-network/console/commit/1a992c1031ca8b17d6c0c613d9eba4286e54175b))
* disables nodejs auto family selection ([#1212](https://github.com/akash-network/console/issues/1212)) ([c6be104](https://github.com/akash-network/console/commit/c6be104cf583a07d20fb9f92661ffa29e23b492a))
* ensure release can detect changes for apps based on local packages ([#1070](https://github.com/akash-network/console/issues/1070)) ([e1053c4](https://github.com/akash-network/console/commit/e1053c456ba718fc58a93799e550e9338d9aea45))
* ensure that akash prebuilt templates exist in the final docker image ([#1020](https://github.com/akash-network/console/issues/1020)) ([2a940a3](https://github.com/akash-network/console/commit/2a940a349a85182f88fb8a83990bf3a78b0bab3f))
* ensures provider-proxy has valid blockchain API_URL on sandbox env ([#1032](https://github.com/akash-network/console/issues/1032)) ([325461e](https://github.com/akash-network/console/commit/325461e684a547669ac9765a3ac378ceadb86ee1))
* fallbacks to `local` if DEPLOYMENT_ENV is not specified ([#1029](https://github.com/akash-network/console/issues/1029)) ([f9bc424](https://github.com/akash-network/console/commit/f9bc4242900c58b0bd519e5c755616aedccfb71b))
* **notifications:** coerces query numeric strings to numbers ([2a9e6ec](https://github.com/akash-network/console/commit/2a9e6ec5c3914e06c6c92ecd9e5f5e6361b1d6f3))
* **observability:** bump logger version ([b258c63](https://github.com/akash-network/console/commit/b258c6389d22c0bf57e9c702b51a1280faf74eb7))
* **observability:** ensure pino-pretty works in built app ([7f6f9ca](https://github.com/akash-network/console/commit/7f6f9ca7ca4e1ff4bc3b85735270f61cc8120242)), closes [#474](https://github.com/akash-network/console/issues/474)
* **observability:** make sure otl data is added to logs ([820870d](https://github.com/akash-network/console/commit/820870d43203ddec5d3cd101d5c46b4b67e1d16d))
* **observability:** set logger time format to iso ([3fc959e](https://github.com/akash-network/console/commit/3fc959eb1f7ac1132eab054909a6336263482db8))
* **template:** eliminates eternal loop when query if failing  ([ca93b51](https://github.com/akash-network/console/commit/ca93b5123725394094aada5149811de548717d94))
* update package version ([a873df7](https://github.com/akash-network/console/commit/a873df7dcc77b57c065ac1bb5783603e921bf673))
* updates dockerfile for node apps ([#1068](https://github.com/akash-network/console/issues/1068)) ([54194a0](https://github.com/akash-network/console/commit/54194a08ca514f1be623a20e7a01cfbbf2e2244a))
* **user:** revoke stale users expired grants ([21cbfa6](https://github.com/akash-network/console/commit/21cbfa654d2a3effa11b8b83404158256142c1d5))
* **wallet:** fix fetching of authz ([#1017](https://github.com/akash-network/console/issues/1017)) ([37a0b2d](https://github.com/akash-network/console/commit/37a0b2d0f29ed11e4aa0b11c1d4fd919094373fb))
* **wallet:** init nextPageKey with null when paginating grants ([2698b14](https://github.com/akash-network/console/commit/2698b14fc9ade6eab56e189daab753372677b9de))


### Code Refactoring

* adds warmUpTemplatesCache script ([#962](https://github.com/akash-network/console/issues/962)) ([46b37eb](https://github.com/akash-network/console/commit/46b37eb632dc6da429da94b599160b2e587980c9))
* **alert:** uses a single table for all alerts ([#1320](https://github.com/akash-network/console/issues/1320)) ([fd738d6](https://github.com/akash-network/console/commit/fd738d6dcf1014fe0a36f959ec35a56cf2e49fed))
* changes structure and reduce side-effects in provider proxy ([#831](https://github.com/akash-network/console/issues/831)) ([3002e00](https://github.com/akash-network/console/commit/3002e00508019c5adaca4a0bdc42e3b9bf0e4ef1))
* **deployment:** splits some top up logic ([0747c20](https://github.com/akash-network/console/commit/0747c200ae58cd31d06e2bc6a2a9976a0bfecc41)), closes [#395](https://github.com/akash-network/console/issues/395)
* **dx:** fix linting issues ([1115a60](https://github.com/akash-network/console/commit/1115a609ba6a080e4c91331f45fb0d12b48c5504))
* enable eslint rules which restricts what dependencies can be used ([#1074](https://github.com/akash-network/console/issues/1074)) ([509fcd3](https://github.com/akash-network/console/commit/509fcd39831311950afdfb51c189ef46b02c855f))
* enables strict ts mode for logging package ([#951](https://github.com/akash-network/console/issues/951)) ([1086ec2](https://github.com/akash-network/console/commit/1086ec2db2df5ea981fe90417085208254b335c9))
* enables strict ts types for http-sdk ([#941](https://github.com/akash-network/console/issues/941)) ([4491dac](https://github.com/akash-network/console/commit/4491dac6dc9ea6f6bb65c4a18e877778867b1dc3))
* **forms:** zod form validation and components ([#283](https://github.com/akash-network/console/issues/283)) ([3b8279d](https://github.com/akash-network/console/commit/3b8279d3b7e6f2f1160c26383a04cf775140f1b5))
* **http:** extract http services to the package ([8196b4a](https://github.com/akash-network/console/commit/8196b4a0ff6503e9c057c9aea4409054cb4fc970)), closes [#247](https://github.com/akash-network/console/issues/247)
* move provider endpoints to modules ([#1309](https://github.com/akash-network/console/issues/1309)) ([6c5a434](https://github.com/akash-network/console/commit/6c5a4343c50b49b35833cfbce810a65ae3c75ed7)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* move provider listing to its service ([#1291](https://github.com/akash-network/console/issues/1291)) ([1a44de4](https://github.com/akash-network/console/commit/1a44de4f46e52d68e2bda6f4c1b906d8cf7724b6)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* moves trial authorization spending out of db transaction ([#1129](https://github.com/akash-network/console/issues/1129)) ([8c8e372](https://github.com/akash-network/console/commit/8c8e3729ce7c1f7ad2c387b471b326f1fbc0d353))
* **notifications:** implement modular configuration architecture ([ead91e4](https://github.com/akash-network/console/commit/ead91e4fdc04a799b32f0d9725bcb62fbaeeb8fd))
* **observability:** ensure logger can be configured with options and env ([bb84492](https://github.com/akash-network/console/commit/bb84492b3402688c19af79fce0ad19af25af8bd8)), closes [#430](https://github.com/akash-network/console/issues/430)
* refactors part of deploy-web to strict typescript types ([#1003](https://github.com/akash-network/console/issues/1003)) ([6ac6bb2](https://github.com/akash-network/console/commit/6ac6bb2ba919c933b923d40c56ea26f9788caed7))
* refactors services in console-web to strict types ([#1004](https://github.com/akash-network/console/issues/1004)) ([fd85685](https://github.com/akash-network/console/commit/fd85685858b64ead49a946955fe8da48ea9cc49b))
* removes sentry from console-api ([#1220](https://github.com/akash-network/console/issues/1220)) ([8339158](https://github.com/akash-network/console/commit/8339158321771e716cddd7de4242d7de370697d0))
* **template:** replaces /v1/templates with /v1/templates-list ([#634](https://github.com/akash-network/console/issues/634)) ([f81d56e](https://github.com/akash-network/console/commit/f81d56e94d089b17a6a0f2f939735c5f8e053278)), closes [#477](https://github.com/akash-network/console/issues/477)
* **template:** utilize new GET /v1/templates/{id} endpoint for template and deployment detail ([57a2aad](https://github.com/akash-network/console/commit/57a2aad5a1d9bd13e5bf02f43325b59d81cdd1b6)), closes [#477](https://github.com/akash-network/console/issues/477)
* unify methods listing leases ([#1302](https://github.com/akash-network/console/issues/1302)) ([2876f9c](https://github.com/akash-network/console/commit/2876f9ccffc66d85537e6574ec3d6ad5b9399b70)), closes [#1272](https://github.com/akash-network/console/issues/1272)
* uses logger and http sdk from local pkgs for notification service ([fe3539b](https://github.com/akash-network/console/commit/fe3539b5995aca4f88fe281da5ac282779ee3f8e))
