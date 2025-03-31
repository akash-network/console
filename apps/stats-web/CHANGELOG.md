

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
