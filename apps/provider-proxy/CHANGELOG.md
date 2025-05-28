

## [1.7.3](https://github.com/akash-network/console/compare/provider-proxy/v1.7.2...provider-proxy/v1.7.3) (2025-05-28)


### Bug Fixes

* update auth0 audience and issuer ([#1382](https://github.com/akash-network/console/issues/1382)) ([6e66727](https://github.com/akash-network/console/commit/6e667277a8c4f9ed787bcdc2094377fe4ae625b1))

## [1.7.2](https://github.com/akash-network/console/compare/provider-proxy/v1.7.1...provider-proxy/v1.7.2) (2025-05-27)


### Bug Fixes

* **release:** builds notifications image w/o nginx ([d68bf9a](https://github.com/akash-network/console/commit/d68bf9a94c118aa65656e15924163ba9d54a4e2b))

## [1.7.1](https://github.com/akash-network/console/compare/provider-proxy/v1.7.0...provider-proxy/v1.7.1) (2025-05-26)


### Bug Fixes

* **release:** adds notifications to docker setup  ([6951faf](https://github.com/akash-network/console/commit/6951faf46850643515757c7c16c328bbf622fa76))

## [1.7.0](https://github.com/akash-network/console/compare/provider-proxy/v1.6.5...provider-proxy/v1.7.0) (2025-05-16)


### Features

* jwt provider schema ([#1312](https://github.com/akash-network/console/issues/1312)) ([379a2d3](https://github.com/akash-network/console/commit/379a2d3ceb519e8b49c75373b8aa7a4a735bf599))

## [1.6.5](https://github.com/akash-network/console/compare/provider-proxy/v1.6.4...provider-proxy/v1.6.5) (2025-05-15)


### Code Refactoring

* **notifications:** implement modular configuration architecture ([ead91e4](https://github.com/akash-network/console/commit/ead91e4fdc04a799b32f0d9725bcb62fbaeeb8fd))

## [1.6.4](https://github.com/akash-network/console/compare/provider-proxy/v1.6.3...provider-proxy/v1.6.4) (2025-05-10)


### Code Refactoring

* uses logger and http sdk from local pkgs for notification service ([fe3539b](https://github.com/akash-network/console/commit/fe3539b5995aca4f88fe281da5ac282779ee3f8e))

## [1.6.3](https://github.com/akash-network/console/compare/provider-proxy/v1.6.2...provider-proxy/v1.6.3) (2025-05-01)


### Bug Fixes

* **billing:** handle insufficient funds error for user and master wallet ([136162e](https://github.com/akash-network/console/commit/136162e1e91d5e515863b30e678c3d4ce20bad18)), closes [#1107](https://github.com/akash-network/console/issues/1107)

## [1.6.2](https://github.com/akash-network/console/compare/provider-proxy/v1.6.1...provider-proxy/v1.6.2) (2025-04-17)


### Code Refactoring

* removes sentry from console-api ([#1220](https://github.com/akash-network/console/issues/1220)) ([8339158](https://github.com/akash-network/console/commit/8339158321771e716cddd7de4242d7de370697d0))

## [1.6.1](https://github.com/akash-network/console/compare/provider-proxy/v1.6.0...provider-proxy/v1.6.1) (2025-04-15)


### Bug Fixes

* disables nodejs auto family selection ([#1212](https://github.com/akash-network/console/issues/1212)) ([c6be104](https://github.com/akash-network/console/commit/c6be104cf583a07d20fb9f92661ffa29e23b492a))

## [1.6.0](https://github.com/akash-network/console/compare/provider-proxy/v1.5.2...provider-proxy/v1.6.0) (2025-03-31)


### Features

* upgrade nodejs version to 22.14 (latest lts) ([#1095](https://github.com/akash-network/console/issues/1095)) ([8533b35](https://github.com/akash-network/console/commit/8533b355762016829c4435fd67c7885df79b251e))


### Code Refactoring

* moves trial authorization spending out of db transaction ([#1129](https://github.com/akash-network/console/issues/1129)) ([8c8e372](https://github.com/akash-network/console/commit/8c8e3729ce7c1f7ad2c387b471b326f1fbc0d353))

## [1.5.2](https://github.com/akash-network/console/compare/provider-proxy/v1.5.1...provider-proxy/v1.5.2) (2025-03-26)


### Bug Fixes

* update react-query in a few places ([#1084](https://github.com/akash-network/console/issues/1084)) ([7473929](https://github.com/akash-network/console/commit/7473929504ad9d3527688082084e521a64741a25)), closes [#337](https://github.com/akash-network/console/issues/337)

## [1.5.1](https://github.com/akash-network/console/compare/provider-proxy/v1.5.0...provider-proxy/v1.5.1) (2025-03-20)


### Code Refactoring

* enable eslint rules which restricts what dependencies can be used ([#1074](https://github.com/akash-network/console/issues/1074)) ([509fcd3](https://github.com/akash-network/console/commit/509fcd39831311950afdfb51c189ef46b02c855f))

## [1.5.0](https://github.com/akash-network/console/compare/provider-proxy/v1.4.6...provider-proxy/v1.5.0) (2025-03-20)


### Features

* adds support for logging error cause ([#1064](https://github.com/akash-network/console/issues/1064)) ([6cd48e6](https://github.com/akash-network/console/commit/6cd48e6eb8ce7eb2c899d2f97f7154ee72e8a3e2))
* adds support for logging error cause ([#1064](https://github.com/akash-network/console/issues/1064)) ([#1066](https://github.com/akash-network/console/issues/1066)) ([ef8d604](https://github.com/akash-network/console/commit/ef8d60447f98e699189c852b8d18f173458386ec))
* improves error logging for AggregateError ([#1072](https://github.com/akash-network/console/issues/1072)) ([c0ca85c](https://github.com/akash-network/console/commit/c0ca85c13b608457e65b8e90dad2d6cc310dd643))
* **notifications:** adds basic alerts service ([5d4d6fc](https://github.com/akash-network/console/commit/5d4d6fcf23ceb2b317453a001d4043855df5c5d1))


### Bug Fixes

* ensure release can detect changes for apps based on local packages ([#1070](https://github.com/akash-network/console/issues/1070)) ([e1053c4](https://github.com/akash-network/console/commit/e1053c456ba718fc58a93799e550e9338d9aea45))
* updates dockerfile for node apps ([#1068](https://github.com/akash-network/console/issues/1068)) ([54194a0](https://github.com/akash-network/console/commit/54194a08ca514f1be623a20e7a01cfbbf2e2244a))

## [1.4.6](https://github.com/akash-network/console/compare/provider-proxy/v1.4.5...provider-proxy/v1.4.6) (2025-03-14)


### Bug Fixes

* ensures provider-proxy has valid blockchain API_URL on sandbox env ([#1032](https://github.com/akash-network/console/issues/1032)) ([325461e](https://github.com/akash-network/console/commit/325461e684a547669ac9765a3ac378ceadb86ee1))

## [1.4.4](https://github.com/akash-network/console/compare/provider-proxy/v1.4.3...provider-proxy/v1.4.4) (2025-03-11)


### Code Refactoring

* enables strict types on provider-proxy ([#981](https://github.com/akash-network/console/issues/981)) ([ac39c74](https://github.com/akash-network/console/commit/ac39c74929c72b5f6689bc758e79fb452e6af8e5))

## [1.4.3](https://github.com/akash-network/console/compare/provider-proxy/v1.4.2...provider-proxy/v1.4.3) (2025-02-11)


### Code Refactoring

* changes structure and reduce side-effects in provider proxy ([#831](https://github.com/akash-network/console/issues/831)) ([3002e00](https://github.com/akash-network/console/commit/3002e00508019c5adaca4a0bdc42e3b9bf0e4ef1))

## [1.4.2](https://github.com/akash-network/console/compare/provider-proxy/v1.4.1...provider-proxy/v1.4.2) (2025-02-09)


### Code Refactoring

* replaces express with hono in provider-proxy ([#815](https://github.com/akash-network/console/issues/815)) ([f3e4991](https://github.com/akash-network/console/commit/f3e4991c765e108c8c34b2fd716a5257bc797391))

## [1.4.1](https://github.com/akash-network/console/compare/provider-proxy/v1.4.0...provider-proxy/v1.4.1) (2025-02-07)


### Bug Fixes

* ensure certificates validator is not blocked by more than 2 requests ([#814](https://github.com/akash-network/console/issues/814)) ([ca0db09](https://github.com/akash-network/console/commit/ca0db09246a25402bdfbb4a71ee07b4da640d292)), closes [#170](https://github.com/akash-network/console/issues/170)

## [1.4.0](https://github.com/akash-network/console/compare/provider-proxy/v1.3.4...provider-proxy/v1.4.0) (2025-02-06)


### Features

* adds certificate validation to ws proxy ([#780](https://github.com/akash-network/console/issues/780)) ([2d1cc3d](https://github.com/akash-network/console/commit/2d1cc3d7c39ec50ea3ca292d3d3bce47db3185ca)), closes [#170](https://github.com/akash-network/console/issues/170)

## [1.3.4](https://github.com/akash-network/console/compare/provider-proxy/v1.3.3...provider-proxy/v1.3.4) (2025-02-05)


### Bug Fixes

* concurrent provider certs validation ([#766](https://github.com/akash-network/console/issues/766)) ([600c7cd](https://github.com/akash-network/console/commit/600c7cd462562457e042af68853db8cc9af199af))


### Code Refactoring

* extracts websocket proxy into a separate service ([#779](https://github.com/akash-network/console/issues/779)) ([2f0cb14](https://github.com/akash-network/console/commit/2f0cb14b75bcd5e1d7bc5cfd8fd683b30dc75166))

## [1.3.3](https://github.com/akash-network/console/compare/provider-proxy/v1.3.2...provider-proxy/v1.3.3) (2025-01-31)


### Code Refactoring

* extracts certificate validation into a separate class ([#764](https://github.com/akash-network/console/issues/764)) ([5bb2b51](https://github.com/akash-network/console/commit/5bb2b5122598af44decbb4846e8cb2554fd12c22))

## [1.3.2](https://github.com/akash-network/console/compare/provider-proxy/v1.3.1...provider-proxy/v1.3.2) (2025-01-31)


### Bug Fixes

* **dx:** fix e2e tests ([9ab53ef](https://github.com/akash-network/console/commit/9ab53eff42a43c4f02757b4b19aa5877f25c366e)), closes [#741](https://github.com/akash-network/console/issues/741)

## [1.3.1](https://github.com/akash-network/console/compare/provider-proxy/v1.3.0...provider-proxy/v1.3.1) (2025-01-30)


### Bug Fixes

* ensure that provider proxy does reuse Tls session in case of invalid certificate ([#755](https://github.com/akash-network/console/issues/755)) ([d85a28c](https://github.com/akash-network/console/commit/d85a28c90b9166823a0b031c13e4d41bcd8de120))

## 1.3.0 (2025-01-29)


### Features

* add beta env ([#326](https://github.com/akash-network/console/issues/326)) ([855ff4b](https://github.com/akash-network/console/commit/855ff4b084a68d6042fcb3cd181fc91abe998520))
* add nginx proxying with ssl to api & provider-proxy ([#368](https://github.com/akash-network/console/issues/368)) ([d1fb395](https://github.com/akash-network/console/commit/d1fb3957dab60ec4f788a9f81e46bf8c47fffef5))
* adds certificate validation on provider proxy ([#700](https://github.com/akash-network/console/issues/700)) ([8a92491](https://github.com/akash-network/console/commit/8a92491f4d80f8081680749f00209b2707d852a5))
* **deployment:** implement plain linux deployment page ([6da5565](https://github.com/akash-network/console/commit/6da5565c049ab9f9debace6e42ec976347b6b3a0)), closes [#227](https://github.com/akash-network/console/issues/227)
* extract custom components ([#256](https://github.com/akash-network/console/issues/256)) ([2d3e889](https://github.com/akash-network/console/commit/2d3e8898f5d6e081f49da3ae5892023317f0b6e7))
* finish console rebrand ([#259](https://github.com/akash-network/console/issues/259)) ([ae272e8](https://github.com/akash-network/console/commit/ae272e81dc5bcadf6f8c8114514f2fee30d6e135))
* implement npm workspaces  ([#208](https://github.com/akash-network/console/issues/208)) ([c403dc1](https://github.com/akash-network/console/commit/c403dc155b9b213f5ba043d92ee1967e0b133fe3))
* merge "Upload SDL" to "Build your template" and add "Plain Linux" template ([#244](https://github.com/akash-network/console/issues/244)) ([0edf499](https://github.com/akash-network/console/commit/0edf4992b6e01f6243ab226f2666ec4e05c312e4))
* **release:** implement release with image build ([a9fa7e8](https://github.com/akash-network/console/commit/a9fa7e80b373af4ca90438292f582e661680fb2d))
* **wallet:** improve fiat payments ux ([295e085](https://github.com/akash-network/console/commit/295e08542deb57634de624c5815e1e7127333a16)), closes [#411](https://github.com/akash-network/console/issues/411)


### Bug Fixes

* ensure apps build consistently in docker and locally ([f4dbd88](https://github.com/akash-network/console/commit/f4dbd88a886d683062eebd7495375bff0bd4aa54)), closes [#209](https://github.com/akash-network/console/issues/209)
* improve perf ([d9de0eb](https://github.com/akash-network/console/commit/d9de0eba93d0c4ee4d7e051f98843578ba30a258)), closes [#427](https://github.com/akash-network/console/issues/427)
* **provider-proxy:** add wss support to nginx config ([341e1a6](https://github.com/akash-network/console/commit/341e1a69f42e57b4c4eae8830ff25d152700bade))


### Code Refactoring

* **http:** extract http services to the package ([8196b4a](https://github.com/akash-network/console/commit/8196b4a0ff6503e9c057c9aea4409054cb4fc970)), closes [#247](https://github.com/akash-network/console/issues/247)
* splits provider proxy into services and routes to improve future testing ([#696](https://github.com/akash-network/console/issues/696)) ([47df89f](https://github.com/akash-network/console/commit/47df89f59fdfbbf452402f42b9f99d2113269ba7))

## 1.2.0 (2025-01-28)


### Features

* add beta env ([#326](https://github.com/akash-network/console/issues/326)) ([855ff4b](https://github.com/akash-network/console/commit/855ff4b084a68d6042fcb3cd181fc91abe998520))
* add nginx proxying with ssl to api & provider-proxy ([#368](https://github.com/akash-network/console/issues/368)) ([d1fb395](https://github.com/akash-network/console/commit/d1fb3957dab60ec4f788a9f81e46bf8c47fffef5))
* adds certificate validation on provider proxy ([#700](https://github.com/akash-network/console/issues/700)) ([8a92491](https://github.com/akash-network/console/commit/8a92491f4d80f8081680749f00209b2707d852a5))
* **deployment:** implement plain linux deployment page ([6da5565](https://github.com/akash-network/console/commit/6da5565c049ab9f9debace6e42ec976347b6b3a0)), closes [#227](https://github.com/akash-network/console/issues/227)
* extract custom components ([#256](https://github.com/akash-network/console/issues/256)) ([2d3e889](https://github.com/akash-network/console/commit/2d3e8898f5d6e081f49da3ae5892023317f0b6e7))
* finish console rebrand ([#259](https://github.com/akash-network/console/issues/259)) ([ae272e8](https://github.com/akash-network/console/commit/ae272e81dc5bcadf6f8c8114514f2fee30d6e135))
* implement npm workspaces  ([#208](https://github.com/akash-network/console/issues/208)) ([c403dc1](https://github.com/akash-network/console/commit/c403dc155b9b213f5ba043d92ee1967e0b133fe3))
* merge "Upload SDL" to "Build your template" and add "Plain Linux" template ([#244](https://github.com/akash-network/console/issues/244)) ([0edf499](https://github.com/akash-network/console/commit/0edf4992b6e01f6243ab226f2666ec4e05c312e4))
* **release:** implement release with image build ([a9fa7e8](https://github.com/akash-network/console/commit/a9fa7e80b373af4ca90438292f582e661680fb2d))
* **wallet:** improve fiat payments ux ([295e085](https://github.com/akash-network/console/commit/295e08542deb57634de624c5815e1e7127333a16)), closes [#411](https://github.com/akash-network/console/issues/411)


### Bug Fixes

* ensure apps build consistently in docker and locally ([f4dbd88](https://github.com/akash-network/console/commit/f4dbd88a886d683062eebd7495375bff0bd4aa54)), closes [#209](https://github.com/akash-network/console/issues/209)
* improve perf ([d9de0eb](https://github.com/akash-network/console/commit/d9de0eba93d0c4ee4d7e051f98843578ba30a258)), closes [#427](https://github.com/akash-network/console/issues/427)
* **provider-proxy:** add wss support to nginx config ([341e1a6](https://github.com/akash-network/console/commit/341e1a69f42e57b4c4eae8830ff25d152700bade))


### Code Refactoring

* **http:** extract http services to the package ([8196b4a](https://github.com/akash-network/console/commit/8196b4a0ff6503e9c057c9aea4409054cb4fc970)), closes [#247](https://github.com/akash-network/console/issues/247)
* splits provider proxy into services and routes to improve future testing ([#696](https://github.com/akash-network/console/issues/696)) ([47df89f](https://github.com/akash-network/console/commit/47df89f59fdfbbf452402f42b9f99d2113269ba7))

## 1.1.0 (2025-01-27)


### Features

* add beta env ([#326](https://github.com/akash-network/console/issues/326)) ([855ff4b](https://github.com/akash-network/console/commit/855ff4b084a68d6042fcb3cd181fc91abe998520))
* add nginx proxying with ssl to api & provider-proxy ([#368](https://github.com/akash-network/console/issues/368)) ([d1fb395](https://github.com/akash-network/console/commit/d1fb3957dab60ec4f788a9f81e46bf8c47fffef5))
* adds certificate validation on provider proxy ([#700](https://github.com/akash-network/console/issues/700)) ([8a92491](https://github.com/akash-network/console/commit/8a92491f4d80f8081680749f00209b2707d852a5))
* **deployment:** implement plain linux deployment page ([6da5565](https://github.com/akash-network/console/commit/6da5565c049ab9f9debace6e42ec976347b6b3a0)), closes [#227](https://github.com/akash-network/console/issues/227)
* extract custom components ([#256](https://github.com/akash-network/console/issues/256)) ([2d3e889](https://github.com/akash-network/console/commit/2d3e8898f5d6e081f49da3ae5892023317f0b6e7))
* finish console rebrand ([#259](https://github.com/akash-network/console/issues/259)) ([ae272e8](https://github.com/akash-network/console/commit/ae272e81dc5bcadf6f8c8114514f2fee30d6e135))
* implement npm workspaces  ([#208](https://github.com/akash-network/console/issues/208)) ([c403dc1](https://github.com/akash-network/console/commit/c403dc155b9b213f5ba043d92ee1967e0b133fe3))
* merge "Upload SDL" to "Build your template" and add "Plain Linux" template ([#244](https://github.com/akash-network/console/issues/244)) ([0edf499](https://github.com/akash-network/console/commit/0edf4992b6e01f6243ab226f2666ec4e05c312e4))
* **release:** implement release with image build ([a9fa7e8](https://github.com/akash-network/console/commit/a9fa7e80b373af4ca90438292f582e661680fb2d))
* **wallet:** improve fiat payments ux ([295e085](https://github.com/akash-network/console/commit/295e08542deb57634de624c5815e1e7127333a16)), closes [#411](https://github.com/akash-network/console/issues/411)


### Bug Fixes

* ensure apps build consistently in docker and locally ([f4dbd88](https://github.com/akash-network/console/commit/f4dbd88a886d683062eebd7495375bff0bd4aa54)), closes [#209](https://github.com/akash-network/console/issues/209)
* improve perf ([d9de0eb](https://github.com/akash-network/console/commit/d9de0eba93d0c4ee4d7e051f98843578ba30a258)), closes [#427](https://github.com/akash-network/console/issues/427)
* **provider-proxy:** add wss support to nginx config ([341e1a6](https://github.com/akash-network/console/commit/341e1a69f42e57b4c4eae8830ff25d152700bade))


### Code Refactoring

* **http:** extract http services to the package ([8196b4a](https://github.com/akash-network/console/commit/8196b4a0ff6503e9c057c9aea4409054cb4fc970)), closes [#247](https://github.com/akash-network/console/issues/247)
* splits provider proxy into services and routes to improve future testing ([#696](https://github.com/akash-network/console/issues/696)) ([47df89f](https://github.com/akash-network/console/commit/47df89f59fdfbbf452402f42b9f99d2113269ba7))
