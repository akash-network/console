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
        { url: "/_next/static/R_nEGF3Lf1Ie9PAgUt_sw/_buildManifest.js", revision: "fc44297939a39a4c7824a1572d14574c" },
        { url: "/_next/static/R_nEGF3Lf1Ie9PAgUt_sw/_ssgManifest.js", revision: "b6652df95db52feb4daf4eca35380933" },
        { url: "/_next/static/chunks/1134-13a02a1fdea23a3c.js", revision: "13a02a1fdea23a3c" },
        { url: "/_next/static/chunks/1134-13a02a1fdea23a3c.js.map", revision: "9719beb73654bf54737c6b035ecf60ed" },
        { url: "/_next/static/chunks/1506-7250bcb71cf2b232.js", revision: "7250bcb71cf2b232" },
        { url: "/_next/static/chunks/1506-7250bcb71cf2b232.js.map", revision: "d2f34f3479037386268e8ef710f248eb" },
        { url: "/_next/static/chunks/1733-967d80b107f94464.js", revision: "967d80b107f94464" },
        { url: "/_next/static/chunks/1733-967d80b107f94464.js.map", revision: "e9a4bc10b41efa07541524b2c0ba3ec8" },
        { url: "/_next/static/chunks/1864-a108b3603800e036.js", revision: "a108b3603800e036" },
        { url: "/_next/static/chunks/1864-a108b3603800e036.js.map", revision: "d14040aca9a418d935a63df93187fb0c" },
        { url: "/_next/static/chunks/195-91d7714432a7def6.js", revision: "91d7714432a7def6" },
        { url: "/_next/static/chunks/195-91d7714432a7def6.js.map", revision: "e9ac1790e206fc604634c1176817e54e" },
        { url: "/_next/static/chunks/209-d01a23296b8ab6ce.js", revision: "d01a23296b8ab6ce" },
        { url: "/_next/static/chunks/209-d01a23296b8ab6ce.js.map", revision: "5ac4231f2518db0321e8b1042590a868" },
        { url: "/_next/static/chunks/214-b1b7d4853a71164c.js", revision: "b1b7d4853a71164c" },
        { url: "/_next/static/chunks/214-b1b7d4853a71164c.js.map", revision: "c0939a16ccfdd1d863b05ecc886dd022" },
        { url: "/_next/static/chunks/2674-72d9141ee61fa622.js", revision: "72d9141ee61fa622" },
        { url: "/_next/static/chunks/2674-72d9141ee61fa622.js.map", revision: "3c32c5ad19bb626530fb893892bd5a9e" },
        { url: "/_next/static/chunks/3399.541dcdc90f680900.js", revision: "541dcdc90f680900" },
        { url: "/_next/static/chunks/3399.541dcdc90f680900.js.map", revision: "966041ddc7a6a9d344f2ba0b4a651245" },
        { url: "/_next/static/chunks/3472-372f74135e232433.js", revision: "372f74135e232433" },
        { url: "/_next/static/chunks/3472-372f74135e232433.js.map", revision: "4c4c461c252fea58306e2f05469b3e12" },
        { url: "/_next/static/chunks/3475.95d3b6f40f79be74.js", revision: "95d3b6f40f79be74" },
        { url: "/_next/static/chunks/3475.95d3b6f40f79be74.js.map", revision: "fd1f7199cf202792cd4f421ce19e31d9" },
        { url: "/_next/static/chunks/3497-40a53cb2d32f79c3.js", revision: "40a53cb2d32f79c3" },
        { url: "/_next/static/chunks/3497-40a53cb2d32f79c3.js.map", revision: "61594bee11acdc4aa7dfbe882dc114b7" },
        { url: "/_next/static/chunks/3892-3d1c7a0c77bc235f.js", revision: "3d1c7a0c77bc235f" },
        { url: "/_next/static/chunks/3892-3d1c7a0c77bc235f.js.map", revision: "244d1bd6af72988378f9e9633ea61b4f" },
        { url: "/_next/static/chunks/4115.e3fa222662e344e4.js", revision: "e3fa222662e344e4" },
        { url: "/_next/static/chunks/4170-9b1c1a4e9271a3f7.js", revision: "9b1c1a4e9271a3f7" },
        { url: "/_next/static/chunks/4170-9b1c1a4e9271a3f7.js.map", revision: "1d7589ab6cc72b85e1ab9f8cecf0898a" },
        { url: "/_next/static/chunks/4390-2081cda34a68d9e7.js", revision: "2081cda34a68d9e7" },
        { url: "/_next/static/chunks/4390-2081cda34a68d9e7.js.map", revision: "b4d0d50caa4c7072b20a7065faaac58b" },
        { url: "/_next/static/chunks/4575.0759eddd319efbb0.js", revision: "0759eddd319efbb0" },
        { url: "/_next/static/chunks/4608.35d8215770873418.js", revision: "35d8215770873418" },
        { url: "/_next/static/chunks/4608.35d8215770873418.js.map", revision: "b8a1e2b664b0a57c2ffa4a3fa7c8defe" },
        { url: "/_next/static/chunks/4618-120bef75a638d862.js", revision: "120bef75a638d862" },
        { url: "/_next/static/chunks/4618-120bef75a638d862.js.map", revision: "7349a44603af045ed11a5cb5ea0aa426" },
        { url: "/_next/static/chunks/498aad35.e9a5b9b930d03a1f.js", revision: "e9a5b9b930d03a1f" },
        { url: "/_next/static/chunks/498aad35.e9a5b9b930d03a1f.js.map", revision: "5c8292c65a92157738a00427599d5b15" },
        { url: "/_next/static/chunks/5484-2351a95919600f60.js", revision: "2351a95919600f60" },
        { url: "/_next/static/chunks/5484-2351a95919600f60.js.map", revision: "f1aed795abaaf551ef21f88fc0da9ef9" },
        { url: "/_next/static/chunks/5527-65665747ded0f58e.js", revision: "65665747ded0f58e" },
        { url: "/_next/static/chunks/5527-65665747ded0f58e.js.map", revision: "2ca4fa68b121a4a9b04c06b4ddb416f9" },
        { url: "/_next/static/chunks/6033-9c44a241b58d3a8f.js", revision: "9c44a241b58d3a8f" },
        { url: "/_next/static/chunks/6033-9c44a241b58d3a8f.js.map", revision: "42d465376aa47afdd2bb3e010cae3d74" },
        { url: "/_next/static/chunks/6424.afd408d2a0a8aa78.js", revision: "afd408d2a0a8aa78" },
        { url: "/_next/static/chunks/6424.afd408d2a0a8aa78.js.map", revision: "06a1e277ef6809ad36ed4fde2d391baf" },
        { url: "/_next/static/chunks/6642-d87eab589bf96702.js", revision: "d87eab589bf96702" },
        { url: "/_next/static/chunks/6642-d87eab589bf96702.js.map", revision: "706b3ca5a7dc070e91901e0b8d68aca2" },
        { url: "/_next/static/chunks/6778.3bba413adb7edeb2.js", revision: "3bba413adb7edeb2" },
        { url: "/_next/static/chunks/6778.3bba413adb7edeb2.js.map", revision: "2f78b019643ba4feb0072b1b2e8a3ef6" },
        { url: "/_next/static/chunks/681-329e5c74af9f0129.js", revision: "329e5c74af9f0129" },
        { url: "/_next/static/chunks/681-329e5c74af9f0129.js.map", revision: "7b0e753270fa74ef24cb9e2e9ae9cdb9" },
        { url: "/_next/static/chunks/6dd150ba.ec75e8e489a567a9.js", revision: "ec75e8e489a567a9" },
        { url: "/_next/static/chunks/6dd150ba.ec75e8e489a567a9.js.map", revision: "0958db114513904932a656bdf3630b27" },
        { url: "/_next/static/chunks/728-15d517bd1ac27f06.js", revision: "15d517bd1ac27f06" },
        { url: "/_next/static/chunks/728-15d517bd1ac27f06.js.map", revision: "71e79aae3a8d1c85c20eb06e0dd70575" },
        { url: "/_next/static/chunks/73df1075.2e70a9c12ac853f9.js", revision: "2e70a9c12ac853f9" },
        { url: "/_next/static/chunks/73df1075.2e70a9c12ac853f9.js.map", revision: "a3e37b7394b10774c7f81fb29e80d4de" },
        { url: "/_next/static/chunks/7725.25f5b617aeedffb1.js", revision: "25f5b617aeedffb1" },
        { url: "/_next/static/chunks/7725.25f5b617aeedffb1.js.map", revision: "9fa49c8830e324f0702b631ca76ea28d" },
        { url: "/_next/static/chunks/7879-7ea4a95d1b25743b.js", revision: "7ea4a95d1b25743b" },
        { url: "/_next/static/chunks/7879-7ea4a95d1b25743b.js.map", revision: "51153394a2f2f96ba5156547f277ebbd" },
        { url: "/_next/static/chunks/7886-b894cd4bce364aa0.js", revision: "b894cd4bce364aa0" },
        { url: "/_next/static/chunks/7886-b894cd4bce364aa0.js.map", revision: "4642b816331c12a70e70a3c3c181a639" },
        { url: "/_next/static/chunks/8035-625fbd9446423e71.js", revision: "625fbd9446423e71" },
        { url: "/_next/static/chunks/8035-625fbd9446423e71.js.map", revision: "3522a72c1f431bc6fd9e54e6a3ce5d20" },
        { url: "/_next/static/chunks/8132-3ef09b0cbd451717.js", revision: "3ef09b0cbd451717" },
        { url: "/_next/static/chunks/8132-3ef09b0cbd451717.js.map", revision: "9eac85381a4a2e55d36c5a950015d39e" },
        { url: "/_next/static/chunks/87d427d2-4b3f96f2a3f4b743.js", revision: "4b3f96f2a3f4b743" },
        { url: "/_next/static/chunks/8871-7154bfb95f8bedf0.js", revision: "7154bfb95f8bedf0" },
        { url: "/_next/static/chunks/8871-7154bfb95f8bedf0.js.map", revision: "1a7f132fef6ba7b17faec9f9bc9588bf" },
        { url: "/_next/static/chunks/9040-118a78ba95d54199.js", revision: "118a78ba95d54199" },
        { url: "/_next/static/chunks/9040-118a78ba95d54199.js.map", revision: "8a7a819b869e9ecfd1c2cdcb6ac5f06e" },
        { url: "/_next/static/chunks/9081-72eead89c096ee8a.js", revision: "72eead89c096ee8a" },
        { url: "/_next/static/chunks/9081-72eead89c096ee8a.js.map", revision: "a0ce58d80e4c80599fb418c1f8bded79" },
        { url: "/_next/static/chunks/9213-677e82a11e5c49ce.js", revision: "677e82a11e5c49ce" },
        { url: "/_next/static/chunks/9213-677e82a11e5c49ce.js.map", revision: "0e28f32d321a70df871131f734227988" },
        { url: "/_next/static/chunks/9435.dca062938e5271af.js", revision: "dca062938e5271af" },
        { url: "/_next/static/chunks/9435.dca062938e5271af.js.map", revision: "72e0f5eaa204a8ec239976c95df9ecf5" },
        { url: "/_next/static/chunks/9441-2e06032724e252e1.js", revision: "2e06032724e252e1" },
        { url: "/_next/static/chunks/9441-2e06032724e252e1.js.map", revision: "6e29417e1d230103d9fe9ef1c1c0ab85" },
        { url: "/_next/static/chunks/9534-13d530c02b55e7fa.js", revision: "13d530c02b55e7fa" },
        { url: "/_next/static/chunks/9534-13d530c02b55e7fa.js.map", revision: "db50baa394f1781bfc6039d937009824" },
        { url: "/_next/static/chunks/9537.60d4517640e9053b.js", revision: "60d4517640e9053b" },
        { url: "/_next/static/chunks/9537.60d4517640e9053b.js.map", revision: "fc3f8329015248f9e72e2a07271453fe" },
        { url: "/_next/static/chunks/framework-8383bf789d61bcef.js", revision: "8383bf789d61bcef" },
        { url: "/_next/static/chunks/framework-8383bf789d61bcef.js.map", revision: "a115d423eec304cd979739160b33710b" },
        { url: "/_next/static/chunks/main-eb002066e9283b80.js", revision: "eb002066e9283b80" },
        { url: "/_next/static/chunks/main-eb002066e9283b80.js.map", revision: "4f0a6f355fd43e903da9a9de760b59b1" },
        { url: "/_next/static/chunks/pages/404-a98e4a53c47ebfb2.js", revision: "a98e4a53c47ebfb2" },
        { url: "/_next/static/chunks/pages/404-a98e4a53c47ebfb2.js.map", revision: "6e2bd7a886b2ffa058589a62f43627b7" },
        { url: "/_next/static/chunks/pages/500-a4d3162df1ed9b13.js", revision: "a4d3162df1ed9b13" },
        { url: "/_next/static/chunks/pages/500-a4d3162df1ed9b13.js.map", revision: "19a75217e2a45c2d1f22f2fa9a2a7826" },
        { url: "/_next/static/chunks/pages/_error-da9fc623e4bb32a7.js", revision: "da9fc623e4bb32a7" },
        { url: "/_next/static/chunks/pages/_error-da9fc623e4bb32a7.js.map", revision: "9e10de5cb70f4f6067abbd85cfb55851" },
        { url: "/_next/static/chunks/pages/contact-46bb996f7943d757.js", revision: "46bb996f7943d757" },
        { url: "/_next/static/chunks/pages/contact-46bb996f7943d757.js.map", revision: "a2b90e5e0003bcd3aa2d31e4cf52f498" },
        { url: "/_next/static/chunks/pages/deployments-3121457a3445d393.js", revision: "3121457a3445d393" },
        { url: "/_next/static/chunks/pages/deployments-3121457a3445d393.js.map", revision: "3d403a53b4b9d001a59b2c52b00728d9" },
        { url: "/_next/static/chunks/pages/deployments/%5Bdseq%5D-7abd86c2857363fd.js", revision: "7abd86c2857363fd" },
        { url: "/_next/static/chunks/pages/deployments/%5Bdseq%5D-7abd86c2857363fd.js.map", revision: "05140feb2b87875a226b8d3044ec5f0c" },
        { url: "/_next/static/chunks/pages/faq-831ae8b87605af70.js", revision: "831ae8b87605af70" },
        { url: "/_next/static/chunks/pages/faq-831ae8b87605af70.js.map", revision: "3db27b9f9ac08831fe912c32181b0213" },
        { url: "/_next/static/chunks/pages/get-started-4127cab23a5782e1.js", revision: "4127cab23a5782e1" },
        { url: "/_next/static/chunks/pages/get-started-4127cab23a5782e1.js.map", revision: "da8580ab8a843d739f117502f4575d05" },
        { url: "/_next/static/chunks/pages/get-started/wallet-0b52b668e101868f.js", revision: "0b52b668e101868f" },
        { url: "/_next/static/chunks/pages/get-started/wallet-0b52b668e101868f.js.map", revision: "70d03a6c4317fbeec3220d68d1418f08" },
        { url: "/_next/static/chunks/pages/index-c43eefe0eaf9da0d.js", revision: "c43eefe0eaf9da0d" },
        { url: "/_next/static/chunks/pages/index-c43eefe0eaf9da0d.js.map", revision: "5988026cda19c5e1298e44c59cff820a" },
        { url: "/_next/static/chunks/pages/maintenance-b749112dd60f53ab.js", revision: "b749112dd60f53ab" },
        { url: "/_next/static/chunks/pages/maintenance-b749112dd60f53ab.js.map", revision: "d53f643065c0c0413436353be2604c2d" },
        { url: "/_next/static/chunks/pages/new-deployment-b1d45bab9d28a315.js", revision: "b1d45bab9d28a315" },
        { url: "/_next/static/chunks/pages/new-deployment-b1d45bab9d28a315.js.map", revision: "c0a2b3fa87be6cc559e35ce93b3b85e6" },
        { url: "/_next/static/chunks/pages/privacy-policy-703358cceec4b9a0.js", revision: "703358cceec4b9a0" },
        { url: "/_next/static/chunks/pages/privacy-policy-703358cceec4b9a0.js.map", revision: "4945cab6026eefca82bf6ac75a29a580" },
        { url: "/_next/static/chunks/pages/profile/%5Busername%5D-95cace7752958de1.js", revision: "95cace7752958de1" },
        { url: "/_next/static/chunks/pages/profile/%5Busername%5D-95cace7752958de1.js.map", revision: "98a85520b40f3e93b9717482fe1dffb9" },
        { url: "/_next/static/chunks/pages/providers-027c8849c35392fa.js", revision: "027c8849c35392fa" },
        { url: "/_next/static/chunks/pages/providers-027c8849c35392fa.js.map", revision: "41e460b445c4368c10e90d7a94f152c1" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D-abb1e39c56db21cb.js", revision: "abb1e39c56db21cb" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D-abb1e39c56db21cb.js.map", revision: "44e8fc2b706b4e201cb95e99e060076a" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/edit-7f51e8d8ab904e99.js", revision: "7f51e8d8ab904e99" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/edit-7f51e8d8ab904e99.js.map", revision: "f03137cd6f1c00f8ae63114c8f10f329" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/leases-263cd95def0daa93.js", revision: "263cd95def0daa93" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/leases-263cd95def0daa93.js.map", revision: "69da6ae03a1e454723156c16bcf23139" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/raw-6a2be55fbd8c7c7f.js", revision: "6a2be55fbd8c7c7f" },
        { url: "/_next/static/chunks/pages/providers/%5Bowner%5D/raw-6a2be55fbd8c7c7f.js.map", revision: "f3ce7a4939b0d91905d19ff510625f53" },
        { url: "/_next/static/chunks/pages/rent-gpu-0c7a19ea0cbd1368.js", revision: "0c7a19ea0cbd1368" },
        { url: "/_next/static/chunks/pages/rent-gpu-0c7a19ea0cbd1368.js.map", revision: "7b00cb56f207938ea392c881ed33d990" },
        { url: "/_next/static/chunks/pages/sdl-builder-cd2283b9e2b7d9dd.js", revision: "cd2283b9e2b7d9dd" },
        { url: "/_next/static/chunks/pages/sdl-builder-cd2283b9e2b7d9dd.js.map", revision: "be579c8a17949ec96199a9bef355bf24" },
        { url: "/_next/static/chunks/pages/settings-0d69b99c970e1f73.js", revision: "0d69b99c970e1f73" },
        { url: "/_next/static/chunks/pages/settings-0d69b99c970e1f73.js.map", revision: "c2c90a2891d0edf8f445b1e6e11a6461" },
        { url: "/_next/static/chunks/pages/settings/authorizations-c7d77bcda8414908.js", revision: "c7d77bcda8414908" },
        { url: "/_next/static/chunks/pages/settings/authorizations-c7d77bcda8414908.js.map", revision: "6373f1e87b364782ef7cce8b72a01e93" },
        { url: "/_next/static/chunks/pages/template/%5Bid%5D-0929c78b978f23a5.js", revision: "0929c78b978f23a5" },
        { url: "/_next/static/chunks/pages/template/%5Bid%5D-0929c78b978f23a5.js.map", revision: "316a35771a3f24c8de6fb1ace19b4037" },
        { url: "/_next/static/chunks/pages/templates-310b48e435c2b35f.js", revision: "310b48e435c2b35f" },
        { url: "/_next/static/chunks/pages/templates-310b48e435c2b35f.js.map", revision: "1c17d4bd1e610427394403e00275c6fc" },
        { url: "/_next/static/chunks/pages/templates/%5BtemplateId%5D-a23db55931cb64b7.js", revision: "a23db55931cb64b7" },
        { url: "/_next/static/chunks/pages/templates/%5BtemplateId%5D-a23db55931cb64b7.js.map", revision: "526914237ec5c10b91acd99a141582bb" },
        { url: "/_next/static/chunks/pages/terms-of-service-7d77cd9c60cd4a5b.js", revision: "7d77cd9c60cd4a5b" },
        { url: "/_next/static/chunks/pages/terms-of-service-7d77cd9c60cd4a5b.js.map", revision: "811429cd02685c4c09a4e34fcf9cd7b7" },
        { url: "/_next/static/chunks/pages/user/settings-4efcf9c288035787.js", revision: "4efcf9c288035787" },
        { url: "/_next/static/chunks/pages/user/settings-4efcf9c288035787.js.map", revision: "54192c4d1fecf547885649e89a415bf9" },
        { url: "/_next/static/chunks/pages/user/settings/address-book-ed8b81904a39e621.js", revision: "ed8b81904a39e621" },
        { url: "/_next/static/chunks/pages/user/settings/address-book-ed8b81904a39e621.js.map", revision: "e2e51226a77ebf72979b61a5d5fd24c0" },
        { url: "/_next/static/chunks/pages/user/settings/favorites-4480a9a23738f665.js", revision: "4480a9a23738f665" },
        { url: "/_next/static/chunks/pages/user/settings/favorites-4480a9a23738f665.js.map", revision: "690a1dd13f51942543381bb841259805" },
        { url: "/_next/static/chunks/polyfills-78c92fac7aa8fdd8.js", revision: "79330112775102f91e1010318bae2bd3" },
        { url: "/_next/static/chunks/webpack-5f00cfa7e86723d0.js", revision: "5f00cfa7e86723d0" },
        { url: "/_next/static/chunks/webpack-5f00cfa7e86723d0.js.map", revision: "37460aef9cc78cc3b4adf073d2139e6b" },
        { url: "/_next/static/css/02c964ff7651c53a.css", revision: "02c964ff7651c53a" },
        { url: "/_next/static/css/60da0364ed65e94f.css", revision: "60da0364ed65e94f" },
        { url: "/_next/static/css/60da0364ed65e94f.css.map", revision: "7ebdaca80e1b94a3afdc509e9729e2f4" },
        { url: "/_next/static/css/85fa6dafca566008.css", revision: "85fa6dafca566008" },
        { url: "/_next/static/css/85fa6dafca566008.css.map", revision: "e1c00d68c2a092625defb4c86bdb56ae" },
        { url: "/_next/static/media/e11418ac562b8ac1-s.p.woff2", revision: "0e46e732cced180e3a2c7285100f27d4" },
        { url: "/akash-console.png", revision: "4ab11b341159b007fc63d28631e0a8d8" },
        { url: "/android-chrome-192x192.png", revision: "a2eeed7b0d4a8c9bd9fa014378ac733e" },
        { url: "/android-chrome-256x256.png", revision: "b0dc3017fadbf0f4c323636535f582b7" },
        { url: "/android-chrome-384x384.png", revision: "3fae18e8537ff0745221e5aec66c247b" },
        { url: "/apple-touch-icon.png", revision: "43451e961475b8323dcfb705fb6eb480" },
        { url: "/browserconfig.xml", revision: "e41ebb6b49206a59d8eafce8220ebeac" },
        { url: "/favicon-16x16.png", revision: "8cf7a2775f6f6d6db07b95197538b11b" },
        { url: "/favicon-32x32.png", revision: "bef7d8e9aaed7fb3ef49cbffa31b5339" },
        { url: "/favicon.ico", revision: "cfebc107c597696c596a277239546a86" },
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
        { url: "/images/faq/change-node.png", revision: "9421f6443f6c4397887035e50d8c9b24" },
        { url: "/images/faq/update-deployment-btn.png", revision: "ebc7f6907a08fdf6a6cd5a87043456fd" },
        { url: "/images/keplr-logo.png", revision: "50397e4902a33a6045c0f23dfe5cb1bd" },
        { url: "/images/leap-cosmos-logo.png", revision: "a54ced7748b33565e6dc1ea1c5b1ef52" },
        { url: "/images/powered-by-akash-dark.svg", revision: "3ea920f030ede7926a02c2dc17e332c4" },
        { url: "/images/powered-by-akash.svg", revision: "24b2566094fafded6c325246fe84c2a9" },
        { url: "/images/ubuntu.png", revision: "c631b8fae270a618c1fe1c9d43097189" },
        { url: "/images/wallet-connect-logo.png", revision: "8379e4d4e7267b47a0b5b89807a4d8f8" },
        { url: "/manifest.json", revision: "a030fca8a5c7b8e2e1b5d7614a8b74fa" },
        { url: "/mstile-150x150.png", revision: "17614fed638be1d5e2225b9d5419336a" },
        { url: "/robots.txt", revision: "c2bb774b8071c957d2b835beaa28a58b" },
        { url: "/safari-pinned-tab.svg", revision: "86b02210e078cb763098dfec594f4f04" }
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
