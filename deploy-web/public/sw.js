if (!self.define) {
  let e,
    s = {};
  const a = (a, c) => (
    (a = new URL(a + ".js", c).href),
    s[a] ||
      new Promise(s => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = a), (e.onload = s), document.head.appendChild(e);
        } else (e = a), importScripts(a), s();
      }).then(() => {
        let e = s[a];
        if (!e) throw new Error(`Module ${a} didn’t register its module`);
        return e;
      })
  );
  self.define = (c, i) => {
    const n = e || ("document" in self ? document.currentScript.src : "") || location.href;
    if (s[n]) return;
    let t = {};
    const r = e => a(e, n),
      d = { module: { uri: n }, exports: t, require: r };
    s[n] = Promise.all(c.map(e => d[e] || r(e))).then(e => (i(...e), t));
  };
}
define(["./workbox-19663cdd"], function (e) {
  "use strict";
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: "/_next/static/XiLjPu57a-iqzFzEwM_-o/_buildManifest.js", revision: "ca3f3a83d4afb0c81d0132215a627d9b" },
        { url: "/_next/static/XiLjPu57a-iqzFzEwM_-o/_ssgManifest.js", revision: "b6652df95db52feb4daf4eca35380933" },
        { url: "/_next/static/chunks/1335-d73c269694583478.js", revision: "d73c269694583478" },
        { url: "/_next/static/chunks/1350-07f9659f28f558f8.js", revision: "07f9659f28f558f8" },
        { url: "/_next/static/chunks/1443-476ed025db3dd4b1.js", revision: "476ed025db3dd4b1" },
        { url: "/_next/static/chunks/1553-95b0c0d29fbb3445.js", revision: "95b0c0d29fbb3445" },
        { url: "/_next/static/chunks/1710-666ff1ead13f838d.js", revision: "666ff1ead13f838d" },
        { url: "/_next/static/chunks/2018-fc14dcb8e6f0c032.js", revision: "fc14dcb8e6f0c032" },
        { url: "/_next/static/chunks/2331.80fdf1c43b91f669.js", revision: "80fdf1c43b91f669" },
        { url: "/_next/static/chunks/4044-80c30f3a2b5e944f.js", revision: "80c30f3a2b5e944f" },
        { url: "/_next/static/chunks/4400-481f1f09599f62a2.js", revision: "481f1f09599f62a2" },
        { url: "/_next/static/chunks/449.0c771afcc1995d26.js", revision: "0c771afcc1995d26" },
        { url: "/_next/static/chunks/4729-899a5d4ff8ee3aca.js", revision: "899a5d4ff8ee3aca" },
        { url: "/_next/static/chunks/4769-acce898f5483d147.js", revision: "acce898f5483d147" },
        { url: "/_next/static/chunks/4848-98d5115b09d0bc29.js", revision: "98d5115b09d0bc29" },
        { url: "/_next/static/chunks/5054-3be601e5ff47a6b1.js", revision: "3be601e5ff47a6b1" },
        { url: "/_next/static/chunks/5105-27d232f986a447c2.js", revision: "27d232f986a447c2" },
        { url: "/_next/static/chunks/5632.889b47838578051c.js", revision: "889b47838578051c" },
        { url: "/_next/static/chunks/5644-8b5cbb139a37740c.js", revision: "8b5cbb139a37740c" },
        { url: "/_next/static/chunks/609-deabd5ec9a55d407.js", revision: "deabd5ec9a55d407" },
        { url: "/_next/static/chunks/6183-cb7bbe9f563fd4cb.js", revision: "cb7bbe9f563fd4cb" },
        { url: "/_next/static/chunks/652.94ff65c899230787.js", revision: "94ff65c899230787" },
        { url: "/_next/static/chunks/659-5c9173913cac5403.js", revision: "5c9173913cac5403" },
        { url: "/_next/static/chunks/6698-4f9830af81c66dbc.js", revision: "4f9830af81c66dbc" },
        { url: "/_next/static/chunks/678-08876ec4989a640b.js", revision: "08876ec4989a640b" },
        { url: "/_next/static/chunks/6782.fee4f7987d5f0efa.js", revision: "fee4f7987d5f0efa" },
        { url: "/_next/static/chunks/6886-fa7338eaa9ba83dd.js", revision: "fa7338eaa9ba83dd" },
        { url: "/_next/static/chunks/69fc0a3a-4b10f93d935c96d6.js", revision: "4b10f93d935c96d6" },
        { url: "/_next/static/chunks/7047-9a583fff28dfc3e1.js", revision: "9a583fff28dfc3e1" },
        { url: "/_next/static/chunks/7449-2549ca7b57bd6471.js", revision: "2549ca7b57bd6471" },
        { url: "/_next/static/chunks/8329.3e3b26692eec5f3b.js", revision: "3e3b26692eec5f3b" },
        { url: "/_next/static/chunks/8364-525ff7c5ef9bd630.js", revision: "525ff7c5ef9bd630" },
        { url: "/_next/static/chunks/8446-d0c2d9e64c060c9b.js", revision: "d0c2d9e64c060c9b" },
        { url: "/_next/static/chunks/8487-d3900a8beded1bb1.js", revision: "d3900a8beded1bb1" },
        { url: "/_next/static/chunks/8606-41f13b88a2de459f.js", revision: "41f13b88a2de459f" },
        { url: "/_next/static/chunks/8705-d2c5e4e46530ef3a.js", revision: "d2c5e4e46530ef3a" },
        { url: "/_next/static/chunks/9130-9aca6afb71fb70c8.js", revision: "9aca6afb71fb70c8" },
        { url: "/_next/static/chunks/9179-6a3b460e53bb2c54.js", revision: "6a3b460e53bb2c54" },
        { url: "/_next/static/chunks/9188-cbbec32407303a76.js", revision: "cbbec32407303a76" },
        { url: "/_next/static/chunks/9196-9b4def108a2c6ae9.js", revision: "9b4def108a2c6ae9" },
        { url: "/_next/static/chunks/9266-e0eca9eae0c5af3a.js", revision: "e0eca9eae0c5af3a" },
        { url: "/_next/static/chunks/942-dc48eacaaac6db13.js", revision: "dc48eacaaac6db13" },
        { url: "/_next/static/chunks/9604-189ed1e3ef3ddfd1.js", revision: "189ed1e3ef3ddfd1" },
        { url: "/_next/static/chunks/9912-3b8166bd0ea324e7.js", revision: "3b8166bd0ea324e7" },
        { url: "/_next/static/chunks/9f96d65d-7b812644c8c0f1f1.js", revision: "7b812644c8c0f1f1" },
        { url: "/_next/static/chunks/ed150ef9.ec0fa51ac82b6bd3.js", revision: "ec0fa51ac82b6bd3" },
        { url: "/_next/static/chunks/framework-4ed89e9640adfb9e.js", revision: "4ed89e9640adfb9e" },
        { url: "/_next/static/chunks/main-75a41b17c9b01e3f.js", revision: "75a41b17c9b01e3f" },
        { url: "/_next/static/chunks/pages/404-1339d0dfd9798111.js", revision: "1339d0dfd9798111" },
        { url: "/_next/static/chunks/pages/500-c1d927dfeeb50011.js", revision: "c1d927dfeeb50011" },
        { url: "/_next/static/chunks/pages/_error-d7faa34a8a9ea44c.js", revision: "d7faa34a8a9ea44c" },
        { url: "/_next/static/chunks/pages/addresses/%5Baddress%5D-782380a6d79f47ba.js", revision: "782380a6d79f47ba" },
        { url: "/_next/static/chunks/pages/addresses/%5Baddress%5D/deployments-2d414781b7f51c42.js", revision: "2d414781b7f51c42" },
        { url: "/_next/static/chunks/pages/addresses/%5Baddress%5D/transactions-179682275b0b7d3c.js", revision: "179682275b0b7d3c" },
        { url: "/_next/static/chunks/pages/analytics-3771c7da67c4558b.js", revision: "3771c7da67c4558b" },
        { url: "/_next/static/chunks/pages/blocks-a27f184f99cb6fae.js", revision: "a27f184f99cb6fae" },
        { url: "/_next/static/chunks/pages/blocks/%5Bheight%5D-bad2b0056b3fa8a3.js", revision: "bad2b0056b3fa8a3" },
        { url: "/_next/static/chunks/pages/contact-e6b0427ab8750e84.js", revision: "e6b0427ab8750e84" },
        { url: "/_next/static/chunks/pages/deployment/%5Bowner%5D/%5Bdseq%5D-8fe086eab5a19d70.js", revision: "8fe086eab5a19d70" },
        { url: "/_next/static/chunks/pages/deployments-f8f3e02e1b1b4807.js", revision: "f8f3e02e1b1b4807" },
        { url: "/_next/static/chunks/pages/deployments/%5Bdseq%5D-d4778574ab8561e7.js", revision: "d4778574ab8561e7" },
        { url: "/_next/static/chunks/pages/get-started-ae47131cc002379c.js", revision: "ae47131cc002379c" },
        { url: "/_next/static/chunks/pages/get-started/wallet-deeb4d38a71b467c.js", revision: "deeb4d38a71b467c" },
        { url: "/_next/static/chunks/pages/graph/%5Bsnapshot%5D-14ae45aacfcf7eeb.js", revision: "14ae45aacfcf7eeb" },
        { url: "/_next/static/chunks/pages/index-1abf24e194465158.js", revision: "1abf24e194465158" },
        { url: "/_next/static/chunks/pages/maintenance-03d4198918f37d40.js", revision: "03d4198918f37d40" },
        { url: "/_next/static/chunks/pages/new-deployment-07d4de50764810c2.js", revision: "07d4de50764810c2" },
        { url: "/_next/static/chunks/pages/price-compare-fbea83d7fe597965.js", revision: "fbea83d7fe597965" },
        { url: "/_next/static/chunks/pages/privacy-policy-c51f80ec2363dd44.js", revision: "c51f80ec2363dd44" },
        { url: "/_next/static/chunks/pages/profile/%5Busername%5D-0d83b372dbdafdf8.js", revision: "0d83b372dbdafdf8" },
        { url: "/_next/static/chunks/pages/provider-graph/%5Bsnapshot%5D-42d9f4e01c902280.js", revision: "42d9f4e01c902280" },
        { url: "/_next/static/chunks/pages/providers-13393b7d74bf7a6b.js", revision: "13393b7d74bf7a6b" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D-cf6071b5db355496.js", revision: "cf6071b5db355496" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/edit-36a2680ded3fa13f.js", revision: "36a2680ded3fa13f" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/leases-b6f2e28a10c52c09.js", revision: "b6f2e28a10c52c09" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/raw-2502a6f3c9ed3ddd.js", revision: "2502a6f3c9ed3ddd" },
        { url: "/_next/static/chunks/pages/sdl-builder-7f8d9e6185c61875.js", revision: "7f8d9e6185c61875" },
        { url: "/_next/static/chunks/pages/settings-662f3e217d9baa20.js", revision: "662f3e217d9baa20" },
        { url: "/_next/static/chunks/pages/settings/authorizations-d922645679beb27f.js", revision: "d922645679beb27f" },
        { url: "/_next/static/chunks/pages/template/%5Bid%5D-3438b96b94bcf5eb.js", revision: "3438b96b94bcf5eb" },
        { url: "/_next/static/chunks/pages/templates-cfcbadde168aadff.js", revision: "cfcbadde168aadff" },
        { url: "/_next/static/chunks/pages/templates/%5BtemplateId%5D-ff490fadb2c3f6e4.js", revision: "ff490fadb2c3f6e4" },
        { url: "/_next/static/chunks/pages/terms-of-service-8092af12806d9644.js", revision: "8092af12806d9644" },
        { url: "/_next/static/chunks/pages/transactions-08d6df91026b2cc7.js", revision: "08d6df91026b2cc7" },
        { url: "/_next/static/chunks/pages/transactions/%5Bhash%5D-945f01f1c82f9be2.js", revision: "945f01f1c82f9be2" },
        { url: "/_next/static/chunks/pages/user/settings-6c8a3b489adcf89c.js", revision: "6c8a3b489adcf89c" },
        { url: "/_next/static/chunks/pages/user/settings/address-book-f47ba9c07692b9d4.js", revision: "f47ba9c07692b9d4" },
        { url: "/_next/static/chunks/pages/user/settings/favorites-ac885b7abd44d927.js", revision: "ac885b7abd44d927" },
        { url: "/_next/static/chunks/pages/validators-4d370a45c03a5aeb.js", revision: "4d370a45c03a5aeb" },
        { url: "/_next/static/chunks/pages/validators/%5Baddress%5D-ec04e9e6415e1e23.js", revision: "ec04e9e6415e1e23" },
        { url: "/_next/static/chunks/polyfills-c67a75d1b6f99dc8.js", revision: "837c0df77fd5009c9e46d446188ecfd0" },
        { url: "/_next/static/chunks/webpack-7c00bef40e5577ce.js", revision: "7c00bef40e5577ce" },
        { url: "/_next/static/css/60da0364ed65e94f.css", revision: "60da0364ed65e94f" },
        { url: "/_next/static/css/6bfa921e6cb2b44b.css", revision: "6bfa921e6cb2b44b" },
        { url: "/_next/static/css/92e074b97232c763.css", revision: "92e074b97232c763" },
        { url: "/android-chrome-192x192.png", revision: "67aea0e4bc700134b81b51e635a95144" },
        { url: "/android-chrome-256x256.png", revision: "b0dc3017fadbf0f4c323636535f582b7" },
        { url: "/apple-touch-icon.png", revision: "97f107fd40c94f768de409ffb68e2e73" },
        { url: "/browserconfig.xml", revision: "e41ebb6b49206a59d8eafce8220ebeac" },
        { url: "/favicon-16x16.png", revision: "5b31d0a554060dec7c59e86af2c3b47d" },
        { url: "/favicon-32x32.png", revision: "794696d75ba46e490df7a68d1309cb20" },
        { url: "/favicon.ico", revision: "c6fc431554c8de94be347a8180e562aa" },
        { url: "/images/akash-logo-dark.png", revision: "b1623e407dad710a4c0c73461bbb8bb3" },
        { url: "/images/akash-logo-flat-dark.png", revision: "50b4ad6438e791047d97da0af65b96f5" },
        { url: "/images/akash-logo-flat-light.png", revision: "2befec2d17a2b6a32b1a0517ca1baf01" },
        { url: "/images/akash-logo-light.png", revision: "0ea30905c72eda674ad74c65d0c062bf" },
        { url: "/images/akash-logo.svg", revision: "4a5f3eaf31bf0f88ff3baec6281c8de3" },
        { url: "/images/chains/akash.png", revision: "d0b3f8ccaa3b0d18ef4039f86edf4436" },
        { url: "/images/chains/atom.png", revision: "6e4d88ad2c295e811fee29cc89edfcb1" },
        { url: "/images/chains/evmos.png", revision: "487a456e9091dec9ddf18892531401f8" },
        { url: "/images/chains/huahua.png", revision: "f0ba8427522833bba44962e87e982412" },
        { url: "/images/chains/juno.png", revision: "933b7d992dc67fd2f0d0f35e182b3361" },
        { url: "/images/chains/kuji.png", revision: "9c31e679007e5ae16fc28e067d907f79" },
        { url: "/images/chains/osmo.png", revision: "6940c69c28e5d85d99ba498fc7e95a26" },
        { url: "/images/chains/scrt.png", revision: "0dd98be17447cf7c47d27153f534ca60" },
        { url: "/images/chains/stars.png", revision: "56d0bd40e52f010c7267eb78c53138f2" },
        { url: "/images/chains/strd.png", revision: "eebdfb53ba0bc9bba88b0bede7a44f6d" },
        { url: "/images/cloudmos-logo-light.png", revision: "a7423327e4280225e176da92c6176c28" },
        { url: "/images/cloudmos-logo-small.jpg", revision: "4b339b83e7dc396894537b83d794726d" },
        { url: "/images/cloudmos-logo.png", revision: "56d87e0230a0ad5dd745efd486a33a58" },
        { url: "/images/docker.png", revision: "fde0ed6a2add0ffabfbc5a7749fdfff2" },
        { url: "/images/keplr-logo.png", revision: "50397e4902a33a6045c0f23dfe5cb1bd" },
        { url: "/images/powered-by-akash-dark.svg", revision: "3ea920f030ede7926a02c2dc17e332c4" },
        { url: "/images/powered-by-akash.svg", revision: "24b2566094fafded6c325246fe84c2a9" },
        { url: "/images/ubuntu.png", revision: "c631b8fae270a618c1fe1c9d43097189" },
        { url: "/images/wallet-connect-logo.png", revision: "8379e4d4e7267b47a0b5b89807a4d8f8" },
        { url: "/manifest.json", revision: "c2dfab0494ea8373287634bcf6da2233" },
        { url: "/mstile-150x150.png", revision: "4639e24da644e14af4e4daba3dd7af08" },
        { url: "/robots.txt", revision: "c2bb774b8071c957d2b835beaa28a58b" },
        { url: "/safari-pinned-tab.svg", revision: "a0fde4130c84e0d723dde3ece4a14fa8" }
      ],
      { ignoreURLParametersMatching: [] }
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      "/",
      new e.NetworkFirst({
        cacheName: "start-url",
        plugins: [
          {
            cacheWillUpdate: async ({ request: e, response: s, event: a, state: c }) =>
              s && "opaqueredirect" === s.type ? new Response(s.body, { status: 200, statusText: "OK", headers: s.headers }) : s
          }
        ]
      }),
      "GET"
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({ cacheName: "google-fonts-webfonts", plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 })] }),
      "GET"
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({ cacheName: "google-fonts-stylesheets", plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })] }),
      "GET"
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({ cacheName: "static-font-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 })] }),
      "GET"
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({ cacheName: "static-image-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })] }),
      "GET"
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({ cacheName: "next-image", plugins: [new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 })] }),
      "GET"
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: "static-audio-assets",
        plugins: [new e.RangeRequestsPlugin(), new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })]
      }),
      "GET"
    ),
    e.registerRoute(
      /\.(?:mp4)$/i,
      new e.CacheFirst({
        cacheName: "static-video-assets",
        plugins: [new e.RangeRequestsPlugin(), new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })]
      }),
      "GET"
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({ cacheName: "static-js-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET"
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({ cacheName: "static-style-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET"
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({ cacheName: "next-data", plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET"
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({ cacheName: "static-data-assets", plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET"
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        const s = e.pathname;
        return !s.startsWith("/api/auth/") && !!s.startsWith("/api/");
      },
      new e.NetworkFirst({ cacheName: "apis", networkTimeoutSeconds: 10, plugins: [new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 })] }),
      "GET"
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        return !e.pathname.startsWith("/api/");
      },
      new e.NetworkFirst({ cacheName: "others", networkTimeoutSeconds: 10, plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 })] }),
      "GET"
    ),
    e.registerRoute(
      ({ url: e }) => !(self.origin === e.origin),
      new e.NetworkFirst({ cacheName: "cross-origin", networkTimeoutSeconds: 10, plugins: [new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 })] }),
      "GET"
    );
});
