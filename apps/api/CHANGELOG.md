

## [2.109.0](https://github.com/akash-network/console/compare/console-api/v2.108.1...console-api/v2.109.0) (2025-07-31)


### Features

* **billing:** add stripe charges table list to usage ui  ([81e9d42](https://github.com/akash-network/console/commit/81e9d42d254bee6248451aecde8868ccbf018d89))
* **billing:** validate payment methods trial ([#1750](https://github.com/akash-network/console/issues/1750)) ([1776442](https://github.com/akash-network/console/commit/17764422232ac089fd4b48225d3b148e077947b6))
* **deployment:** implement trial deployment badge ([#1764](https://github.com/akash-network/console/issues/1764)) ([3e2fdae](https://github.com/akash-network/console/commit/3e2fdaee9f03bb95235f1f3171665111004807f8))


### Code Refactoring

* finalizes strict types migration for console-api ([#1745](https://github.com/akash-network/console/issues/1745)) ([746028c](https://github.com/akash-network/console/commit/746028c0a4b7c549128cf309d0c1171b6bc9f932))
* speed up startup and fixes concurrency in shutdown ([#1742](https://github.com/akash-network/console/issues/1742)) ([c6925e5](https://github.com/akash-network/console/commit/c6925e54353f828756c138e305a5c70d387cb8c5))

## [2.108.1](https://github.com/akash-network/console/compare/console-api/v2.108.0...console-api/v2.108.1) (2025-07-28)


### Code Refactoring

* removes old implementation of feature flags based on env variables ([#1480](https://github.com/akash-network/console/issues/1480)) ([fa722aa](https://github.com/akash-network/console/commit/fa722aae1baf9e5dbd034381a2b641cfd7a5bf8d))

## [2.108.0](https://github.com/akash-network/console/compare/console-api/v2.107.2...console-api/v2.108.0) (2025-07-27)


### Features

* adds safe node packages installation ([#1726](https://github.com/akash-network/console/issues/1726)) ([37acfee](https://github.com/akash-network/console/commit/37acfee5c1d053cec2316560ad220992d70b7cbf)), closes [#1549](https://github.com/akash-network/console/issues/1549)
* **billing:** new onboarding flow ([#1711](https://github.com/akash-network/console/issues/1711)) ([e05506c](https://github.com/akash-network/console/commit/e05506c89a762e8fa9111649357aa80c06e26fbe))
* **deployment:** close trial deployments after 24h ([#1725](https://github.com/akash-network/console/issues/1725)) ([05017ac](https://github.com/akash-network/console/commit/05017acb217be1efdfbe545f868f9c8f816e718d))


### Bug Fixes

* **auth:** fetching api keys ([#1743](https://github.com/akash-network/console/issues/1743)) ([cda80ce](https://github.com/akash-network/console/commit/cda80cefacff2d677fdd4e334b9d1997b6b9bd95))
* set a better date to work with ([#1729](https://github.com/akash-network/console/issues/1729)) ([218cdc4](https://github.com/akash-network/console/commit/218cdc4578d847338dd41945beb2fd29c19b0466))

## [2.107.2](https://github.com/akash-network/console/compare/console-api/v2.107.1...console-api/v2.107.2) (2025-07-22)


### Bug Fixes

* fix wallet creation error on stripe webhook ([#1684](https://github.com/akash-network/console/issues/1684)) ([595275e](https://github.com/akash-network/console/commit/595275e2cf8b749d1c404759d397d4d1819eaefd)), closes [#1662](https://github.com/akash-network/console/issues/1662)
* make userAgent 500 max chars long ([#1677](https://github.com/akash-network/console/issues/1677)) ([b929e99](https://github.com/akash-network/console/commit/b929e99af69d88ba2c1c8cd39c1b19fe1f1334ad)), closes [#1520](https://github.com/akash-network/console/issues/1520)

## [2.107.1](https://github.com/akash-network/console/compare/console-api/v2.107.0...console-api/v2.107.1) (2025-07-22)


### Code Refactoring

* creates separate axios instance per intent ([#1702](https://github.com/akash-network/console/issues/1702)) ([b15370f](https://github.com/akash-network/console/commit/b15370fccc676982705c41c7b659752a467aef0d)), closes [#1668](https://github.com/akash-network/console/issues/1668)

## [2.107.0](https://github.com/akash-network/console/compare/console-api/v2.106.1...console-api/v2.107.0) (2025-07-21)


### Features

* **provider:** added provider-earnings api ([#1646](https://github.com/akash-network/console/issues/1646)) ([3376863](https://github.com/akash-network/console/commit/3376863c1f817c73438a917bec6ada5f0031a2b7))

## [2.106.1](https://github.com/akash-network/console/compare/console-api/v2.106.0...console-api/v2.106.1) (2025-07-16)


### Bug Fixes

* **billing:** return empty array for discounts when no stripe id ([#1694](https://github.com/akash-network/console/issues/1694)) ([19ec3c2](https://github.com/akash-network/console/commit/19ec3c2681bcb56adf059e7d7506e2bdb103d1ee))

## [2.106.0](https://github.com/akash-network/console/compare/console-api/v2.105.1...console-api/v2.106.0) (2025-07-16)


### Features

* allow filtering stripe charges list api by date created and endingBefore cursor  ([fe986bd](https://github.com/akash-network/console/commit/fe986bdd63051c9dfe3751c1c56fab0025205c1c))
* **billing:** add usage ui ([77b5d42](https://github.com/akash-network/console/commit/77b5d42aaf4e153a6fe9f6723567520434f3d25b))

## [2.105.1](https://github.com/akash-network/console/compare/console-api/v2.105.0...console-api/v2.105.1) (2025-07-15)


### Bug Fixes

* blockchain proxy cert expired, so ignoring it ([#1685](https://github.com/akash-network/console/issues/1685)) ([3a2e205](https://github.com/akash-network/console/commit/3a2e20587918b60bb836a83704129dba27df9bae))

## [2.105.0](https://github.com/akash-network/console/compare/console-api/v2.104.0...console-api/v2.105.0) (2025-07-14)


### Features

* **billing:** apply coupon to balance ([#1658](https://github.com/akash-network/console/issues/1658)) ([e5a0420](https://github.com/akash-network/console/commit/e5a04202cdd267aa55e9152a62a0066df45a5471))

## [2.104.0](https://github.com/akash-network/console/compare/console-api/v2.103.2...console-api/v2.104.0) (2025-07-08)


### Features

* adds error code to collected error stack ([#1595](https://github.com/akash-network/console/issues/1595)) ([fef764f](https://github.com/akash-network/console/commit/fef764f8de77d501e7d0a136b5a9b5692d71d2ad))


### Bug Fixes

* serve Swagger docs from app.ts ([#1618](https://github.com/akash-network/console/issues/1618)) ([fc6bcdf](https://github.com/akash-network/console/commit/fc6bcdf743addaa1f325419af37ab39627dceceb))


### Code Refactoring

* move /templates endpoints to a module ([#1498](https://github.com/akash-network/console/issues/1498)) ([7f78555](https://github.com/akash-network/console/commit/7f785556853a038e70b04818e0b0cf8a39c2f8e6)), closes [#1273](https://github.com/akash-network/console/issues/1273)

## [2.103.2](https://github.com/akash-network/console/compare/console-api/v2.103.1...console-api/v2.103.2) (2025-07-06)


### Bug Fixes

* ensure next uses app version as sentry release number ([#1634](https://github.com/akash-network/console/issues/1634)) ([68a86d1](https://github.com/akash-network/console/commit/68a86d1f448af8a4ba1d20c76a97f7026664f40c))

## [2.103.1](https://github.com/akash-network/console/compare/console-api/v2.103.0...console-api/v2.103.1) (2025-07-05)


### Bug Fixes

* ignore errors in SQL formatting ([#1630](https://github.com/akash-network/console/issues/1630)) ([ad21ab0](https://github.com/akash-network/console/commit/ad21ab0e8c581db930d6e5987de9492a8d717f6d))

## [2.103.0](https://github.com/akash-network/console/compare/console-api/v2.102.8...console-api/v2.103.0) (2025-07-02)


### Features

* **billing:** filter payment methods ([#1610](https://github.com/akash-network/console/issues/1610)) ([3db9833](https://github.com/akash-network/console/commit/3db9833084e7dfcf5370298aead681ae527609db))


### Bug Fixes

* **billing:** improve stripe error handling ([#1569](https://github.com/akash-network/console/issues/1569)) ([f567c75](https://github.com/akash-network/console/commit/f567c75f9c63ecadbd3f9eec8d58588be195743c))


### Code Refactoring

* move /v1/proposals to modules ([#1434](https://github.com/akash-network/console/issues/1434)) ([d6cd3c5](https://github.com/akash-network/console/commit/d6cd3c5cc53090784c79334195ae5c298a07a68e)), closes [#1269](https://github.com/akash-network/console/issues/1269) [#1269](https://github.com/akash-network/console/issues/1269)

## [2.102.8](https://github.com/akash-network/console/compare/console-api/v2.102.7...console-api/v2.102.8) (2025-07-01)


### Code Refactoring

* move /v1/addresses/* to modules ([#1468](https://github.com/akash-network/console/issues/1468)) ([ba0a0f7](https://github.com/akash-network/console/commit/ba0a0f75c56c1656ea4d8f88eaaaa812de5e3aec)), closes [#1267](https://github.com/akash-network/console/issues/1267) [#1267](https://github.com/akash-network/console/issues/1267) [#1267](https://github.com/akash-network/console/issues/1267)

## [2.102.7](https://github.com/akash-network/console/compare/console-api/v2.102.6...console-api/v2.102.7) (2025-06-30)


### Code Refactoring

* move gpu endpoints to modules ([#1551](https://github.com/akash-network/console/issues/1551)) ([91f9505](https://github.com/akash-network/console/commit/91f9505bb94d48ff89ec3789f1af4f08fc5c917f)), closes [#1279](https://github.com/akash-network/console/issues/1279) [#1279](https://github.com/akash-network/console/issues/1279) [#1279](https://github.com/akash-network/console/issues/1279) [#1279](https://github.com/akash-network/console/issues/1279)

## [2.102.6](https://github.com/akash-network/console/compare/console-api/v2.102.5...console-api/v2.102.6) (2025-06-28)


### Bug Fixes

* ensure getAllItems cyclic loop check happens after the 1st iteration ([#1573](https://github.com/akash-network/console/issues/1573)) ([349e15a](https://github.com/akash-network/console/commit/349e15a578df1a801a786d5b7a27e1354385d537))
* updates @akashnetwork/akashjs ([#1575](https://github.com/akash-network/console/issues/1575)) ([ae86837](https://github.com/akash-network/console/commit/ae868378ae35db3342ff5d44f9d270644178c507))
* upgrades nodejs to higher version ([#1563](https://github.com/akash-network/console/issues/1563)) ([dac08eb](https://github.com/akash-network/console/commit/dac08ebadcc29164eda2e76417ac85ec210ea1b0))


### Code Refactoring

* move block prediction endpoints to modules ([#1444](https://github.com/akash-network/console/issues/1444)) ([e9f2acd](https://github.com/akash-network/console/commit/e9f2acdf47074cc9447bf09bfabe71c24449012a)), closes [#1270](https://github.com/akash-network/console/issues/1270)

## [2.102.5](https://github.com/akash-network/console/compare/console-api/v2.102.4...console-api/v2.102.5) (2025-06-26)


### Bug Fixes

* ensure getAllItems doesn't stuck inside infinite loop ([#1562](https://github.com/akash-network/console/issues/1562)) ([f8a8ba2](https://github.com/akash-network/console/commit/f8a8ba277f5b8b8cd25d1c4a831d0642e9505557))

## [2.102.4](https://github.com/akash-network/console/compare/console-api/v2.102.3...console-api/v2.102.4) (2025-06-26)


### Bug Fixes

* makes axios not to throw on 400 error for getting deployment ([#1552](https://github.com/akash-network/console/issues/1552)) ([f85947e](https://github.com/akash-network/console/commit/f85947efd64ac4b566f020d9a4691ab092fb46ab))


### Code Refactoring

* ensure alerts are not rendered when they are disabled ([#1557](https://github.com/akash-network/console/issues/1557)) ([8c3d8b9](https://github.com/akash-network/console/commit/8c3d8b98f3ec640c1f49d2f0ac08f9db6e259ffe))

## [2.102.3](https://github.com/akash-network/console/compare/console-api/v2.102.2...console-api/v2.102.3) (2025-06-25)


### Bug Fixes

* adds blockchain node API proxy to the list of mainnet nework urls ([#1553](https://github.com/akash-network/console/issues/1553)) ([35cd01a](https://github.com/akash-network/console/commit/35cd01a5969b2bdd78abd4eaa8baacdd3a676bc3))

## [2.102.2](https://github.com/akash-network/console/compare/console-api/v2.102.1...console-api/v2.102.2) (2025-06-24)


### Bug Fixes

* **alert:** properly calculates deployment escrow balance ([4ea20e4](https://github.com/akash-network/console/commit/4ea20e4a7846a0fa588b9d8b8ad036f8165409c8))

## [2.102.1](https://github.com/akash-network/console/compare/console-api/v2.102.0...console-api/v2.102.1) (2025-06-24)


### Code Refactoring

* run npm audit fix to fix security issues ([#1529](https://github.com/akash-network/console/issues/1529)) ([e00581e](https://github.com/akash-network/console/commit/e00581ef45d97c5dfabbe78688d39e715ff1ffde))

## [2.102.0](https://github.com/akash-network/console/compare/console-api/v2.101.0...console-api/v2.102.0) (2025-06-22)


### Features

* **alert:** improves deployment alerts list UI ([d81d92d](https://github.com/akash-network/console/commit/d81d92da218186d2af454c4411a2d641762722b0))


### Bug Fixes

* skips init phase for feature flags service if FEATURES_ENABlED_ALL=true ([#1523](https://github.com/akash-network/console/issues/1523)) ([78d5b70](https://github.com/akash-network/console/commit/78d5b70f73a71c4892974e7ad484900977d0f3fe))


### Code Refactoring

* move /v1/nodes and /v1/version to a module ([#1458](https://github.com/akash-network/console/issues/1458)) ([fc814db](https://github.com/akash-network/console/commit/fc814db50418300b608b7ddeb7173b3a3882aa38)), closes [#1271](https://github.com/akash-network/console/issues/1271) [#1276](https://github.com/akash-network/console/issues/1276)

## [2.101.0](https://github.com/akash-network/console/compare/console-api/v2.100.0...console-api/v2.101.0) (2025-06-17)


### Features

* **billing:** adds usage endpoint ([98711af](https://github.com/akash-network/console/commit/98711af9ef040d2995ff898b7dbe01ec0aa31fb6))

## [2.100.0](https://github.com/akash-network/console/compare/console-api/v2.99.0...console-api/v2.100.0) (2025-06-17)


### Features

* adds logging of NODE_OPTIONS on startup ([#1500](https://github.com/akash-network/console/issues/1500)) ([a544080](https://github.com/akash-network/console/commit/a5440809c1bbdaed74bf8e7e69d3f5c2dc38acce))


### Code Refactoring

* migrates another part of console-api to strict types ([#1488](https://github.com/akash-network/console/issues/1488)) ([6a41b0c](https://github.com/akash-network/console/commit/6a41b0c69c579b1fec34d5dbfc6c03f3e4b26558))

## [2.99.0](https://github.com/akash-network/console/compare/console-api/v2.98.1...console-api/v2.99.0) (2025-06-16)


### Features

* adds feature flags support to console-api's notifications proxy ([#1472](https://github.com/akash-network/console/issues/1472)) ([c663c55](https://github.com/akash-network/console/commit/c663c552cb1d03e38fcf13efc2b89086cf7c4585))


### Bug Fixes

* generation of dashboard data result ([#1491](https://github.com/akash-network/console/issues/1491)) ([34ce28e](https://github.com/akash-network/console/commit/34ce28e094c7f0ca4915c530a1693afc236060ac))

## [2.98.1](https://github.com/akash-network/console/compare/console-api/v2.98.0...console-api/v2.98.1) (2025-06-14)


### Bug Fixes

* **deployment:** remove auth for public endpoint ([#1484](https://github.com/akash-network/console/issues/1484)) ([f9b625f](https://github.com/akash-network/console/commit/f9b625fd60ba3bc1e433d96767df4a97bc06911f))
* **provider:** network capacity bug ([#1485](https://github.com/akash-network/console/issues/1485)) ([54479c2](https://github.com/akash-network/console/commit/54479c26769e64a883af8e81222a58b35b33fd97))

## [2.98.0](https://github.com/akash-network/console/compare/console-api/v2.97.2...console-api/v2.98.0) (2025-06-12)


### Features

* **alert:** authorizes deployment alerts by dseq+owner ([59d0a7c](https://github.com/akash-network/console/commit/59d0a7ccdec2060afe0ef8c89c0d1cf3bd9c0d0d)), closes [#1455](https://github.com/akash-network/console/issues/1455)

## [2.97.2](https://github.com/akash-network/console/compare/console-api/v2.97.1...console-api/v2.97.2) (2025-06-12)


### Bug Fixes

* **billing:** updating customer id ([#1469](https://github.com/akash-network/console/issues/1469)) ([fc7dac2](https://github.com/akash-network/console/commit/fc7dac24c18c6528ebdc04b5c6f4a1187fafe67c))

## [2.97.1](https://github.com/akash-network/console/compare/console-api/v2.97.0...console-api/v2.97.1) (2025-06-11)


### Bug Fixes

* **billing:** get stripe customer id ([#1466](https://github.com/akash-network/console/issues/1466)) ([f541c20](https://github.com/akash-network/console/commit/f541c20a842e247d30a078df129903146470d8b7))

## [2.97.0](https://github.com/akash-network/console/compare/console-api/v2.96.0...console-api/v2.97.0) (2025-06-11)


### Features

* **billing:** stripe integration ([#1443](https://github.com/akash-network/console/issues/1443)) ([85c046b](https://github.com/akash-network/console/commit/85c046b1f7286b6c5fea41251712b3e89f413163))

## [2.96.0](https://github.com/akash-network/console/compare/console-api/v2.95.1...console-api/v2.96.0) (2025-06-11)


### Features

* fetch providers by attribute patterns ([#1436](https://github.com/akash-network/console/issues/1436)) ([8898710](https://github.com/akash-network/console/commit/8898710a3443587cbc993bd808e9b9b0025b6861))


### Code Refactoring

* migrates another part of console api to strict types ([#1462](https://github.com/akash-network/console/issues/1462)) ([7d91eb8](https://github.com/akash-network/console/commit/7d91eb8c8539e1a264e0fcc5f963d162cadf8775))
* migrates another part of console-api to strict types ([#1448](https://github.com/akash-network/console/issues/1448)) ([2861fc5](https://github.com/akash-network/console/commit/2861fc567de89c4640f2a2f623b0617228ecc0a8))
* migrates billing module from console api to strict types ([#1460](https://github.com/akash-network/console/issues/1460)) ([a8f2fe9](https://github.com/akash-network/console/commit/a8f2fe993abed6152e76fb18749b4f46586fbf63))
* move /v1/leases-duration/{owner} to modules ([#1440](https://github.com/akash-network/console/issues/1440)) ([605bb55](https://github.com/akash-network/console/commit/605bb55060546974c4c32970c6572d8b315533bd)), closes [#1280](https://github.com/akash-network/console/issues/1280)

## [2.95.1](https://github.com/akash-network/console/compare/console-api/v2.95.0...console-api/v2.95.1) (2025-06-09)


### Bug Fixes

* fixes e2e tests and adds closeDeployments script ([#1446](https://github.com/akash-network/console/issues/1446)) ([92d7389](https://github.com/akash-network/console/commit/92d73895ff9f8422929365d3e4dfda10f6982796))


### Code Refactoring

* **notification-channel:** renames contact-point to notification-channel and alert statuses ([4b0ef57](https://github.com/akash-network/console/commit/4b0ef57029e00ac105ad8e82747ced8be552f9af))

## [2.95.0](https://github.com/akash-network/console/compare/console-api/v2.94.6...console-api/v2.95.0) (2025-06-06)


### Features

* **alert:** implements deployment alerts ([7fc89b3](https://github.com/akash-network/console/commit/7fc89b3a69131d496833d3ae0c297a884b100660))


### Code Refactoring

* move /v1/dashboard-data to modules ([#1372](https://github.com/akash-network/console/issues/1372)) ([1d165ad](https://github.com/akash-network/console/commit/1d165ad2bc78ad8a18521938e3720779c8da04c4)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* move /v1/deployment/{owner}/{dseq} to modules ([#1428](https://github.com/akash-network/console/issues/1428)) ([6138431](https://github.com/akash-network/console/commit/61384314fb6b3403192f14b2ea5290a53059f6e3)), closes [#1268](https://github.com/akash-network/console/issues/1268)
* move /v1/market-data to modules ([#1430](https://github.com/akash-network/console/issues/1430)) ([bd0e78c](https://github.com/akash-network/console/commit/bd0e78c5d29e2c520c8f7f64acd24d831ecd0006)), closes [#1278](https://github.com/akash-network/console/issues/1278)
* move /v1/pricing to modules ([#1433](https://github.com/akash-network/console/issues/1433)) ([832814a](https://github.com/akash-network/console/commit/832814a7eda2dbe5f30a140fe63f2317547e2b56)), closes [#1281](https://github.com/akash-network/console/issues/1281)
* move /v1/validators to modules ([#1431](https://github.com/akash-network/console/issues/1431)) ([d2edc96](https://github.com/akash-network/console/commit/d2edc96dd2e70ffe91fec7bd86f25b658fb85c61)), closes [#1275](https://github.com/akash-network/console/issues/1275)

## [2.94.6](https://github.com/akash-network/console/compare/console-api/v2.94.5...console-api/v2.94.6) (2025-05-30)


### Bug Fixes

* another attempt to stabilize e2e tests for deploy hello world case ([#1414](https://github.com/akash-network/console/issues/1414)) ([ddddf57](https://github.com/akash-network/console/commit/ddddf57c21d5eab12b2590e7546928626fc45c67))

## [2.94.5](https://github.com/akash-network/console/compare/console-api/v2.94.4...console-api/v2.94.5) (2025-05-29)


### Bug Fixes

* docker node permissions ([#1410](https://github.com/akash-network/console/issues/1410)) ([073b43a](https://github.com/akash-network/console/commit/073b43aa1f89192bd9f96193f7d721d34840a441))

## [2.94.4](https://github.com/akash-network/console/compare/console-api/v2.94.3...console-api/v2.94.4) (2025-05-28)


### Bug Fixes

* **notifications:** improves interface loading and deps management  ([c9cd03a](https://github.com/akash-network/console/commit/c9cd03aa67a5e62ac43edcc9f819600e5e179dce))


### Code Refactoring

* move /v1/providers/{address}/deployments to modules ([#1364](https://github.com/akash-network/console/issues/1364)) ([30a6b54](https://github.com/akash-network/console/commit/30a6b5426524ec022d35d9f1ec803a6faa8e73a5)), closes [#1272](https://github.com/akash-network/console/issues/1272)

## [2.94.3](https://github.com/akash-network/console/compare/console-api/v2.94.2...console-api/v2.94.3) (2025-05-28)


### Bug Fixes

* update auth0 audience and issuer ([#1382](https://github.com/akash-network/console/issues/1382)) ([6e66727](https://github.com/akash-network/console/commit/6e667277a8c4f9ed787bcdc2094377fe4ae625b1))

## [2.94.2](https://github.com/akash-network/console/compare/console-api/v2.94.1...console-api/v2.94.2) (2025-05-27)


### Bug Fixes

* **release:** builds notifications image w/o nginx ([d68bf9a](https://github.com/akash-network/console/commit/d68bf9a94c118aa65656e15924163ba9d54a4e2b))


### Code Refactoring

* migrates another part of console-api to strict types ([#1362](https://github.com/akash-network/console/issues/1362)) ([52daada](https://github.com/akash-network/console/commit/52daada473ef1fc45334aefc10203b3cbb8deb35))

## [2.94.1](https://github.com/akash-network/console/compare/console-api/v2.94.0...console-api/v2.94.1) (2025-05-26)


### Bug Fixes

* **release:** adds notifications to docker setup  ([6951faf](https://github.com/akash-network/console/commit/6951faf46850643515757c7c16c328bbf622fa76))


### Code Refactoring

* move /v1/provider-graph-data to modules ([#1324](https://github.com/akash-network/console/issues/1324)) ([9b9df22](https://github.com/akash-network/console/commit/9b9df22632ca61ba772a89be56091dc1a2231164)), closes [#1272](https://github.com/akash-network/console/issues/1272)

## [2.94.0](https://github.com/akash-network/console/compare/console-api/v2.93.0...console-api/v2.94.0) (2025-05-26)


### Features

* **notifications:** implements healthz ([973acd3](https://github.com/akash-network/console/commit/973acd384beff2998d265ecfff17d0f4dbdc7f37))

## [2.93.0](https://github.com/akash-network/console/compare/console-api/v2.92.0...console-api/v2.93.0) (2025-05-23)


### Features

* **contact-point:** implements list endpoint and auth ([0f11115](https://github.com/akash-network/console/commit/0f11115622a6cf58623f33e35902e4814793d9a8))

## [2.92.0](https://github.com/akash-network/console/compare/console-api/v2.91.0...console-api/v2.92.0) (2025-05-21)


### Features

* **notifications:** implements swagger and code generation  ([ed61a3a](https://github.com/akash-network/console/commit/ed61a3a7730ef088dd31f4db9006b106eac4c6c4))

## [2.91.0](https://github.com/akash-network/console/compare/console-api/v2.90.2...console-api/v2.91.0) (2025-05-16)


### Features

* jwt provider schema ([#1312](https://github.com/akash-network/console/issues/1312)) ([379a2d3](https://github.com/akash-network/console/commit/379a2d3ceb519e8b49c75373b8aa7a4a735bf599))
* **wallet:** authz manager improve ([#1321](https://github.com/akash-network/console/issues/1321)) ([5d2d726](https://github.com/akash-network/console/commit/5d2d7262a931a3f2cc962a36c2b644258d025d5a))

## [2.90.2](https://github.com/akash-network/console/compare/console-api/v2.90.1...console-api/v2.90.2) (2025-05-16)


### Code Refactoring

* move /v1/provider-versions to modules ([#1317](https://github.com/akash-network/console/issues/1317)) ([162f732](https://github.com/akash-network/console/commit/162f732f78fd73459e2a34e14d701109dc2b49f4)), closes [#1272](https://github.com/akash-network/console/issues/1272)
* move provider dashboard to modules ([#1315](https://github.com/akash-network/console/issues/1315)) ([841fdb8](https://github.com/akash-network/console/commit/841fdb8683d748a824a500eedb5b1908d1ebddac)), closes [#1272](https://github.com/akash-network/console/issues/1272)

## [2.90.1](https://github.com/akash-network/console/compare/console-api/v2.90.0...console-api/v2.90.1) (2025-05-15)


### Code Refactoring

* move provider endpoints to modules ([#1309](https://github.com/akash-network/console/issues/1309)) ([6c5a434](https://github.com/akash-network/console/commit/6c5a4343c50b49b35833cfbce810a65ae3c75ed7)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* **notifications:** implement modular configuration architecture ([ead91e4](https://github.com/akash-network/console/commit/ead91e4fdc04a799b32f0d9725bcb62fbaeeb8fd))

## [2.90.0](https://github.com/akash-network/console/compare/console-api/v2.89.0...console-api/v2.90.0) (2025-05-12)


### Features

* **analytics:** removes amplitude sampling ([dedff8a](https://github.com/akash-network/console/commit/dedff8a062b182e3408a2d6bfc5915da90791a6c))


### Code Refactoring

* move provider-active-leases-graph-data to modules ([#1301](https://github.com/akash-network/console/issues/1301)) ([f1c004f](https://github.com/akash-network/console/commit/f1c004fb8379c1d6301c3cb1209924fcc64a8021)), closes [#1272](https://github.com/akash-network/console/issues/1272)

## [2.89.0](https://github.com/akash-network/console/compare/console-api/v2.88.0...console-api/v2.89.0) (2025-05-10)


### Features

* **deployment:** differ insufficient funds error for user and master wallet in top up job ([65db33a](https://github.com/akash-network/console/commit/65db33a4c11e45fa8f2f5bee0385fb0b4eaebf50)), closes [#1107](https://github.com/akash-network/console/issues/1107)
* **notifications:** refactors app structure to separate concerts ([9d64416](https://github.com/akash-network/console/commit/9d64416e2edd0843fdf31cbde975ae2ea75e17fc))


### Code Refactoring

* move provider listing to its service ([#1291](https://github.com/akash-network/console/issues/1291)) ([1a44de4](https://github.com/akash-network/console/commit/1a44de4f46e52d68e2bda6f4c1b906d8cf7724b6)), closes [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272) [#1272](https://github.com/akash-network/console/issues/1272)
* unify methods listing leases ([#1302](https://github.com/akash-network/console/issues/1302)) ([2876f9c](https://github.com/akash-network/console/commit/2876f9ccffc66d85537e6574ec3d6ad5b9399b70)), closes [#1272](https://github.com/akash-network/console/issues/1272)
* uses logger and http sdk from local pkgs for notification service ([fe3539b](https://github.com/akash-network/console/commit/fe3539b5995aca4f88fe281da5ac282779ee3f8e))

## [2.88.0](https://github.com/akash-network/console/compare/console-api/v2.87.1...console-api/v2.88.0) (2025-05-01)


### Features

* **deployment:** managed api all deployments ([#1243](https://github.com/akash-network/console/issues/1243)) ([d86d748](https://github.com/akash-network/console/commit/d86d7484fa5b683329a84c6bfba1f6bcb46132bc))
* **provider:** can list trial providers, as well as trial/registered providers ([#1288](https://github.com/akash-network/console/issues/1288)) ([313af5b](https://github.com/akash-network/console/commit/313af5b44436beb4dc6faffd495fd078f5e4d3e6)), closes [#1272](https://github.com/akash-network/console/issues/1272)


### Bug Fixes

* **billing:** handle insufficient funds error for user and master wallet ([136162e](https://github.com/akash-network/console/commit/136162e1e91d5e515863b30e678c3d4ce20bad18)), closes [#1107](https://github.com/akash-network/console/issues/1107)
* **deployment:** template list logo dark ([#1287](https://github.com/akash-network/console/issues/1287)) ([49f3fd3](https://github.com/akash-network/console/commit/49f3fd36c20e38bd6a6055804c2e9656881377b6))

## [2.87.1](https://github.com/akash-network/console/compare/console-api/v2.87.0...console-api/v2.87.1) (2025-04-24)


### Bug Fixes

* **billing:** fixes some of the managed wallet error codes ([262fd43](https://github.com/akash-network/console/commit/262fd43c1f69530ad9fab89843130f131b583b94)), closes [#1251](https://github.com/akash-network/console/issues/1251)

## [2.87.0](https://github.com/akash-network/console/compare/console-api/v2.86.0...console-api/v2.87.0) (2025-04-23)


### Features

* **deployment:** add swagger doc for managed api ([#1247](https://github.com/akash-network/console/issues/1247)) ([c5a20f5](https://github.com/akash-network/console/commit/c5a20f5ff75c9e63bfd2fc7789baf07a51aad199))

## [2.86.0](https://github.com/akash-network/console/compare/console-api/v2.85.1...console-api/v2.86.0) (2025-04-17)


### Features

* **analytics:** track user action on the backend ([d0ae4da](https://github.com/akash-network/console/commit/d0ae4da0d176b03e6621db32a97cf36c8cd4c8d5))


### Bug Fixes

* **billing:** handle deployment config errors ([#1236](https://github.com/akash-network/console/issues/1236)) ([2d04840](https://github.com/akash-network/console/commit/2d04840e22e9a2ef0fb3b96ae89058ba57d2d88c))
* **billing:** logs auto top up error data ([cd1863f](https://github.com/akash-network/console/commit/cd1863fe7edef0e408fa95047579fa8971de0fd9))
* **deployment:** provider name might be null ([#1209](https://github.com/akash-network/console/issues/1209)) ([5c622d4](https://github.com/akash-network/console/commit/5c622d44f0cd045b3e32cb7d2818977175c12551)), closes [#1197](https://github.com/akash-network/console/issues/1197) [#1197](https://github.com/akash-network/console/issues/1197)


### Code Refactoring

* removes sentry from console-api ([#1220](https://github.com/akash-network/console/issues/1220)) ([8339158](https://github.com/akash-network/console/commit/8339158321771e716cddd7de4242d7de370697d0))
* removes unused dependencies in console-api ([#1221](https://github.com/akash-network/console/issues/1221)) ([e16ffbf](https://github.com/akash-network/console/commit/e16ffbfcb07d5e683792882c242004e1c62da46c))

## [2.85.1](https://github.com/akash-network/console/compare/console-api/v2.85.0...console-api/v2.85.1) (2025-04-15)


### Bug Fixes

* disables nodejs auto family selection ([#1212](https://github.com/akash-network/console/issues/1212)) ([c6be104](https://github.com/akash-network/console/commit/c6be104cf583a07d20fb9f92661ffa29e23b492a))


### Code Refactoring

* changes api/utils to use strict types ([#1186](https://github.com/akash-network/console/issues/1186)) ([4b32c47](https://github.com/akash-network/console/commit/4b32c477b7d4c60e1912ba583dca5526b3a2b818))

## [2.85.0](https://github.com/akash-network/console/compare/console-api/v2.84.0...console-api/v2.85.0) (2025-04-11)


### Features

* **billing:** handles some chain errors ([496c5f8](https://github.com/akash-network/console/commit/496c5f870f44650692f3ab074138c79b56251d6e)), closes [#1190](https://github.com/akash-network/console/issues/1190) [#1194](https://github.com/akash-network/console/issues/1194)

## [2.84.0](https://github.com/akash-network/console/compare/console-api/v2.83.0...console-api/v2.84.0) (2025-04-10)


### Features

* **billing:** managed wallet api balances endpoint ([#1183](https://github.com/akash-network/console/issues/1183)) ([68024bc](https://github.com/akash-network/console/commit/68024bc394d1d846779a82038abb8b52a694cf21))

## [2.83.0](https://github.com/akash-network/console/compare/console-api/v2.82.0...console-api/v2.83.0) (2025-04-10)


### Features

* **observability:** fixes tx span name ([30ebd2e](https://github.com/akash-network/console/commit/30ebd2e0f09edcc71bd6773155a70fce1f4bfee5))

## [2.82.0](https://github.com/akash-network/console/compare/console-api/v2.81.0...console-api/v2.82.0) (2025-04-09)


### Features

* **deployment:** managed wallet api lease status ([#1161](https://github.com/akash-network/console/issues/1161)) ([d2f03f8](https://github.com/akash-network/console/commit/d2f03f85924ed791aa9b160bf6276571066c4074))

## [2.81.0](https://github.com/akash-network/console/compare/console-api/v2.80.0...console-api/v2.81.0) (2025-04-09)


### Features

* **observability:** adds tracing utilities and spans tx signing method  ([4ab8e66](https://github.com/akash-network/console/commit/4ab8e6616fb2672f64f1daf7b2e424a267e3728c))

## [2.80.0](https://github.com/akash-network/console/compare/console-api/v2.79.5...console-api/v2.80.0) (2025-04-08)


### Features

* **observability:** adds hono instrumentation  ([2ffeb72](https://github.com/akash-network/console/commit/2ffeb72022a6c33706ceed08417a9b375a51ac4f))

## [2.79.5](https://github.com/akash-network/console/compare/console-api/v2.79.4...console-api/v2.79.5) (2025-04-08)


### Bug Fixes

* **observability:** remove manual instrumentations ([2156682](https://github.com/akash-network/console/commit/215668283dab26bbcc549ce2fe955625e52ad749))

## [2.79.4](https://github.com/akash-network/console/compare/console-api/v2.79.3...console-api/v2.79.4) (2025-04-08)


### Bug Fixes

* **observability:** adds otel auto instrumentation package ([444ef08](https://github.com/akash-network/console/commit/444ef08859ac00852994ef6c89905a0c1c033cb5))

## [2.79.3](https://github.com/akash-network/console/compare/console-api/v2.79.2...console-api/v2.79.3) (2025-04-01)


### Bug Fixes

* **deployment:** append trial attribute for anon only ([#1155](https://github.com/akash-network/console/issues/1155)) ([814e154](https://github.com/akash-network/console/commit/814e154a4bcaaea74507a87a3af3c9a628154835))

## [2.79.2](https://github.com/akash-network/console/compare/console-api/v2.79.1...console-api/v2.79.2) (2025-04-01)


### Bug Fixes

* **deployment:** remove back slash replace ([#1154](https://github.com/akash-network/console/issues/1154)) ([94c9e51](https://github.com/akash-network/console/commit/94c9e51b2cb7f1383628e7e358c33eeaf36ac244))
* improves logging of dashboard data date field and changes it to … ([#1148](https://github.com/akash-network/console/issues/1148)) ([1f83727](https://github.com/akash-network/console/commit/1f83727d88cbd233832d43957979d38eeb128deb))

## [2.79.1](https://github.com/akash-network/console/compare/console-api/v2.79.0...console-api/v2.79.1) (2025-03-31)


### Bug Fixes

* ensures that stats.date is a string ([#1145](https://github.com/akash-network/console/issues/1145)) ([38b2382](https://github.com/akash-network/console/commit/38b23820f1d6a4f2850fa645b62ea2637fe3fea3))

## [2.79.0](https://github.com/akash-network/console/compare/console-api/v2.78.0...console-api/v2.79.0) (2025-03-31)


### Features

* **deployment:** properly validate user trial deployments ([#1143](https://github.com/akash-network/console/issues/1143)) ([88741b5](https://github.com/akash-network/console/commit/88741b5cfc349b55956880375c06a8c779c9d6bd))

## [2.78.0](https://github.com/akash-network/console/compare/console-api/v2.77.0...console-api/v2.78.0) (2025-03-31)


### Features

* **deployment:** managed wallet api update deployment ([#1093](https://github.com/akash-network/console/issues/1093)) ([6998834](https://github.com/akash-network/console/commit/699883436cc1763a20f65cce17390403107b179a))
* upgrade nodejs version to 22.14 (latest lts) ([#1095](https://github.com/akash-network/console/issues/1095)) ([8533b35](https://github.com/akash-network/console/commit/8533b355762016829c4435fd67c7885df79b251e))


### Bug Fixes

* ignore zero provider stats data for last day ([#1094](https://github.com/akash-network/console/issues/1094)) ([ddfac90](https://github.com/akash-network/console/commit/ddfac90e1a58f279840c44864975456c9882076e)), closes [#721](https://github.com/akash-network/console/issues/721)


### Code Refactoring

* moves trial authorization spending out of db transaction ([#1129](https://github.com/akash-network/console/issues/1129)) ([8c8e372](https://github.com/akash-network/console/commit/8c8e3729ce7c1f7ad2c387b471b326f1fbc0d353))

## [2.77.0](https://github.com/akash-network/console/compare/console-api/v2.76.0...console-api/v2.77.0) (2025-03-28)


### Features

* **deployment:** show banner for trial users with no bids ([#922](https://github.com/akash-network/console/issues/922)) ([344af36](https://github.com/akash-network/console/commit/344af36c7c9172f22e4bcfdc2ea3fe62284a49a8)), closes [#887](https://github.com/akash-network/console/issues/887)


### Code Refactoring

* updates last_used_at once in 30 minutes ([#1108](https://github.com/akash-network/console/issues/1108)) ([4c90cee](https://github.com/akash-network/console/commit/4c90ceecc51fbe8874547e6aada0316f6d0ca7d9))

## [2.76.0](https://github.com/akash-network/console/compare/console-api/v2.75.3...console-api/v2.76.0) (2025-03-26)


### Features

* adds basic feature flags support to api and deploy-web ([#1113](https://github.com/akash-network/console/issues/1113)) ([130407c](https://github.com/akash-network/console/commit/130407ce8632cde4cea49394ba01267a1962d158))
* **wallet:** adds exponential backoff to the signer instantiation ([#1088](https://github.com/akash-network/console/issues/1088)) ([dbd35df](https://github.com/akash-network/console/commit/dbd35df56c3cde2bc2a9fa18967f97f33faaeac0))


### Bug Fixes

* update react-query in a few places ([#1084](https://github.com/akash-network/console/issues/1084)) ([7473929](https://github.com/akash-network/console/commit/7473929504ad9d3527688082084e521a64741a25)), closes [#337](https://github.com/akash-network/console/issues/337)

## [2.75.3](https://github.com/akash-network/console/compare/console-api/v2.75.2...console-api/v2.75.3) (2025-03-24)


### Bug Fixes

* **deployment:** sign up for trial ([#1098](https://github.com/akash-network/console/issues/1098)) ([777340d](https://github.com/akash-network/console/commit/777340da91505a3dd1754ee5aea4e9d9f47f8108))

## [2.75.2](https://github.com/akash-network/console/compare/console-api/v2.75.1...console-api/v2.75.2) (2025-03-20)


### Code Refactoring

* enable eslint rules which restricts what dependencies can be used ([#1074](https://github.com/akash-network/console/issues/1074)) ([509fcd3](https://github.com/akash-network/console/commit/509fcd39831311950afdfb51c189ef46b02c855f))

## [2.75.1](https://github.com/akash-network/console/compare/console-api/v2.75.0...console-api/v2.75.1) (2025-03-20)


### Bug Fixes

* **deployment:** ignore ssl verification for api to proxy ([#1071](https://github.com/akash-network/console/issues/1071)) ([d7bcf05](https://github.com/akash-network/console/commit/d7bcf0511443b823c0392629f784c61b67e69fe7))

## [2.75.0](https://github.com/akash-network/console/compare/console-api/v2.74.1...console-api/v2.75.0) (2025-03-20)


### Features

* improves error logging for AggregateError ([#1072](https://github.com/akash-network/console/issues/1072)) ([c0ca85c](https://github.com/akash-network/console/commit/c0ca85c13b608457e65b8e90dad2d6cc310dd643))


### Bug Fixes

* ensure release can detect changes for apps based on local packages ([#1070](https://github.com/akash-network/console/issues/1070)) ([e1053c4](https://github.com/akash-network/console/commit/e1053c456ba718fc58a93799e550e9338d9aea45))

## [2.74.1](https://github.com/akash-network/console/compare/console-api/v2.74.0...console-api/v2.74.1) (2025-03-19)


### Bug Fixes

* updates dockerfile for node apps ([#1068](https://github.com/akash-network/console/issues/1068)) ([54194a0](https://github.com/akash-network/console/commit/54194a08ca514f1be623a20e7a01cfbbf2e2244a))

## [2.74.0](https://github.com/akash-network/console/compare/console-api/v2.73.0...console-api/v2.74.0) (2025-03-19)


### Features

* adds support for logging error cause ([#1064](https://github.com/akash-network/console/issues/1064)) ([#1066](https://github.com/akash-network/console/issues/1066)) ([ef8d604](https://github.com/akash-network/console/commit/ef8d60447f98e699189c852b8d18f173458386ec))

## [2.73.0](https://github.com/akash-network/console/compare/console-api/v2.72.0...console-api/v2.73.0) (2025-03-18)


### Features

* **deployment:** managed api deposit ([#1055](https://github.com/akash-network/console/issues/1055)) ([f407320](https://github.com/akash-network/console/commit/f40732079f79c39cceb533c82ac6d48f058dd388))

## [2.72.0](https://github.com/akash-network/console/compare/console-api/v2.71.0...console-api/v2.72.0) (2025-03-18)


### Features

* **deployment:** limit number of deployments for trials ([#923](https://github.com/akash-network/console/issues/923)) ([d681d51](https://github.com/akash-network/console/commit/d681d51c02501f61b81742fb4fd36aea6f536cea)), closes [#827](https://github.com/akash-network/console/issues/827)

## [2.71.0](https://github.com/akash-network/console/compare/console-api/v2.70.0...console-api/v2.71.0) (2025-03-14)


### Features

* **deployment:** managed api create leases ([#969](https://github.com/akash-network/console/issues/969)) ([1193b0c](https://github.com/akash-network/console/commit/1193b0cc4015778f0363958e296db2462be11273))

## [2.70.0](https://github.com/akash-network/console/compare/console-api/v2.69.3...console-api/v2.70.0) (2025-03-13)


### Features

* **analytics:** adds more user onboarding events ([4e87ad4](https://github.com/akash-network/console/commit/4e87ad445d6e233dc1986e757b850082f65c172d))

## [2.69.3](https://github.com/akash-network/console/compare/console-api/v2.69.2...console-api/v2.69.3) (2025-03-13)


### Bug Fixes

* ensure that akash prebuilt templates exist in the final docker image ([#1020](https://github.com/akash-network/console/issues/1020)) ([2a940a3](https://github.com/akash-network/console/commit/2a940a349a85182f88fb8a83990bf3a78b0bab3f))

## [2.69.2](https://github.com/akash-network/console/compare/console-api/v2.69.1...console-api/v2.69.2) (2025-03-10)


### Bug Fixes

* **template:** eliminates eternal loop when query if failing  ([ca93b51](https://github.com/akash-network/console/commit/ca93b5123725394094aada5149811de548717d94))

## [2.69.1](https://github.com/akash-network/console/compare/console-api/v2.69.0...console-api/v2.69.1) (2025-03-10)


### Code Refactoring

* adds warmUpTemplatesCache script ([#962](https://github.com/akash-network/console/issues/962)) ([46b37eb](https://github.com/akash-network/console/commit/46b37eb632dc6da429da94b599160b2e587980c9))

## [2.69.0](https://github.com/akash-network/console/compare/console-api/v2.68.0...console-api/v2.69.0) (2025-03-07)


### Features

* **deployment:** close deployment api endpoint ([da03657](https://github.com/akash-network/console/commit/da036579a9501f16604f4fa7a6a41af6f09b0b00)), closes [#942](https://github.com/akash-network/console/issues/942)

## [2.68.0](https://github.com/akash-network/console/compare/console-api/v2.67.1...console-api/v2.68.0) (2025-03-05)


### Features

* **certificate:** managed wallet api create certificates ([#903](https://github.com/akash-network/console/issues/903)) ([e00ef07](https://github.com/akash-network/console/commit/e00ef07444a9a8bce9c5c4d5749b4adff5e8903b))

## [2.67.1](https://github.com/akash-network/console/compare/console-api/v2.67.0...console-api/v2.67.1) (2025-03-04)


### Bug Fixes

* typos in documentation files ([07a7858](https://github.com/akash-network/console/commit/07a7858d950fe5bb0a438e7205213a107c67874a))

## [2.67.0](https://github.com/akash-network/console/compare/console-api/v2.66.0...console-api/v2.67.0) (2025-03-03)


### Features

* **network:** add API endpoints for deployment ([#860](https://github.com/akash-network/console/issues/860)) ([5a58c29](https://github.com/akash-network/console/commit/5a58c298e6ad15944a93b7cd1d82837b78235c9a)), closes [#767](https://github.com/akash-network/console/issues/767)

## [2.66.0](https://github.com/akash-network/console/compare/console-api/v2.65.0...console-api/v2.66.0) (2025-02-24)


### Features

* **network:** API endpoint listing bids ([#859](https://github.com/akash-network/console/issues/859)) ([0c7a8b9](https://github.com/akash-network/console/commit/0c7a8b97bd8bfaeaee78640a7256ef8cf279eb70)), closes [#767](https://github.com/akash-network/console/issues/767)

## [2.65.0](https://github.com/akash-network/console/compare/console-api/v2.64.0...console-api/v2.65.0) (2025-02-20)


### Features

* **users:** api keys UI ([#857](https://github.com/akash-network/console/issues/857)) ([32f9567](https://github.com/akash-network/console/commit/32f9567f05590c2d9bbd6445366570c474f8e063))

## [2.64.0](https://github.com/akash-network/console/compare/console-api/v2.63.1...console-api/v2.64.0) (2025-02-19)


### Features

* **analytics:** integrates amplitude ([c88ff59](https://github.com/akash-network/console/commit/c88ff59c19c0096916afa3774b2d15a1bd30d3eb))

## [2.63.1](https://github.com/akash-network/console/compare/console-api/v2.63.0...console-api/v2.63.1) (2025-02-15)


### Bug Fixes

* **deployment:** ensure draining deployment are searched by an extended runout time ([07154ab](https://github.com/akash-network/console/commit/07154ab71257c40a2da8cce771b2e37f3e461b48))

## [2.63.0](https://github.com/akash-network/console/compare/console-api/v2.62.1...console-api/v2.63.0) (2025-02-14)


### Features

* **user:** add user api keys schema + api ([2eac7e9](https://github.com/akash-network/console/commit/2eac7e97246f63570bdd7d9d9700438e99948c7f)), closes [#787](https://github.com/akash-network/console/issues/787)

## [2.62.1](https://github.com/akash-network/console/compare/console-api/v2.62.0...console-api/v2.62.1) (2025-02-11)


### Code Refactoring

* changes structure and reduce side-effects in provider proxy ([#831](https://github.com/akash-network/console/issues/831)) ([3002e00](https://github.com/akash-network/console/commit/3002e00508019c5adaca4a0bdc42e3b9bf0e4ef1))
* **deployment:** parallelize some calls in top up job  ([5a27caa](https://github.com/akash-network/console/commit/5a27caae6466340001689ef1018b7ad728b704f5))

## [2.62.0](https://github.com/akash-network/console/compare/console-api/v2.61.0...console-api/v2.62.0) (2025-02-11)


### Features

* **deployment:** tops up deployments for the same owner in a single tx ([5f6192f](https://github.com/akash-network/console/commit/5f6192fc67f0536e50f173ede9897124c9add0fd)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.61.0](https://github.com/akash-network/console/compare/console-api/v2.60.0...console-api/v2.61.0) (2025-02-10)


### Features

* **billing:** skips trialing wallets refill ([8961a21](https://github.com/akash-network/console/commit/8961a21459d721d1c517a1a500a09bcae2ef57dd))

## [2.60.0](https://github.com/akash-network/console/compare/console-api/v2.59.0...console-api/v2.60.0) (2025-02-09)


### Features

* **billing:** updates average gas price ([99fcb82](https://github.com/akash-network/console/commit/99fcb82000f9a96a3317962230187c5e3f585eba))

## [2.59.0](https://github.com/akash-network/console/compare/console-api/v2.58.1...console-api/v2.59.0) (2025-02-07)


### Features

* **deployment:** creates setting if not exists on get ([66cd74b](https://github.com/akash-network/console/commit/66cd74b039e6fab8c848a296047d1669b9c5a574)), closes [#714](https://github.com/akash-network/console/issues/714)
* **deployment:** marks closed deployments settings ([bef955c](https://github.com/akash-network/console/commit/bef955ccb4f49f08015c94421ce2b87e16004395)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.58.1](https://github.com/akash-network/console/compare/console-api/v2.58.0...console-api/v2.58.1) (2025-02-05)


### Bug Fixes

* **deployment:** searches leases with the correct params ([#794](https://github.com/akash-network/console/issues/794)) ([b93eedf](https://github.com/akash-network/console/commit/b93eedfb62b5d19ece300bfc8e60e7109289d5ea))

## [2.58.0](https://github.com/akash-network/console/compare/console-api/v2.57.0...console-api/v2.58.0) (2025-02-05)


### Features

* **deployment:** implements ui auto top up toggle ([f03df32](https://github.com/akash-network/console/commit/f03df324e1064f76b477cf888278eb4ad8f443cf)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.57.0](https://github.com/akash-network/console/compare/console-api/v2.56.0...console-api/v2.57.0) (2025-02-05)


### Features

* **deployment:** implement deployment settings api ([5e2b976](https://github.com/akash-network/console/commit/5e2b9763242c58025865e3f9b583336eaeda58a6)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.56.0](https://github.com/akash-network/console/compare/console-api/v2.55.1...console-api/v2.56.0) (2025-02-03)


### Features

* **deployment:** reworks top up deployments to rely on db setting ([2762b97](https://github.com/akash-network/console/commit/2762b97bbbb8d63566a258a683a5a0989f6885b4)), closes [#714](https://github.com/akash-network/console/issues/714)

## [2.55.1](https://github.com/akash-network/console/compare/console-api/v2.55.0...console-api/v2.55.1) (2025-01-31)


### Code Refactoring

* simplifies api dbs config and removes redundant connections ([#759](https://github.com/akash-network/console/issues/759)) ([7cdbf6e](https://github.com/akash-network/console/commit/7cdbf6eca0ae13dfcb18d4cdeb10351ef9f7760b))

## [2.55.0](https://github.com/akash-network/console/compare/console-api/v2.54.0...console-api/v2.55.0) (2025-01-29)


### Features

* adds more reporting data ([8c2cf03](https://github.com/akash-network/console/commit/8c2cf03713546477a8d3b85f721d668b8d7a1eec))
* **auth:** exposes cf headers ([08811f5](https://github.com/akash-network/console/commit/08811f583c673c5d5e06be48dccfc2e31cf915cf))

## [2.54.0](https://github.com/akash-network/console/compare/console-api/v2.53.1...console-api/v2.54.0) (2025-01-24)


### Features

* **deployment:** move gpu-bot into the api ([15217bf](https://github.com/akash-network/console/commit/15217bf53360de2bf3d8f00a3435e9f38ec82ebb)), closes [#674](https://github.com/akash-network/console/issues/674)

## [2.53.1](https://github.com/akash-network/console/compare/console-api/v2.53.0...console-api/v2.53.1) (2025-01-22)


### Bug Fixes

* **auth:** uses dedicated auth0 env vars for m2m  ([e308570](https://github.com/akash-network/console/commit/e3085709a5e377dc882320075a3ba61763c2a9a2))

## [2.53.0](https://github.com/akash-network/console/compare/console-api/v2.52.3...console-api/v2.53.0) (2025-01-22)


### Features

* **analytics:** GPU Usage ([10060d8](https://github.com/akash-network/console/commit/10060d8f8e5d780658cbb325040c8787763d6ddd)), closes [#580](https://github.com/akash-network/console/issues/580)


### Bug Fixes

* **billing:** added a stripe middleware ([#695](https://github.com/akash-network/console/issues/695)) ([703308f](https://github.com/akash-network/console/commit/703308f8f948e69d0373a79c942a3d05c7840b13))
* **billing:** changes body content type and schema to avoid parsing a stripe webhook ([19cb7e6](https://github.com/akash-network/console/commit/19cb7e641d5305c5c6321b13347b50c3fd86cd47))
* **stats:** fixes mistake in provider stats ([#691](https://github.com/akash-network/console/issues/691)) ([933cebf](https://github.com/akash-network/console/commit/933cebf625cb901bd25bf36b370469aaec48064f)), closes [#645](https://github.com/akash-network/console/issues/645)

## [2.52.3](https://github.com/akash-network/console/compare/console-api/v2.52.2...console-api/v2.52.3) (2025-01-21)


### Bug Fixes

* **stats:** moves total storage aggregation outside of reduce ([#689](https://github.com/akash-network/console/issues/689)) ([c410f81](https://github.com/akash-network/console/commit/c410f81edb5ca01c701449284515236c68f821b9))

## [2.52.2](https://github.com/akash-network/console/compare/console-api/v2.52.1...console-api/v2.52.2) (2025-01-21)


### Bug Fixes

* **stats:** adds back calculation of aggregated storage stats ([#686](https://github.com/akash-network/console/issues/686)) ([8c4b529](https://github.com/akash-network/console/commit/8c4b529357233c8f135ce85cc83e8ba7ba11e9ba))

## [2.52.1](https://github.com/akash-network/console/compare/console-api/v2.52.0...console-api/v2.52.1) (2025-01-21)


### Bug Fixes

* **stats:** fixes syntax for api prod version ([#683](https://github.com/akash-network/console/issues/683)) ([e2bc02d](https://github.com/akash-network/console/commit/e2bc02defb21829e49d49dc54fbb3684f71fd60c)), closes [#645](https://github.com/akash-network/console/issues/645)

## [2.52.0](https://github.com/akash-network/console/compare/console-api/v2.51.0...console-api/v2.52.0) (2025-01-21)


### Features

* **auth:** implement verification email re-send and rework relevant UI ([#676](https://github.com/akash-network/console/issues/676)) ([c2de6a6](https://github.com/akash-network/console/commit/c2de6a6f92dbb44b1758836f2a42de8eb81f4c94)), closes [#663](https://github.com/akash-network/console/issues/663)

## [2.51.0](https://github.com/akash-network/console/compare/console-api/v2.50.1...console-api/v2.51.0) (2025-01-20)


### Features

* **stats:** shows ephemeral and persistent storage separately on pie chart ([#647](https://github.com/akash-network/console/issues/647)) ([7512198](https://github.com/akash-network/console/commit/75121983391db0b932b324656a939370c47827c7)), closes [#645](https://github.com/akash-network/console/issues/645) [#665](https://github.com/akash-network/console/issues/665)

## [2.50.1](https://github.com/akash-network/console/compare/console-api/v2.50.0...console-api/v2.50.1) (2025-01-20)


### Bug Fixes

* **analytics:** fix provider graph grace period calculation ([8fcad27](https://github.com/akash-network/console/commit/8fcad27b7b09df457228e0f9ef888abc1459aeb0))
* **deployment:** ensure a single deployment top up error doesn't prevent others ([#675](https://github.com/akash-network/console/issues/675)) ([1d57578](https://github.com/akash-network/console/commit/1d57578b9a804a17497af8d21aa82dbd982c7e7f))

## [2.50.0](https://github.com/akash-network/console/compare/console-api/v2.49.0...console-api/v2.50.0) (2025-01-16)


### Features

* **auth:** forward cf clearance cookie to api via auth proxy ([bd81f2f](https://github.com/akash-network/console/commit/bd81f2f36c8f8f53e01d5dd4c879f99de1b9d151))

## [2.49.0](https://github.com/akash-network/console/compare/console-api/v2.48.0...console-api/v2.49.0) (2025-01-16)


### Features

* **auth:** add OPTIONS to the allowed headers ([81ba16d](https://github.com/akash-network/console/commit/81ba16d07d78dd48e043ebf58635f43952fccbf6))

## [2.48.0](https://github.com/akash-network/console/compare/console-api/v2.47.0...console-api/v2.48.0) (2025-01-16)


### Features

* **auth:** add OPTIONS to the allowed headers ([aefa7a9](https://github.com/akash-network/console/commit/aefa7a9aaf776bc8cf6453d46eb1a42e15e3d00a))

## [2.47.0](https://github.com/akash-network/console/compare/console-api/v2.46.0...console-api/v2.47.0) (2025-01-16)


### Features

* **auth:** enable credentials on api and start-trial client ([c64d15e](https://github.com/akash-network/console/commit/c64d15ecd02fc9ae632bd4cc2abdfff591be6a08)), closes [#627](https://github.com/akash-network/console/issues/627)

## [2.46.0](https://github.com/akash-network/console/compare/console-api/v2.45.0...console-api/v2.46.0) (2025-01-14)


### Features

* **analytics:** add financial endpoint ([#579](https://github.com/akash-network/console/issues/579)) ([92dc463](https://github.com/akash-network/console/commit/92dc463d54629ef06d35798b9d4b347ab1ff4f92))

## [2.45.0](https://github.com/akash-network/console/compare/console-api/v2.44.4...console-api/v2.45.0) (2025-01-14)


### Features

* **user:** save last ip, user-agent and fingerprint on users ([4663cae](https://github.com/akash-network/console/commit/4663cae6209f59e990a7115c8d1f45516e672340)), closes [#499](https://github.com/akash-network/console/issues/499)

## [2.44.4](https://github.com/akash-network/console/compare/console-api/v2.44.3...console-api/v2.44.4) (2025-01-03)


### Bug Fixes

* **user:** paginate users by id as a cursor when deleting stale ones ([6fcd4ab](https://github.com/akash-network/console/commit/6fcd4ab0cd9f0b142a6384bcaffe8a25d9085b84))

## [2.44.3](https://github.com/akash-network/console/compare/console-api/v2.44.2...console-api/v2.44.3) (2025-01-02)


### Bug Fixes

* **user:** revoke stale users expired grants ([21cbfa6](https://github.com/akash-network/console/commit/21cbfa654d2a3effa11b8b83404158256142c1d5))

## [2.44.2](https://github.com/akash-network/console/compare/console-api/v2.44.1...console-api/v2.44.2) (2025-01-02)


### Bug Fixes

* **user:** ensure proper revoke method result ([8e65fc2](https://github.com/akash-network/console/commit/8e65fc217dd6d730317eef6b3bd9ad699b55e88b))

## [2.44.1](https://github.com/akash-network/console/compare/console-api/v2.44.0...console-api/v2.44.1) (2025-01-02)


### Bug Fixes

* **user:** coerce env var properly ([8f473f0](https://github.com/akash-network/console/commit/8f473f0347585588f3b6607851965292137217a0))

## [2.44.0](https://github.com/akash-network/console/compare/console-api/v2.43.4...console-api/v2.44.0) (2025-01-02)


### Features

* **billing:** handle too low deposit error from chain ([65125ba](https://github.com/akash-network/console/commit/65125ba76455b167bf5572db34638812e377b6a6))

## [2.43.4](https://github.com/akash-network/console/compare/console-api/v2.43.3...console-api/v2.43.4) (2024-12-30)


### Bug Fixes

* **billing:** properly check fee grant before tx ([b721141](https://github.com/akash-network/console/commit/b72114172847514cbccbd831db3503d20f533aed))

## [2.43.3](https://github.com/akash-network/console/compare/console-api/v2.43.2...console-api/v2.43.3) (2024-12-30)


### Bug Fixes

* **billing:** use specific endpoint to check managed wallet grants ([d87d79f](https://github.com/akash-network/console/commit/d87d79fbe29350c57c625e61e7f9805c5dc0b6ea))

## [2.43.2](https://github.com/akash-network/console/compare/console-api/v2.43.1...console-api/v2.43.2) (2024-12-28)


### Bug Fixes

* **billing:** use specific endpoint to check managed wallet grants ([a8f265b](https://github.com/akash-network/console/commit/a8f265b345da62cfa33c5c57c274d691a8062ed1))

## [2.43.1](https://github.com/akash-network/console/compare/console-api/v2.43.0...console-api/v2.43.1) (2024-12-27)


### Bug Fixes

* update package version ([a873df7](https://github.com/akash-network/console/commit/a873df7dcc77b57c065ac1bb5783603e921bf673))

## [2.43.0](https://github.com/akash-network/console/compare/console-api/v2.42.0...console-api/v2.43.0) (2024-12-19)


### Features

* **billing:** resolve with valid only grants and allowances from http service ([77a0ffc](https://github.com/akash-network/console/commit/77a0ffcfe0ce912814d3e3803af6b1ac803cde71))

## [2.42.0](https://github.com/akash-network/console/compare/console-api/v2.41.1...console-api/v2.42.0) (2024-12-18)


### Features

* **dx:** move internal endpoints to v1 ([6e98471](https://github.com/akash-network/console/commit/6e984717882c6c167f2cfb0b79b2f5768c57fc53)), closes [#571](https://github.com/akash-network/console/issues/571)

## [2.41.1](https://github.com/akash-network/console/compare/console-api/v2.41.0...console-api/v2.41.1) (2024-12-16)


### Bug Fixes

* **wallet:** start trial duplicate ([001ee9c](https://github.com/akash-network/console/commit/001ee9c6e99ff12c4337e5e4f9da94be6b121346)), closes [#560](https://github.com/akash-network/console/issues/560)

## [2.41.0](https://github.com/akash-network/console/compare/console-api/v2.40.0...console-api/v2.41.0) (2024-12-16)


### Features

* **billing:** simulate tx to estimate fees on master wallet ([3d61b6a](https://github.com/akash-network/console/commit/3d61b6a1a83e5ed5e254cb5beb7b7622d33606a3)), closes [#426](https://github.com/akash-network/console/issues/426)


### Bug Fixes

* **deployment:** skip stale deployment cleanup tx if no found ([b5d799d](https://github.com/akash-network/console/commit/b5d799d9a7daa8e40a8ba59d8a3be44a5294fe72))

## [2.40.0](https://github.com/akash-network/console/compare/console-api/v2.39.0...console-api/v2.40.0) (2024-12-13)


### Features

* **deployment:** sign same wallet transactions in a batch ([c336d5f](https://github.com/akash-network/console/commit/c336d5fff182efeb3f490e66998b211ef66457c7))

## [2.39.0](https://github.com/akash-network/console/compare/console-api/v2.38.0...console-api/v2.39.0) (2024-12-11)


### Features

* **billing:** improve account mismatch error retry and logging ([df56e07](https://github.com/akash-network/console/commit/df56e072496fecabcfc54a242b8ad493226de8b8))

## [2.38.0](https://github.com/akash-network/console/compare/console-api/v2.38.0-beta.2...console-api/v2.38.0) (2024-12-10)

## [2.38.0-beta.2](https://github.com/akash-network/console/compare/console-api/v2.38.0-beta.1...console-api/v2.38.0-beta.2) (2024-12-10)


### Bug Fixes

* **billing:** check for email verified to add funds ([e1cfa10](https://github.com/akash-network/console/commit/e1cfa10835ad29938f12812f8b28d582213850ec)), closes [#535](https://github.com/akash-network/console/issues/535)

## [2.38.0-beta.1](https://github.com/akash-network/console/compare/console-api/v2.38.0-beta.0...console-api/v2.38.0-beta.1) (2024-12-10)


### Features

* **deployment:** auto top up custodial deployment with available amount ([0792a36](https://github.com/akash-network/console/commit/0792a367f64d83ed040043c021b98e5be2d82c80)), closes [#524](https://github.com/akash-network/console/issues/524)

## [2.38.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.37.0...console-api/v2.38.0-beta.0) (2024-12-09)


### Features

* **deployment:** add context to top up error logging ([d8ab845](https://github.com/akash-network/console/commit/d8ab845a3ab6f337f2eefeacec5534a7d90c5837))

## [2.37.0](https://github.com/akash-network/console/compare/console-api/v2.37.0-beta.0...console-api/v2.37.0) (2024-12-06)

## [2.37.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.36.0...console-api/v2.37.0-beta.0) (2024-12-05)


### Features

* **deployment:** auto top up managed deployment with available amount ([644332f](https://github.com/akash-network/console/commit/644332ffb6b7dffab2150f4ec6dfb70601df6816))

## [2.36.0](https://github.com/akash-network/console/compare/console-api/v2.36.0-beta.0...console-api/v2.36.0) (2024-12-04)

## [2.36.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.35.4-beta.0...console-api/v2.36.0-beta.0) (2024-12-04)


### Features

* **deployment:** add concurrency for top up deployment  ([0b4abf5](https://github.com/akash-network/console/commit/0b4abf5510eca6986257081ba5481936b6cb54f6)), closes [#519](https://github.com/akash-network/console/issues/519)

## [2.35.4-beta.0](https://github.com/akash-network/console/compare/console-api/v2.35.3...console-api/v2.35.4-beta.0) (2024-12-03)


### Bug Fixes

* **billing:** filter prices by product ([45eb976](https://github.com/akash-network/console/commit/45eb9762b7c7fd542359bf91b8f92cf7c708b749)), closes [#511](https://github.com/akash-network/console/issues/511)

## [2.35.3](https://github.com/akash-network/console/compare/console-api/v2.35.3-beta.0...console-api/v2.35.3) (2024-12-03)

## [2.35.3-beta.0](https://github.com/akash-network/console/compare/console-api/v2.35.2...console-api/v2.35.3-beta.0) (2024-12-03)


### Bug Fixes

* **deployment:** update the Block import ([5db9f02](https://github.com/akash-network/console/commit/5db9f02d380c63db0dc694eeb7cb7bb5c6aa1c32)), closes [#512](https://github.com/akash-network/console/issues/512)

## [2.35.2](https://github.com/akash-network/console/compare/console-api/v2.35.2-beta.0...console-api/v2.35.2) (2024-12-02)

## [2.35.2-beta.0](https://github.com/akash-network/console/compare/console-api/v2.35.1...console-api/v2.35.2-beta.0) (2024-11-28)


### Bug Fixes

* **observability:** ensure pino-pretty works in built app ([7f6f9ca](https://github.com/akash-network/console/commit/7f6f9ca7ca4e1ff4bc3b85735270f61cc8120242)), closes [#474](https://github.com/akash-network/console/issues/474)

## [2.35.1](https://github.com/akash-network/console/compare/console-api/v2.35.1-beta.1...console-api/v2.35.1) (2024-11-28)

## [2.35.1-beta.1](https://github.com/akash-network/console/compare/console-api/v2.35.1-beta.0...console-api/v2.35.1-beta.1) (2024-11-28)


### Bug Fixes

* **deployment:** provider deployments query fix ([4278bbd](https://github.com/akash-network/console/commit/4278bbd718d56a71d49baefd73d1b2d35e427aff)), closes [#504](https://github.com/akash-network/console/issues/504)

## [2.35.1-beta.0](https://github.com/akash-network/console/compare/console-api/v2.35.0...console-api/v2.35.1-beta.0) (2024-11-28)


### Bug Fixes

* **deployment:** fix console arg to object mapping ([6126106](https://github.com/akash-network/console/commit/6126106a800d7006b726ff98190e09368cc0c130)), closes [#503](https://github.com/akash-network/console/issues/503)

## [2.35.0](https://github.com/akash-network/console/compare/console-api/v2.35.0-beta.0...console-api/v2.35.0) (2024-11-27)

## [2.35.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.34.0...console-api/v2.35.0-beta.0) (2024-11-27)


### Features

* **deployment:** clean up trial deployments for a provider ([41018af](https://github.com/akash-network/console/commit/41018afc0593621c4627369b9f114f849e249e44)), closes [#502](https://github.com/akash-network/console/issues/502)

## [2.34.0](https://github.com/akash-network/console/compare/console-api/v2.34.0-beta.1...console-api/v2.34.0) (2024-11-26)

## [2.34.0-beta.1](https://github.com/akash-network/console/compare/console-api/v2.34.0-beta.0...console-api/v2.34.0-beta.1) (2024-11-26)


### Features

* **deployment:** implement ato top up setting ([1301314](https://github.com/akash-network/console/commit/130131485a68f699587415f96283e0dc83072502)), closes [#412](https://github.com/akash-network/console/issues/412)

## [2.34.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.33.1...console-api/v2.34.0-beta.0) (2024-11-23)


### Features

* **provider:** new provider trial endpoint ([2712e38](https://github.com/akash-network/console/commit/2712e380b8f5af0930abbdf9347a1dee3eb75f8a)), closes [#488](https://github.com/akash-network/console/issues/488)

## [2.33.1](https://github.com/akash-network/console/compare/console-api/v2.33.1-beta.0...console-api/v2.33.1) (2024-11-23)

## [2.33.1-beta.0](https://github.com/akash-network/console/compare/console-api/v2.33.0...console-api/v2.33.1-beta.0) (2024-11-21)


### Bug Fixes

* **deployment:** latest processed height deployment stale ([8d8384f](https://github.com/akash-network/console/commit/8d8384f519ae958e324a81fbf5a2ae00383bddc3)), closes [#491](https://github.com/akash-network/console/issues/491)

## [2.33.0](https://github.com/akash-network/console/compare/console-api/v2.33.0-beta.1...console-api/v2.33.0) (2024-11-21)

## [2.33.0-beta.1](https://github.com/akash-network/console/compare/console-api/v2.33.0-beta.0...console-api/v2.33.0-beta.1) (2024-11-21)


### Bug Fixes

* **billing:** only resolve with active stripe prices ([fa32f37](https://github.com/akash-network/console/commit/fa32f37bbdce46a69cbd2f1d2f242de66004f7fb))

## [2.33.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.32.0...console-api/v2.33.0-beta.0) (2024-11-21)


### Features

* **billing:** enable checkout options with promo codes ([0cb439d](https://github.com/akash-network/console/commit/0cb439dcf4ca21974d7dacd784570cd032ee9f7b))

## [2.32.0](https://github.com/akash-network/console/compare/console-api/v2.32.0-beta.1...console-api/v2.32.0) (2024-11-19)

## [2.32.0-beta.1](https://github.com/akash-network/console/compare/console-api/v2.32.0-beta.0...console-api/v2.32.0-beta.1) (2024-11-19)


### Features

* **billing:** enable promo codes on checkout via env var ([18f24f6](https://github.com/akash-network/console/commit/18f24f61d52d19364588545323ab621dcdd3b440))

## [2.32.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.31.0...console-api/v2.32.0-beta.0) (2024-11-19)


### Features

* **billing:** enable promo codes on checkout ([de11211](https://github.com/akash-network/console/commit/de112115d61c189849a9cffa83c620487be38093))

## [2.31.0](https://github.com/akash-network/console/compare/console-api/v2.31.0-beta.1...console-api/v2.31.0) (2024-11-19)

## [2.31.0-beta.1](https://github.com/akash-network/console/compare/console-api/v2.31.0-beta.0...console-api/v2.31.0-beta.1) (2024-11-19)


### Features

* **analytics:** add user analytics and refactor analytic related logic ([552cd82](https://github.com/akash-network/console/commit/552cd8244634bf1de49875ce0d9b7490466ae5b0))

## [2.31.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.30.1...console-api/v2.31.0-beta.0) (2024-11-18)


### Features

* **deployment:** implement concurrency option for stale deployments cleaner ([54cae5d](https://github.com/akash-network/console/commit/54cae5d0f3c37dd6fe6623bcc249379f99cad247))
* **user:** implement dry run and summary logging for stale anonymous users cleaner ([61752e9](https://github.com/akash-network/console/commit/61752e90fecc559eade828c721fa54839d8aef49)), closes [#464](https://github.com/akash-network/console/issues/464)

## [2.30.1](https://github.com/akash-network/console/compare/console-api/v2.30.1-beta.0...console-api/v2.30.1) (2024-11-15)

## [2.30.1-beta.0](https://github.com/akash-network/console/compare/console-api/v2.30.0...console-api/v2.30.1-beta.0) (2024-11-15)


### Bug Fixes

* **observability:** bump logger version ([b258c63](https://github.com/akash-network/console/commit/b258c6389d22c0bf57e9c702b51a1280faf74eb7))

## [2.30.0](https://github.com/akash-network/console/compare/console-api/v2.30.0-beta.0...console-api/v2.30.0) (2024-11-15)

## [2.30.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.29.1...console-api/v2.30.0-beta.0) (2024-11-15)


### Features

* **user:** implement stale anonymous users cleanup cli command ([a936f44](https://github.com/akash-network/console/commit/a936f44c6e532efc1f559986c352594237ce3691)), closes [#464](https://github.com/akash-network/console/issues/464)

## [2.29.1](https://github.com/akash-network/console/compare/console-api/v2.29.1-beta.0...console-api/v2.29.1) (2024-11-13)

## [2.29.1-beta.0](https://github.com/akash-network/console/compare/console-api/v2.29.0...console-api/v2.29.1-beta.0) (2024-11-13)


### Bug Fixes

* **deployment:** set owner of custodial wallet as fee granter for top up ([b3b9474](https://github.com/akash-network/console/commit/b3b94745a91c9fdd1f1ac39cb176add2d579aac0)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.29.0](https://github.com/akash-network/console/compare/console-api/v2.29.0-beta.0...console-api/v2.29.0) (2024-11-12)

## [2.29.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.28.1-beta.0...console-api/v2.29.0-beta.0) (2024-11-12)


### Features

* **deployment:** implement auto top up summary logging ([b0a40a2](https://github.com/akash-network/console/commit/b0a40a234a6a2fa380c6fffe230cd1f361e8d322)), closes [#395](https://github.com/akash-network/console/issues/395)
* **deployment:** implement deployment top up dry run ([be1274b](https://github.com/akash-network/console/commit/be1274b889de555cb4307d746f77af582950460d)), closes [#395](https://github.com/akash-network/console/issues/395)
* **deployment:** implement top up message sending ([f5d7233](https://github.com/akash-network/console/commit/f5d7233c6ce1e7fc880e817e7d8ff66967b8a547)), closes [#395](https://github.com/akash-network/console/issues/395)


### Bug Fixes

* **deployment:** ensure draining deployments result as array ([23234d6](https://github.com/akash-network/console/commit/23234d614fef179b914a264ced64d6575e9152d7)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.28.1-beta.0](https://github.com/akash-network/console/compare/console-api/v2.28.0...console-api/v2.28.1-beta.0) (2024-11-11)


### Bug Fixes

* **deployment:** trial provider attributes ([6f5c94d](https://github.com/akash-network/console/commit/6f5c94d41879a8d23ed129857f5d28285d4f9ee9)), closes [#453](https://github.com/akash-network/console/issues/453)

## [2.28.0](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.10...console-api/v2.28.0) (2024-11-08)

## [2.28.0-beta.10](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.9...console-api/v2.28.0-beta.10) (2024-11-08)


### Features

* **deployment:** properly log clean up on error ([99e3c04](https://github.com/akash-network/console/commit/99e3c0446665f059b720b36b2c06914a7cf63b28))

## [2.28.0-beta.9](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.8...console-api/v2.28.0-beta.9) (2024-11-08)


### Features

* **deployment:** ensure there's sufficient fees allowance on cleanup ([fbbec68](https://github.com/akash-network/console/commit/fbbec68e3e430f41ab12424a5ffb47aff059a79d))

## [2.28.0-beta.8](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.7...console-api/v2.28.0-beta.8) (2024-11-08)


### Features

* **deployment:** implement clean up of managed deployments ([882fac4](https://github.com/akash-network/console/commit/882fac457f91d968bd9ecd3129c9a2113c3dd0bf)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.28.0-beta.7](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.6...console-api/v2.28.0-beta.7) (2024-11-06)


### Features

* **deployment:** implements managed deployments top up data collection ([98d8b72](https://github.com/akash-network/console/commit/98d8b72ec82acdb8fab064008758dce7158e76ae)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.28.0-beta.6](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.5...console-api/v2.28.0-beta.6) (2024-11-06)


### Features

* add provider stats endpoint ([#402](https://github.com/akash-network/console/issues/402)) ([0570d24](https://github.com/akash-network/console/commit/0570d24a3ffaf14a59f5a234a68572a852a1f8b0))

## [2.28.0-beta.5](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.4...console-api/v2.28.0-beta.5) (2024-11-06)


### Features

* **deployment:** implements custodial deployments top up data collection ([108f073](https://github.com/akash-network/console/commit/108f0736359cc866bb9aa01e3935105c413c8aae)), closes [#39](https://github.com/akash-network/console/issues/39)

## [2.28.0-beta.4](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.3...console-api/v2.28.0-beta.4) (2024-11-06)


### Bug Fixes

* **observability:** make sure otl data is added to logs ([820870d](https://github.com/akash-network/console/commit/820870d43203ddec5d3cd101d5c46b4b67e1d16d))

## [2.28.0-beta.3](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.2...console-api/v2.28.0-beta.3) (2024-11-06)


### Features

* **package:** extract logger into packages ([bac463b](https://github.com/akash-network/console/commit/bac463b4f4f18ef73a630d69eba7355cb20d4643)), closes [#429](https://github.com/akash-network/console/issues/429)

## [2.28.0-beta.2](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.1...console-api/v2.28.0-beta.2) (2024-11-04)


### Bug Fixes

* **wallet:** init nextPageKey with null when paginating grants ([2698b14](https://github.com/akash-network/console/commit/2698b14fc9ade6eab56e189daab753372677b9de))

## [2.28.0-beta.1](https://github.com/akash-network/console/compare/console-api/v2.28.0-beta.0...console-api/v2.28.0-beta.1) (2024-10-31)


### Features

* **deployment:** implements custodial wallet balances collection for top up ([0b08cd3](https://github.com/akash-network/console/commit/0b08cd3d4faeb818e00f0025a1c1bea818bcb213)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.28.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.27.0...console-api/v2.28.0-beta.0) (2024-10-30)


### Features

* **wallet:** implement multiple master wallets and clients ([5ea00e4](https://github.com/akash-network/console/commit/5ea00e427d426caeb6e1a85760dbffb362a0afd4)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.27.0](https://github.com/akash-network/console/compare/console-api/v2.27.0-beta.1...console-api/v2.27.0) (2024-10-30)

## [2.27.0-beta.1](https://github.com/akash-network/console/compare/console-api/v2.27.0-beta.0...console-api/v2.27.0-beta.1) (2024-10-30)


### Bug Fixes

* improve perf ([d9de0eb](https://github.com/akash-network/console/commit/d9de0eba93d0c4ee4d7e051f98843578ba30a258)), closes [#427](https://github.com/akash-network/console/issues/427)

## [2.27.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.26.0...console-api/v2.27.0-beta.0) (2024-10-29)


### Features

* **deployment:** implements basic top up handler w/o implementation ([a4cd312](https://github.com/akash-network/console/commit/a4cd3122cf1b1d22691ea5c14a320b5b743d217b)), closes [#395](https://github.com/akash-network/console/issues/395)

## [2.26.0](https://github.com/akash-network/console/compare/console-api/v2.26.0-beta.0...console-api/v2.26.0) (2024-10-23)

## [2.26.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.25.0...console-api/v2.26.0-beta.0) (2024-10-23)


### Features

* **deployment:** add new endpoint to query filtered bids for trial accounts ([3d95615](https://github.com/akash-network/console/commit/3d95615a067b50a4c468e25535089ef9ca0a058c))
* **deployment:** refactor trial providers to config file ([b18a57a](https://github.com/akash-network/console/commit/b18a57aaf01392fb62ee6b2801d022ac3e4e8958))


### Bug Fixes

* **deployment:** added provider validation for trial ([ae03311](https://github.com/akash-network/console/commit/ae03311c5189d3569cad3ae45c662069c2e1eaaa))

## [2.25.0](https://github.com/akash-network/console/compare/console-api/v2.25.0-beta.1...console-api/v2.25.0) (2024-10-17)

## [2.25.0-beta.1](https://github.com/akash-network/console/compare/console-api/v2.25.0-beta.0...console-api/v2.25.0-beta.1) (2024-10-17)


### Features

* **billing:** update master wallet and enable billing for prod ([90e0235](https://github.com/akash-network/console/commit/90e023594e6135d0e99f4b734c7e3706159d0fb4))

## [2.25.0-beta.0](https://github.com/akash-network/console/compare/console-api/v2.24.0...console-api/v2.25.0-beta.0) (2024-10-17)


### Features

* **wallet:** improve fiat payments ux ([295e085](https://github.com/akash-network/console/commit/295e08542deb57634de624c5815e1e7127333a16)), closes [#411](https://github.com/akash-network/console/issues/411)

## [2.24.0](https://github.com/akash-network/console/compare/console-api/v2.24.0-beta.0...console-api/v2.24.0) (2024-10-14)

## 2.24.0-beta.0 (2024-10-14)


### Features

* add beta env ([#326](https://github.com/akash-network/console/issues/326)) ([855ff4b](https://github.com/akash-network/console/commit/855ff4b084a68d6042fcb3cd181fc91abe998520))
* add nginx proxying with ssl to api & provider-proxy ([#368](https://github.com/akash-network/console/issues/368)) ([d1fb395](https://github.com/akash-network/console/commit/d1fb3957dab60ec4f788a9f81e46bf8c47fffef5))
* **auth:** implement anonymous user authentication ([fa9de2f](https://github.com/akash-network/console/commit/fa9de2f0d0f8d0a0c483f07856cebdb58d8f5344)), closes [#247](https://github.com/akash-network/console/issues/247)
* **auth:** implements basic anonymous user auth ([ca816f5](https://github.com/akash-network/console/commit/ca816f5e4136c1b4e515c73b249e10d0dc0964e3)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** add billing module with trial wallet creation ([d1ca550](https://github.com/akash-network/console/commit/d1ca550ae3d94e08de15f2d329ed6f81d192653b)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** add wallet trialing flag ([e9cc512](https://github.com/akash-network/console/commit/e9cc5125d7bf9b8853ea48f6e8ded87fd490d24a)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** adjust migrations and env for deployment ([45656d7](https://github.com/akash-network/console/commit/45656d7848ac0fdd5689b46a32221d48a7b32469)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** ensure master wallet sequence is correct ([8372f38](https://github.com/akash-network/console/commit/8372f387718dec9a8fed81e4048690c46f7e8b10)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** handle tx errors ([3430a08](https://github.com/akash-network/console/commit/3430a089629e40019b90fa712d668279b9774982)), closes [#340](https://github.com/akash-network/console/issues/340) [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement balance refresh ([9d54f44](https://github.com/akash-network/console/commit/9d54f44c4024457b5bc339b6c32c67b3f3d37486)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement balance wallets refill ([fa1f252](https://github.com/akash-network/console/commit/fa1f252468bd30106a67be2fb011870d5e5e6c8d)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet ([164d86b](https://github.com/akash-network/console/commit/164d86b56cb48d9ebb7b7102743d3c3fd363e6f6)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet top up ([04f5aad](https://github.com/akash-network/console/commit/04f5aad51079bea8c8d58c2147c78598b5bb409d)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement managed wallet top up 1 ([bd4c06b](https://github.com/akash-network/console/commit/bd4c06bd49cc1c16380997b4af0185360ffd5f0b)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** implement wallet type switch ([155113c](https://github.com/akash-network/console/commit/155113c0aee2913d2cf4da839126a4a10768de05)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** rename POST /v1/wallets to POST /v1/start-trial ([b39b057](https://github.com/akash-network/console/commit/b39b057315251c6b94532c4b3bfbf99380f46d62)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** use akt for managed wallet fees ([41d58e6](https://github.com/akash-network/console/commit/41d58e65f7bd08667ddd25beb4f102cc9149ee9f)), closes [#247](https://github.com/akash-network/console/issues/247)
* **config:** setup doppler env for api ([ed22ad7](https://github.com/akash-network/console/commit/ed22ad7181e12f4e30583be2a9c118596146bf14))
* **console:** add all leap wallets ([#346](https://github.com/akash-network/console/issues/346)) ([f00c367](https://github.com/akash-network/console/commit/f00c3679ef997e5133dcdc46550deb2bcea81dd1))
* **console:** Add config from awesome akash for SSH toggle ([#301](https://github.com/akash-network/console/issues/301)) ([8765a4f](https://github.com/akash-network/console/commit/8765a4fe5123c868bacfa9c59cd0b6209a85224e))
* **console:** managed wallets popup confirmation ([#342](https://github.com/akash-network/console/issues/342)) ([c7d16d6](https://github.com/akash-network/console/commit/c7d16d6a0d942cef8e64c6978d9ff565a0336c0d))
* **deployment:** implement deployment deposit top up via managed wallet ([baa36d3](https://github.com/akash-network/console/commit/baa36d3b039c899fde0700bf3b1ae3c08209aa07)), closes [#247](https://github.com/akash-network/console/issues/247)
* **env:** improve env loading logic for the api ([0ec14d7](https://github.com/akash-network/console/commit/0ec14d7dc338cb0ae545d301b7c0406591ebc8b2))
* **env:** unify app configs for api and indexer, update doc ([f3f7df4](https://github.com/akash-network/console/commit/f3f7df486e0feabdd672e3d7776c7dab49cde90d)), closes [#313](https://github.com/akash-network/console/issues/313)
* **error:** add sentry reporter integrated with otl ([0378ee4](https://github.com/akash-network/console/commit/0378ee4e0cacc1a7fa519fea6e386f137098de93)), closes [#247](https://github.com/akash-network/console/issues/247)
* finish console rebrand ([#259](https://github.com/akash-network/console/issues/259)) ([ae272e8](https://github.com/akash-network/console/commit/ae272e81dc5bcadf6f8c8114514f2fee30d6e135))
* implement npm workspaces  ([#208](https://github.com/akash-network/console/issues/208)) ([c403dc1](https://github.com/akash-network/console/commit/c403dc155b9b213f5ba043d92ee1967e0b133fe3))
* improve provider leases graph ([#246](https://github.com/akash-network/console/issues/246)) ([f5fe74e](https://github.com/akash-network/console/commit/f5fe74e15d6b3d7fbccb28de141451ced5336823))
* **indexer:** track provider persistent storage ([1762ba6](https://github.com/akash-network/console/commit/1762ba6658b15c8a2f57c6b5871f2423eb8105b3))
* **logging:** implement fluentd reporter ([ffc764b](https://github.com/akash-network/console/commit/ffc764b04e55e22bbedcf9f3389f321ce88a7b47)), closes [#370](https://github.com/akash-network/console/issues/370)
* **logging:** replace contextual logger with open telemetry ([deca03b](https://github.com/akash-network/console/commit/deca03b7d5f2c4478ccc35cd1ec7bf846775cd3a))
* merge "Upload SDL" to "Build your template" and add "Plain Linux" template ([#244](https://github.com/akash-network/console/issues/244)) ([0edf499](https://github.com/akash-network/console/commit/0edf4992b6e01f6243ab226f2666ec4e05c312e4))
* **pg:** disable drizzle to avoid timestamps stringification ([6e59b6b](https://github.com/akash-network/console/commit/6e59b6b9b2bb793014069d82fac489c7ff8408c2))
* **release:** implement release with image build ([a9fa7e8](https://github.com/akash-network/console/commit/a9fa7e80b373af4ca90438292f582e661680fb2d))
* shared packages ([#237](https://github.com/akash-network/console/issues/237)) ([bd79006](https://github.com/akash-network/console/commit/bd79006abff3ee2d06657269ddd0e76d1554f275))
* **stats:** improve stats app resiliency ([34dbbf1](https://github.com/akash-network/console/commit/34dbbf14b75d5ef2cc97a4f634a8401955070c4e))
* templates logo url ([#315](https://github.com/akash-network/console/issues/315)) ([fd92d15](https://github.com/akash-network/console/commit/fd92d157884eab79e6dea7c248957fa1d61a58b3))
* **user:** implement anonymous user registration ([b58d74a](https://github.com/akash-network/console/commit/b58d74a8ba0412f1ff8eeeaecafa1a2369723cbf)), closes [#247](https://github.com/akash-network/console/issues/247)
* **user:** transfer a wallet from anonymous user to a logged in one ([edf3d3a](https://github.com/akash-network/console/commit/edf3d3acb9fcea24ba8c95ce521e31a74cedea06)), closes [#247](https://github.com/akash-network/console/issues/247)


### Bug Fixes

* **api:** default expiration 10y if not set for deployment deposit ([#377](https://github.com/akash-network/console/issues/377)) ([cab6d16](https://github.com/akash-network/console/commit/cab6d16ad3335214f869c9bb19896e08d1114350))
* **api:** fix body parsing in sentry reporting ([df86495](https://github.com/akash-network/console/commit/df86495c43e8e5e3e5a26a444440ce3753a30f9c))
* **api:** improve dseq validation ([67f94f2](https://github.com/akash-network/console/commit/67f94f265481544aa06ef0d894b890326ae2d6ba))
* **api:** improve template link detection ([c19b0e3](https://github.com/akash-network/console/commit/c19b0e330acc61f4d521e683605f06fb62cdb24f))
* **api:** update staging stripe checkout redirect url ([b3dea6e](https://github.com/akash-network/console/commit/b3dea6e4af27ffa5152d1b80f5bd2470f11199c8))
* **auth:** properly authenticate new endpoints ([ce241e1](https://github.com/akash-network/console/commit/ce241e1a7edb079e014f2d95bab1ce1902b94656)), closes [#247](https://github.com/akash-network/console/issues/247)
* **billing:** ensure billing deps are not included ([6f7eef3](https://github.com/akash-network/console/commit/6f7eef3cccd58103b169cbd45c48e03a3cca9507))
* **deploy-web:** fixed error handling for transaction page ([#213](https://github.com/akash-network/console/issues/213)) ([a006e03](https://github.com/akash-network/console/commit/a006e03ad7a18679eee1d0870dec724f3a632d84))
* ensure apps build consistently in docker and locally ([f4dbd88](https://github.com/akash-network/console/commit/f4dbd88a886d683062eebd7495375bff0bd4aa54)), closes [#209](https://github.com/akash-network/console/issues/209)
* **env:** convert all env vars to SCREAMING_CASE from camelCase ([#335](https://github.com/akash-network/console/issues/335)) ([1e892ee](https://github.com/akash-network/console/commit/1e892ee5f469800955b72dacee096d4d5777bc6a))
* handle provider active leases graph when no leases or new provider ([#253](https://github.com/akash-network/console/issues/253)) ([a7feeda](https://github.com/akash-network/console/commit/a7feedaa50cc37960323182a97f4d26df59960c5))
* hotfix for dashboard-data endpoint ([a44ed1f](https://github.com/akash-network/console/commit/a44ed1fa2d5cf63102bbfebc9abc018c57e4ec32))
* use string type for message amount & predictedClosedHeight ([6aab530](https://github.com/akash-network/console/commit/6aab530a0709bba834ce9b5bd55203ec22172033))
* use string type for tx fee ([a1a19ff](https://github.com/akash-network/console/commit/a1a19ffef42de8fb2ada2f27753caae534792572))
* **user:** ensure user pages are properly loaded ([463bfee](https://github.com/akash-network/console/commit/463bfeeb531ba79bfc8bba3d8e3f7520fb4803d6)), closes [#247](https://github.com/akash-network/console/issues/247)


### Performance Improvements

* improve gpu endpoint performance + add sorting ([5cea782](https://github.com/akash-network/console/commit/5cea78253a035283d698250d3818b53dad00a0d9))
