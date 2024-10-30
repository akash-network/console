

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
