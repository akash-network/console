

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
