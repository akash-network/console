import { describe, expect, it } from "vitest";

import { detectInAppBrowser, UNNAMED_ANDROID_WEBVIEW } from "./detectInAppBrowser";

describe(detectInAppBrowser.name, () => {
  it.each([
    {
      browser: "X",
      platform: "Android",
      userAgent:
        "Mozilla/5.0 (Linux; Android 17; Pixel 8 Build/CP31.260623.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/151.0.7922.202 Mobile Safari/537.36 TwitterAndroid/12.28.0-alpha.01 (312280201-r-01) Pixel+8/17 (Google;Pixel+8;google;shiba_beta;0;;1;2015)"
    },
    {
      browser: "X",
      platform: "iOS",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Twitter for iPhone/10.60"
    },
    {
      browser: "Instagram",
      platform: "Android",
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 Instagram 346.0.0.34.98 Android (34/14; 420dpi; 1080x2400; Google; Pixel 8; shiba; shiba; en_US; 634108168)"
    },
    {
      browser: "Facebook",
      platform: "iOS",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5]"
    },
    {
      browser: "Facebook",
      platform: "Android",
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/470.0.0.37.109;]"
    },
    {
      browser: "LinkedIn",
      platform: "iOS",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1840"
    },
    {
      browser: "TikTok",
      platform: "iOS",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_34.5.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/en Region/US"
    },
    {
      browser: "Snapchat",
      platform: "iOS",
      userAgent:
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.10.0.40 (like Safari/8617.2.4.10.8, panda)"
    },
    {
      browser: "LINE",
      platform: "iOS",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.10.0"
    },
    {
      browser: UNNAMED_ANDROID_WEBVIEW,
      platform: "Android",
      userAgent:
        "Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.146 Mobile Safari/537.36"
    }
  ])("detects the $browser in-app browser on $platform", ({ browser, userAgent }) => {
    expect(detectInAppBrowser(userAgent)).toBe(browser);
  });

  it.each([
    {
      browser: "Chrome on Android",
      userAgent: "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
    },
    {
      browser: "Safari on iOS",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
    },
    {
      browser: "desktop Chrome",
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    }
  ])("returns undefined for $browser", ({ userAgent }) => {
    expect(detectInAppBrowser(userAgent)).toBeUndefined();
  });
});
