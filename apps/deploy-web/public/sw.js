if (!self.define) {
  let e,
    a = {};
  const s = (s, c) => (
    (s = new URL(s + ".js", c).href),
    a[s] ||
      new Promise(a => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = s), (e.onload = a), document.head.appendChild(e);
        } else (e = s), importScripts(s), a();
      }).then(() => {
        let e = a[s];
        if (!e) throw new Error(`Module ${s} didn’t register its module`);
        return e;
      })
  );
  self.define = (c, i) => {
    const n = e || ("document" in self ? document.currentScript.src : "") || location.href;
    if (a[n]) return;
    let t = {};
    const d = e => s(e, n),
      r = { module: { uri: n }, exports: t, require: d };
    a[n] = Promise.all(c.map(e => r[e] || d(e))).then(e => (i(...e), t));
  };
}
define(["./workbox-495fd258"], function (e) {
  "use strict";
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        { url: "/_next/static/chunks/1189.4cc1e5c1defa42f3.js", revision: "4cc1e5c1defa42f3" },
        { url: "/_next/static/chunks/1189.4cc1e5c1defa42f3.js.map", revision: "d4ad4c5c22a1c08ec27ca71b306bf6a1" },
        { url: "/_next/static/chunks/1199.401caaa57d9d4991.js", revision: "401caaa57d9d4991" },
        { url: "/_next/static/chunks/1199.401caaa57d9d4991.js.map", revision: "e04d19e0101489c55b7708494343fb01" },
        { url: "/_next/static/chunks/1307.a15b0a2ca8c1baba.js", revision: "a15b0a2ca8c1baba" },
        { url: "/_next/static/chunks/1307.a15b0a2ca8c1baba.js.map", revision: "28fca9b597c21e79e3b4d47e890e8c5d" },
        { url: "/_next/static/chunks/184-a0dcb30fd9a71519.js", revision: "a0dcb30fd9a71519" },
        { url: "/_next/static/chunks/184-a0dcb30fd9a71519.js.map", revision: "a305fdaa50d4e9506f90da8c0e99575f" },
        { url: "/_next/static/chunks/2378-9690268277788e4e.js", revision: "9690268277788e4e" },
        { url: "/_next/static/chunks/2378-9690268277788e4e.js.map", revision: "de8e669cba1b9816cc4f1e25bf5c9f8f" },
        { url: "/_next/static/chunks/2512-c6706dca2e2880bc.js", revision: "c6706dca2e2880bc" },
        { url: "/_next/static/chunks/2512-c6706dca2e2880bc.js.map", revision: "32d8dcf1f5ade6fe8f2c2204a265c513" },
        { url: "/_next/static/chunks/2615.4481cc52103060f3.js", revision: "4481cc52103060f3" },
        { url: "/_next/static/chunks/2615.4481cc52103060f3.js.map", revision: "8b13b3b9900754afd6ce0ca5ce691a1a" },
        { url: "/_next/static/chunks/2789-8c5ae4a7f03ecdd5.js", revision: "8c5ae4a7f03ecdd5" },
        { url: "/_next/static/chunks/2789-8c5ae4a7f03ecdd5.js.map", revision: "26697be5568324eac6eddccf042b6bc2" },
        { url: "/_next/static/chunks/2795.a1b0354a57818b24.js", revision: "a1b0354a57818b24" },
        { url: "/_next/static/chunks/2795.a1b0354a57818b24.js.map", revision: "04d7216115364ea242b09b5c38d10ebb" },
        { url: "/_next/static/chunks/2928.759e82731196c204.js", revision: "759e82731196c204" },
        { url: "/_next/static/chunks/2928.759e82731196c204.js.map", revision: "a96d728c77c3ac01591c796fdcb74e00" },
        { url: "/_next/static/chunks/3067-a2f70e094d040c7b.js", revision: "a2f70e094d040c7b" },
        { url: "/_next/static/chunks/3067-a2f70e094d040c7b.js.map", revision: "b6d7b8543fcc7ac19ef4696ff773d3d0" },
        { url: "/_next/static/chunks/3073-37ee469472b5b611.js", revision: "37ee469472b5b611" },
        { url: "/_next/static/chunks/3073-37ee469472b5b611.js.map", revision: "1e7d9db2924f8aa752647f6da96be927" },
        { url: "/_next/static/chunks/3222-a19faf630a48d3f2.js", revision: "a19faf630a48d3f2" },
        { url: "/_next/static/chunks/3222-a19faf630a48d3f2.js.map", revision: "38451bcfbead6dc38f4d5e3ffe4c1531" },
        { url: "/_next/static/chunks/3368-123494add0d16288.js", revision: "123494add0d16288" },
        { url: "/_next/static/chunks/3368-123494add0d16288.js.map", revision: "de8af8df2c82f045bf2f804668c3bc54" },
        { url: "/_next/static/chunks/4030-4841b28b09e398ea.js", revision: "4841b28b09e398ea" },
        { url: "/_next/static/chunks/4030-4841b28b09e398ea.js.map", revision: "442d0ec397bef7ffc759fd63a57f92c2" },
        { url: "/_next/static/chunks/4233-e59078209d135673.js", revision: "e59078209d135673" },
        { url: "/_next/static/chunks/4233-e59078209d135673.js.map", revision: "1cd4ef7b0480bbf529399e1e06239dde" },
        { url: "/_next/static/chunks/4303-e55c0574fcbbdac1.js", revision: "e55c0574fcbbdac1" },
        { url: "/_next/static/chunks/4303-e55c0574fcbbdac1.js.map", revision: "ed0f2f8ab4569fb3dfa20ca38632207c" },
        { url: "/_next/static/chunks/4564-f7775633e4ddd20d.js", revision: "f7775633e4ddd20d" },
        { url: "/_next/static/chunks/4564-f7775633e4ddd20d.js.map", revision: "a740b40f67165c6a00ee3e0fcfd5cf5f" },
        { url: "/_next/static/chunks/4618-e104b9ddf333b31e.js", revision: "e104b9ddf333b31e" },
        { url: "/_next/static/chunks/4618-e104b9ddf333b31e.js.map", revision: "190c5bc44565b7a0dc49f493ad95491d" },
        { url: "/_next/static/chunks/4961.283e96995a34404c.js", revision: "283e96995a34404c" },
        { url: "/_next/static/chunks/4961.283e96995a34404c.js.map", revision: "0ff487797ceed32d7903dd831c3e0230" },
        { url: "/_next/static/chunks/5254.6093f161d04dd68b.js", revision: "6093f161d04dd68b" },
        { url: "/_next/static/chunks/5254.6093f161d04dd68b.js.map", revision: "ca2b9961f101fd21c18d0834b779070d" },
        { url: "/_next/static/chunks/56-fee085b138ed3193.js", revision: "fee085b138ed3193" },
        { url: "/_next/static/chunks/56-fee085b138ed3193.js.map", revision: "c2796215e0784dbd470c86f3b185c79f" },
        { url: "/_next/static/chunks/5696-e24c1394dac3ef28.js", revision: "e24c1394dac3ef28" },
        { url: "/_next/static/chunks/5696-e24c1394dac3ef28.js.map", revision: "9acbbfd564729ccffdbb0f144eb680a8" },
        { url: "/_next/static/chunks/6146-139bcdc0621f1416.js", revision: "139bcdc0621f1416" },
        { url: "/_next/static/chunks/6146-139bcdc0621f1416.js.map", revision: "c93ca976476bf53e8e68b7fb0a2365c4" },
        { url: "/_next/static/chunks/6248-2892c8acfdc66c7f.js", revision: "2892c8acfdc66c7f" },
        { url: "/_next/static/chunks/6248-2892c8acfdc66c7f.js.map", revision: "702c52c9e5e4a9ff58dbe9dc89649d8e" },
        { url: "/_next/static/chunks/6424.419a6cf980d6d2db.js", revision: "419a6cf980d6d2db" },
        { url: "/_next/static/chunks/6424.419a6cf980d6d2db.js.map", revision: "cce829f16095a0ac2e32cb614ba9d2da" },
        { url: "/_next/static/chunks/6472-4908fe711699aa97.js", revision: "4908fe711699aa97" },
        { url: "/_next/static/chunks/6472-4908fe711699aa97.js.map", revision: "ac62f9716018011d1823a4c5bd0ccbe1" },
        { url: "/_next/static/chunks/6511-1dc4e829f46ef33a.js", revision: "1dc4e829f46ef33a" },
        { url: "/_next/static/chunks/6511-1dc4e829f46ef33a.js.map", revision: "ba411b03c4789d830dc2874dac2f1ec6" },
        { url: "/_next/static/chunks/6dd150ba.64b5afd105402a95.js", revision: "64b5afd105402a95" },
        { url: "/_next/static/chunks/6dd150ba.64b5afd105402a95.js.map", revision: "1384f4b07003004abdcc5fa87d28fce2" },
        { url: "/_next/static/chunks/7015.3885dc88d4407107.js", revision: "3885dc88d4407107" },
        { url: "/_next/static/chunks/7015.3885dc88d4407107.js.map", revision: "0de30b6b9c26584094b594dabd9ab90a" },
        { url: "/_next/static/chunks/7084-3a1ace24c2814a81.js", revision: "3a1ace24c2814a81" },
        { url: "/_next/static/chunks/7084-3a1ace24c2814a81.js.map", revision: "fb129cbce6b3d72c73f393aa5111875b" },
        { url: "/_next/static/chunks/7313-b4113e09897c0d46.js", revision: "b4113e09897c0d46" },
        { url: "/_next/static/chunks/7313-b4113e09897c0d46.js.map", revision: "0fdb4b25f6ebb0a35acfac1ae6065ac9" },
        { url: "/_next/static/chunks/7391-3b03e12d8cc9392e.js", revision: "3b03e12d8cc9392e" },
        { url: "/_next/static/chunks/7391-3b03e12d8cc9392e.js.map", revision: "07b6be9f2c65d3813b4e55de8bb0db66" },
        { url: "/_next/static/chunks/7395-16d289c87f0a234d.js", revision: "16d289c87f0a234d" },
        { url: "/_next/static/chunks/7395-16d289c87f0a234d.js.map", revision: "d22fbeedac5dfa4b81bb8709e5ddb471" },
        { url: "/_next/static/chunks/8018.cab678ee1aca3d32.js", revision: "cab678ee1aca3d32" },
        { url: "/_next/static/chunks/8018.cab678ee1aca3d32.js.map", revision: "a273e37806d3a9d45264b23ece984fe7" },
        { url: "/_next/static/chunks/8040-134cc48052ac553e.js", revision: "134cc48052ac553e" },
        { url: "/_next/static/chunks/8040-134cc48052ac553e.js.map", revision: "b82f9d071f8bf80b018c763bf54765e4" },
        { url: "/_next/static/chunks/8211-6a48ab0976eff8c6.js", revision: "6a48ab0976eff8c6" },
        { url: "/_next/static/chunks/8262-b7369bd4d5235239.js", revision: "b7369bd4d5235239" },
        { url: "/_next/static/chunks/8262-b7369bd4d5235239.js.map", revision: "570a82d1891b303ec1744e2761fa57a5" },
        { url: "/_next/static/chunks/8761-5bd8b3a2d171fa04.js", revision: "5bd8b3a2d171fa04" },
        { url: "/_next/static/chunks/8761-5bd8b3a2d171fa04.js.map", revision: "d413717d304e074d2eae241ae068a7d6" },
        { url: "/_next/static/chunks/9234-0cd8a00ac208350c.js", revision: "0cd8a00ac208350c" },
        { url: "/_next/static/chunks/9234-0cd8a00ac208350c.js.map", revision: "f88d4a0b5122f984a25b2f5afa5d1425" },
        { url: "/_next/static/chunks/9433.1c26005fc22a413a.js", revision: "1c26005fc22a413a" },
        { url: "/_next/static/chunks/9433.1c26005fc22a413a.js.map", revision: "0d5071d2aef4475c58c0fc2da4dc4ee6" },
        { url: "/_next/static/chunks/9526.72a7fd0a7db3a900.js", revision: "72a7fd0a7db3a900" },
        { url: "/_next/static/chunks/9526.72a7fd0a7db3a900.js.map", revision: "2fd8734aad63e007820c211118a95a37" },
        { url: "/_next/static/chunks/9534-ba622db4c1880bbd.js", revision: "ba622db4c1880bbd" },
        { url: "/_next/static/chunks/9534-ba622db4c1880bbd.js.map", revision: "5663b5e737fa1a96abd0baff301f0b4c" },
        { url: "/_next/static/chunks/framework-99dec70ef454ab76.js", revision: "99dec70ef454ab76" },
        { url: "/_next/static/chunks/framework-99dec70ef454ab76.js.map", revision: "4c3a8d793149d3b9af2a485e72cfbf0d" },
        { url: "/_next/static/chunks/main-db288b29bf8f46d2.js", revision: "db288b29bf8f46d2" },
        { url: "/_next/static/chunks/main-db288b29bf8f46d2.js.map", revision: "48cf57f003d17c01e1fced47c014a767" },
        { url: "/_next/static/chunks/pages/404-bebbb0d68eda3e15.js", revision: "bebbb0d68eda3e15" },
        { url: "/_next/static/chunks/pages/404-bebbb0d68eda3e15.js.map", revision: "5aae7df9a774aff4a8a44107be12221b" },
        { url: "/_next/static/chunks/pages/500-6f8b90ae4476f90a.js", revision: "6f8b90ae4476f90a" },
        { url: "/_next/static/chunks/pages/500-6f8b90ae4476f90a.js.map", revision: "516938999f7989354374741f2d988e0d" },
        { url: "/_next/static/chunks/pages/_error-6b1cb0736ef8259c.js", revision: "6b1cb0736ef8259c" },
        { url: "/_next/static/chunks/pages/_error-6b1cb0736ef8259c.js.map", revision: "de40a202877514a43e968156490330ae" },
        { url: "/_next/static/chunks/pages/alerts-498f39fab399005d.js", revision: "498f39fab399005d" },
        { url: "/_next/static/chunks/pages/alerts-498f39fab399005d.js.map", revision: "193ba51f796497f333273b990d6fca75" },
        { url: "/_next/static/chunks/pages/alerts/contact-points-2b3d8d27e9323292.js", revision: "2b3d8d27e9323292" },
        { url: "/_next/static/chunks/pages/alerts/contact-points-2b3d8d27e9323292.js.map", revision: "5d51559bda31a997a59c128b46232b02" },
        { url: "/_next/static/chunks/pages/alerts/contact-points/%5Bid%5D-f8845158bf4e1859.js", revision: "f8845158bf4e1859" },
        { url: "/_next/static/chunks/pages/alerts/contact-points/%5Bid%5D-f8845158bf4e1859.js.map", revision: "354627c8f65f2b43dbd309387769fec8" },
        { url: "/_next/static/chunks/pages/alerts/contact-points/new-85c81f96d7c13db3.js", revision: "85c81f96d7c13db3" },
        { url: "/_next/static/chunks/pages/alerts/contact-points/new-85c81f96d7c13db3.js.map", revision: "1e29683add34bccc8a1c324ef3eae622" },
        { url: "/_next/static/chunks/pages/contact-29d7e60c2b9a392d.js", revision: "29d7e60c2b9a392d" },
        { url: "/_next/static/chunks/pages/contact-29d7e60c2b9a392d.js.map", revision: "6a0f8333d7058e1aa66c364fa2ba519c" },
        { url: "/_next/static/chunks/pages/deploy-linux-d37f04ecbce2b9f7.js", revision: "d37f04ecbce2b9f7" },
        { url: "/_next/static/chunks/pages/deploy-linux-d37f04ecbce2b9f7.js.map", revision: "8a7cf52b712c80901f0c790f9f427ef7" },
        { url: "/_next/static/chunks/pages/deployments-adde99f58d0ae5bc.js", revision: "adde99f58d0ae5bc" },
        { url: "/_next/static/chunks/pages/deployments-adde99f58d0ae5bc.js.map", revision: "20eb9df55c2fbfcf86d2fdb0672ed3c3" },
        { url: "/_next/static/chunks/pages/deployments/%5Bdseq%5D-2d7ce2e2176a3a23.js", revision: "2d7ce2e2176a3a23" },
        { url: "/_next/static/chunks/pages/deployments/%5Bdseq%5D-2d7ce2e2176a3a23.js.map", revision: "ea6fa05cdc9eeb2ef6e3a69778298e50" },
        { url: "/_next/static/chunks/pages/faq-63ee435e75ec87fa.js", revision: "63ee435e75ec87fa" },
        { url: "/_next/static/chunks/pages/faq-63ee435e75ec87fa.js.map", revision: "6a072200c56ead4b401cc6977f03ac01" },
        { url: "/_next/static/chunks/pages/get-started-09deb9d3ce5d0d2b.js", revision: "09deb9d3ce5d0d2b" },
        { url: "/_next/static/chunks/pages/get-started-09deb9d3ce5d0d2b.js.map", revision: "8f962bed4de1c84d7f8f3c1951838db9" },
        { url: "/_next/static/chunks/pages/get-started/wallet-05189918904d238d.js", revision: "05189918904d238d" },
        { url: "/_next/static/chunks/pages/get-started/wallet-05189918904d238d.js.map", revision: "97fedc785f7b0af7c6563ade1d001b1d" },
        { url: "/_next/static/chunks/pages/index-0b5c116146ad0817.js", revision: "0b5c116146ad0817" },
        { url: "/_next/static/chunks/pages/index-0b5c116146ad0817.js.map", revision: "4b81b943a8c96e498a51c3d953d44122" },
        { url: "/_next/static/chunks/pages/maintenance-a693163f856242b5.js", revision: "a693163f856242b5" },
        { url: "/_next/static/chunks/pages/maintenance-a693163f856242b5.js.map", revision: "7ad2c9271d8802c15293cbc96f1506ab" },
        { url: "/_next/static/chunks/pages/new-deployment-242ae7109ca2e1d0.js", revision: "242ae7109ca2e1d0" },
        { url: "/_next/static/chunks/pages/new-deployment-242ae7109ca2e1d0.js.map", revision: "b7fab96648f772a4ffdd01021bd4030b" },
        { url: "/_next/static/chunks/pages/privacy-policy-1fa6455ee99aa1c4.js", revision: "1fa6455ee99aa1c4" },
        { url: "/_next/static/chunks/pages/privacy-policy-1fa6455ee99aa1c4.js.map", revision: "d2c42b60a59be5f6a14bc13423bd5190" },
        { url: "/_next/static/chunks/pages/profile/%5Busername%5D-10bdac3ca380b27c.js", revision: "10bdac3ca380b27c" },
        { url: "/_next/static/chunks/pages/profile/%5Busername%5D-10bdac3ca380b27c.js.map", revision: "eee29701904578465f4c45475a9a5190" },
        { url: "/_next/static/chunks/pages/providers-ad72359b9010b99d.js", revision: "ad72359b9010b99d" },
        { url: "/_next/static/chunks/pages/providers-ad72359b9010b99d.js.map", revision: "808e4aa1175942313d82f1889d441773" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D-9f30d40e0648817c.js", revision: "9f30d40e0648817c" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D-9f30d40e0648817c.js.map", revision: "78f378c80370b76b1a4f86dc9db471f2" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/edit-21b92e5979715a7e.js", revision: "21b92e5979715a7e" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/edit-21b92e5979715a7e.js.map", revision: "6349e71d62ba76dfece52fc8a6bd35e6" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/leases-479a9407930480d2.js", revision: "479a9407930480d2" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/leases-479a9407930480d2.js.map", revision: "c452b91a4584403166465d1777c673a5" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/raw-dfcc13154b3bfed1.js", revision: "dfcc13154b3bfed1" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/raw-dfcc13154b3bfed1.js.map", revision: "1950d4093d19920d83aff359ea93fdb6" },
        { url: "/_next/static/chunks/pages/rent-gpu-bc5f293084b424a3.js", revision: "bc5f293084b424a3" },
        { url: "/_next/static/chunks/pages/rent-gpu-bc5f293084b424a3.js.map", revision: "3b96ee1e87346d63b5ad68817eda60ea" },
        { url: "/_next/static/chunks/pages/sdl-builder-f49dfde549458892.js", revision: "f49dfde549458892" },
        { url: "/_next/static/chunks/pages/sdl-builder-f49dfde549458892.js.map", revision: "bc3927ad0b6264b6caa1dc7835477e6a" },
        { url: "/_next/static/chunks/pages/settings-229cd9b651b30bde.js", revision: "229cd9b651b30bde" },
        { url: "/_next/static/chunks/pages/settings-229cd9b651b30bde.js.map", revision: "cccf801ea7ad81cc65c55081e74fe7b1" },
        { url: "/_next/static/chunks/pages/settings/authorizations-4071ef23924531df.js", revision: "4071ef23924531df" },
        { url: "/_next/static/chunks/pages/settings/authorizations-4071ef23924531df.js.map", revision: "e185afd8af2469de1488a3a0b203aed0" },
        { url: "/_next/static/chunks/pages/template/%5Bid%5D-22cc064346a7235f.js", revision: "22cc064346a7235f" },
        { url: "/_next/static/chunks/pages/template/%5Bid%5D-22cc064346a7235f.js.map", revision: "bc23df7da22d6733e18725b9186f78d4" },
        { url: "/_next/static/chunks/pages/templates-ca6a5f0ef018eb5a.js", revision: "ca6a5f0ef018eb5a" },
        { url: "/_next/static/chunks/pages/templates-ca6a5f0ef018eb5a.js.map", revision: "07cea08691166b4babcca811e5297d63" },
        { url: "/_next/static/chunks/pages/templates/%5BtemplateId%5D-e80e983370be1aa8.js", revision: "e80e983370be1aa8" },
        { url: "/_next/static/chunks/pages/templates/%5BtemplateId%5D-e80e983370be1aa8.js.map", revision: "5ae2aedebc4b83f9ab5a2fbbe0f90793" },
        { url: "/_next/static/chunks/pages/terms-of-service-d6928a97556c58d4.js", revision: "d6928a97556c58d4" },
        { url: "/_next/static/chunks/pages/terms-of-service-d6928a97556c58d4.js.map", revision: "9889048fe427a62979128e8306ed59a9" },
        { url: "/_next/static/chunks/pages/user/api-keys-f6af8ab97ecc72f9.js", revision: "f6af8ab97ecc72f9" },
        { url: "/_next/static/chunks/pages/user/api-keys-f6af8ab97ecc72f9.js.map", revision: "618f72582b48c0e25402db2225d9ad65" },
        { url: "/_next/static/chunks/pages/user/settings-d8a2fe768c41559c.js", revision: "d8a2fe768c41559c" },
        { url: "/_next/static/chunks/pages/user/settings-d8a2fe768c41559c.js.map", revision: "46d8c5a7d2cdd2897195c373f0388e17" },
        { url: "/_next/static/chunks/pages/user/settings/favorites-30fcf51d88c0e020.js", revision: "30fcf51d88c0e020" },
        { url: "/_next/static/chunks/pages/user/settings/favorites-30fcf51d88c0e020.js.map", revision: "dfd3805218e41f3d9f2919c53642d4f3" },
        { url: "/_next/static/chunks/polyfills-42372ed130431b0a.js", revision: "846118c33b2c0e922d7b3a7676f81f6f" },
        { url: "/_next/static/chunks/webpack-334f6490714521dc.js", revision: "334f6490714521dc" },
        { url: "/_next/static/chunks/webpack-334f6490714521dc.js.map", revision: "c49133dd312b09ec838a8eb61eb9bd6a" },
        { url: "/_next/static/css/60da0364ed65e94f.css", revision: "60da0364ed65e94f" },
        { url: "/_next/static/css/60da0364ed65e94f.css.map", revision: "7ebdaca80e1b94a3afdc509e9729e2f4" },
        { url: "/_next/static/css/749d99a25fbe342e.css", revision: "749d99a25fbe342e" },
        { url: "/_next/static/css/85fa6dafca566008.css", revision: "85fa6dafca566008" },
        { url: "/_next/static/css/85fa6dafca566008.css.map", revision: "e1c00d68c2a092625defb4c86bdb56ae" },
        { url: "/_next/static/iiIxbyP38cXgEV64fpqno/_buildManifest.js", revision: "c122d6b282d36891765e6f22336c560d" },
        { url: "/_next/static/iiIxbyP38cXgEV64fpqno/_ssgManifest.js", revision: "b6652df95db52feb4daf4eca35380933" },
        { url: "/_next/static/media/e11418ac562b8ac1-s.p.woff2", revision: "0e46e732cced180e3a2c7285100f27d4" },
        { url: "/akash-console.png", revision: "4ab11b341159b007fc63d28631e0a8d8" },
        { url: "/android-chrome-192x192.png", revision: "a2eeed7b0d4a8c9bd9fa014378ac733e" },
        { url: "/android-chrome-256x256.png", revision: "b0dc3017fadbf0f4c323636535f582b7" },
        { url: "/android-chrome-384x384.png", revision: "3fae18e8537ff0745221e5aec66c247b" },
        { url: "/apple-touch-icon.png", revision: "43451e961475b8323dcfb705fb6eb480" },
        { url: "/browserconfig.xml", revision: "389eabe3c9a90736f426109c84458455" },
        { url: "/favicon-16x16.png", revision: "8cf7a2775f6f6d6db07b95197538b11b" },
        { url: "/favicon-32x32.png", revision: "bef7d8e9aaed7fb3ef49cbffa31b5339" },
        { url: "/favicon.ico", revision: "cfebc107c597696c596a277239546a86" },
        { url: "/images/akash-logo-dark.png", revision: "b1623e407dad710a4c0c73461bbb8bb3" },
        { url: "/images/akash-logo-flat-dark.png", revision: "50b4ad6438e791047d97da0af65b96f5" },
        { url: "/images/akash-logo-flat-light.png", revision: "2befec2d17a2b6a32b1a0517ca1baf01" },
        { url: "/images/akash-logo-light.png", revision: "0ea30905c72eda674ad74c65d0c062bf" },
        { url: "/images/akash-logo.svg", revision: "be6715fe32a9ad342a59c397f2e455c0" },
        { url: "/images/astrojs-dark.svg", revision: "4c4b105fc84b17a4d87e68bfdc55e3ab" },
        { url: "/images/astrojs.png", revision: "d8ec9f8ea0900dad8580f36e736c634c" },
        { url: "/images/bitbucket.png", revision: "daa68702b9a158395612f22d335dd840" },
        { url: "/images/centos.png", revision: "88b7a6af2891ccc00da9efe1b0d179cd" },
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
        { url: "/images/debian.png", revision: "f5681eb06429a63043aca072e808fd88" },
        { url: "/images/docker-logo.png", revision: "46de64ac6f5af30c1f5027879aff6dac" },
        { url: "/images/docker.png", revision: "fde0ed6a2add0ffabfbc5a7749fdfff2" },
        { url: "/images/faq/change-node.png", revision: "9421f6443f6c4397887035e50d8c9b24" },
        { url: "/images/faq/update-deployment-btn.png", revision: "ebc7f6907a08fdf6a6cd5a87043456fd" },
        { url: "/images/github-dark.svg", revision: "c232da362c916f9cf897f2f0510893dd" },
        { url: "/images/github.png", revision: "ec3a60c8c6539a07eb70b52f6737ea6e" },
        { url: "/images/gitlab.png", revision: "adfb04366f210c635b3a7a3c01fda6e6" },
        { url: "/images/keplr-logo.png", revision: "50397e4902a33a6045c0f23dfe5cb1bd" },
        { url: "/images/leap-cosmos-logo.png", revision: "a54ced7748b33565e6dc1ea1c5b1ef52" },
        { url: "/images/nextjs-dark.svg", revision: "f0595620019d5b2a41c65b9319043713" },
        { url: "/images/nextjs.png", revision: "72b1223bacf4295fd2586723a7956cd0" },
        { url: "/images/powered-by-akash-dark.svg", revision: "2a5c50d964ae8578b76af3829e25e9be" },
        { url: "/images/powered-by-akash.svg", revision: "a8d720b6750092d5e4696a4e1a06859b" },
        { url: "/images/python.png", revision: "8754901c3d116a3f812496b413b4629f" },
        { url: "/images/suse.png", revision: "0e932edaef4f9c03e7eb7b8c95e6432b" },
        { url: "/images/ubuntu.png", revision: "c631b8fae270a618c1fe1c9d43097189" },
        { url: "/images/vm.png", revision: "e444648239e2ad69af2a9d3200078c75" },
        { url: "/images/vuejs.png", revision: "563192a9c36e1070eddd1c527b2cf591" },
        { url: "/images/wallet-connect-logo.png", revision: "8379e4d4e7267b47a0b5b89807a4d8f8" },
        { url: "/manifest.json", revision: "4a732064e6d7a78ecf707d7d7fa8b17e" },
        { url: "/mstile-150x150.png", revision: "17614fed638be1d5e2225b9d5419336a" },
        { url: "/robots.txt", revision: "f221cfd87bacaa726943e34b2629c37f" },
        { url: "/safari-pinned-tab.svg", revision: "c51530560c75152b849bb467e50a8b76" }
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
            cacheWillUpdate: async ({ request: e, response: a, event: s, state: c }) =>
              a && "opaqueredirect" === a.type ? new Response(a.body, { status: 200, statusText: "OK", headers: a.headers }) : a
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
        const a = e.pathname;
        return !a.startsWith("/api/auth/") && !!a.startsWith("/api/");
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
//# sourceMappingURL=sw.js.map
