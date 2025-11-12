"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PageHead = void 0;
var react_1 = require("react");
var head_1 = require("next/head");
var next_seo_1 = require("next-seo");
var PageHead = function (_a) {
    var pageSeo = _a.pageSeo;
    return (<>
      <head_1.default>
        <meta charSet="utf-8"/>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width, shrink-to-fit=no"/>
        <link rel="icon" href="/favicon.ico"/>
      </head_1.default>

      <next_seo_1.DefaultSeo titleTemplate="%s | Akash Console" defaultTitle="Akash Console" description="Akash Console is the #1 platform to deploy docker containers on the Akash Network, a decentralized super cloud compute marketplace. Explore, deploy and track all in one place!" openGraph={{
            type: "website",
            locale: "en_US",
            url: "https://console.akash.network/",
            site_name: "Akash Console",
            description: "Deploy docker containers on the decentralized supercloud Akash Network.",
            images: [
                {
                    url: "https://console.akash.network/akash-console.png",
                    width: 1200,
                    height: 630,
                    alt: "AkashConsole Cover Image"
                }
            ]
        }} twitter={{
            handle: "@akashnet",
            site: "@akashnet",
            cardType: "summary_large_image"
        }}/>

      <next_seo_1.NextSeo {...pageSeo}/>
    </>);
};
exports.PageHead = PageHead;
