

## [1.13.0](https://github.com/akash-network/console/compare/log-collector/v1.12.2...log-collector/v1.13.0) (2025-10-06)


### Features

* **auth:** implements managed wallet API JWT auth  ([06b4e45](https://github.com/akash-network/console/commit/06b4e4540433b3b55fbc31f76d955e05e040a82e))
* **wallet:** ensures managed wallet supports read-only mode during blockchain outage ([2a005c6](https://github.com/akash-network/console/commit/2a005c61e845906962ebfc49116974d8fdd3d931))

## [1.12.2](https://github.com/akash-network/console/compare/log-collector/v1.12.1...log-collector/v1.12.2) (2025-10-01)


### Bug Fixes

* proxy build script ([#1987](https://github.com/akash-network/console/issues/1987)) ([7c0a504](https://github.com/akash-network/console/commit/7c0a5041d4618171563bdb7e6ce82e8cb93f4d7c))

## [1.12.1](https://github.com/akash-network/console/compare/log-collector/v1.12.0...log-collector/v1.12.1) (2025-09-30)


### Code Refactoring

* adjusts authz and provider services to work when blockchain is down ([#1977](https://github.com/akash-network/console/issues/1977)) ([52ed240](https://github.com/akash-network/console/commit/52ed240375312e37752da39315da0f0fad12e8cd))

## [1.12.0](https://github.com/akash-network/console/compare/log-collector/v1.11.0...log-collector/v1.12.0) (2025-09-24)


### Features

* **bid:** marks managed bids list with certs requirement ([75fed6f](https://github.com/akash-network/console/commit/75fed6f9d6575e3ff1676cb2250b912f7b8cc2a6)), closes [#1913](https://github.com/akash-network/console/issues/1913)

## [1.11.0](https://github.com/akash-network/console/compare/log-collector/v1.10.0...log-collector/v1.11.0) (2025-09-23)


### Features

* **billing:** add 3dsecure payments ui ([#1933](https://github.com/akash-network/console/issues/1933)) ([4c7ce23](https://github.com/akash-network/console/commit/4c7ce23c206fda498d87e0d015e0a69cf1970aa5))


### Bug Fixes

* ensure anonymous user does not cause sentry errors ([#1943](https://github.com/akash-network/console/issues/1943)) ([9132e39](https://github.com/akash-network/console/commit/9132e39b785c7c37d055c6db09377737b6b08a5e))

## [1.10.0](https://github.com/akash-network/console/compare/log-collector/v1.9.1...log-collector/v1.10.0) (2025-09-17)


### Features

* **billing:** test charge for free trial ([#1898](https://github.com/akash-network/console/issues/1898)) ([959ed00](https://github.com/akash-network/console/commit/959ed00936c6d90b5763ea024038ecca70cf9079))

## [1.9.1](https://github.com/akash-network/console/compare/log-collector/v1.9.0...log-collector/v1.9.1) (2025-09-15)


### Bug Fixes

* sync email_verified from auth0 on demand  ([436e41a](https://github.com/akash-network/console/commit/436e41a6a1dc2c39552192d2ae648b011ccb44e2))

## [1.9.0](https://github.com/akash-network/console/compare/log-collector/v1.8.0...log-collector/v1.9.0) (2025-09-10)


### Features

* adds notification on first trial deployment ([#1872](https://github.com/akash-network/console/issues/1872)) ([3f2041f](https://github.com/akash-network/console/commit/3f2041f71fb1d5a2898aa78be36ba513c47f3fdd))


### Code Refactoring

* changes LeaseHttpService to accept http client ([#1888](https://github.com/akash-network/console/issues/1888)) ([4a13f24](https://github.com/akash-network/console/commit/4a13f24f9119d7332ae27d0a4ec6a9c35b16e93a))

## [1.8.0](https://github.com/akash-network/console/compare/log-collector/v1.7.0...log-collector/v1.8.0) (2025-08-28)


### Features

* **billing:** implement charges csv export  ([cbb3570](https://github.com/akash-network/console/commit/cbb3570a50876908c01006582a930590cf87f87d))
* **log-collector:** adds optional pod label filtering ([66b9021](https://github.com/akash-network/console/commit/66b9021dc8e801a44f5440c2fe969770e68787e5))

## [1.7.0](https://github.com/akash-network/console/compare/log-collector/v1.6.0...log-collector/v1.7.0) (2025-08-26)


### Features

* adds api background-jobs server setup ([#1833](https://github.com/akash-network/console/issues/1833)) ([d3e6214](https://github.com/akash-network/console/commit/d3e6214800722fafd872a876ddaff0591a6e6dd8))

## [1.6.0](https://github.com/akash-network/console/compare/log-collector/v1.5.0...log-collector/v1.6.0) (2025-08-25)


### Features

* make log outputs configurable and add local k8s dev setup ([#1832](https://github.com/akash-network/console/issues/1832)) ([754a3cb](https://github.com/akash-network/console/commit/754a3cb4ece83604d6391436b48f6931f9ecfb1f))


### Bug Fixes

* **deployment:** handles invalid manifest errors on POST /v1/leases ([f5da5c4](https://github.com/akash-network/console/commit/f5da5c4b02ef3e2977a8f5855eb5a8b81ac8281b)), closes [#1835](https://github.com/akash-network/console/issues/1835)

## [1.5.0](https://github.com/akash-network/console/compare/log-collector/v1.4.0...log-collector/v1.5.0) (2025-08-21)


### Features

* **log-collector:** implements fs log streaming and delivery with fluent-bit ([c05fe61](https://github.com/akash-network/console/commit/c05fe61bfbe9d218f9c88c1d0e1b3c74ec4a5d64))


### Bug Fixes

* refactor http-sdk services to accept httpClient ([#1829](https://github.com/akash-network/console/issues/1829)) ([abcb7dc](https://github.com/akash-network/console/commit/abcb7dc9eaeca626e6ba69edb561ff0172cf6c1a))

## [1.4.0](https://github.com/akash-network/console/compare/log-collector/v1.3.1...log-collector/v1.4.0) (2025-08-14)


### Features

* enables sentry sourcemaps in deploy-web ([#1800](https://github.com/akash-network/console/issues/1800)) ([f7c83bf](https://github.com/akash-network/console/commit/f7c83bf749199d17e9d9b8cb7c2f7a3413a59887))

## [1.3.1](https://github.com/akash-network/console/compare/log-collector/v1.3.0...log-collector/v1.3.1) (2025-08-04)


### Code Refactoring

* switch http services in deploy-web to fetch API ([#1775](https://github.com/akash-network/console/issues/1775)) ([c6d1105](https://github.com/akash-network/console/commit/c6d110544bff4eb422954bcce8dd007e795e1213)), closes [#1423](https://github.com/akash-network/console/issues/1423)

## [1.3.0](https://github.com/akash-network/console/compare/log-collector/v1.2.0...log-collector/v1.3.0) (2025-07-31)


### Features

* **billing:** add stripe charges table list to usage ui  ([81e9d42](https://github.com/akash-network/console/commit/81e9d42d254bee6248451aecde8868ccbf018d89))

## [1.2.0](https://github.com/akash-network/console/compare/log-collector/v1.1.0...log-collector/v1.2.0) (2025-07-27)


### Features

* adds safe node packages installation ([#1726](https://github.com/akash-network/console/issues/1726)) ([37acfee](https://github.com/akash-network/console/commit/37acfee5c1d053cec2316560ad220992d70b7cbf)), closes [#1549](https://github.com/akash-network/console/issues/1549)
* **log-collector:** improve stream resilience with Promise.allSettled ([072ec4d](https://github.com/akash-network/console/commit/072ec4d42102430a5c39b3e3051d500870565219))


### Bug Fixes

* **auth:** fetching api keys ([#1743](https://github.com/akash-network/console/issues/1743)) ([cda80ce](https://github.com/akash-network/console/commit/cda80cefacff2d677fdd4e334b9d1997b6b9bd95))

## 1.1.0 (2025-07-22)


### Features

* **log-collector:** adds release setup and readme docs ([fee8013](https://github.com/akash-network/console/commit/fee80138812ed716573e3a84a4d86df18a178ea4))
* **log-collector:** creates the app with basic datadog log forwarding ([027ce79](https://github.com/akash-network/console/commit/027ce79630abf4737d80f2489fdd93b1446d885f))
* **log-collector:** implement stream error handling with process failure ([80e5be9](https://github.com/akash-network/console/commit/80e5be92e8426f13255d218ada016ea1b92df6c0))
