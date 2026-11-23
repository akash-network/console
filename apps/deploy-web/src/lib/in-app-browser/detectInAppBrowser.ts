export const UNNAMED_ANDROID_WEBVIEW = "Android WebView";

export type InAppBrowser = "X" | "Instagram" | "Facebook" | "LinkedIn" | "TikTok" | "Snapchat" | "LINE" | typeof UNNAMED_ANDROID_WEBVIEW;

/** Named apps come first because their Android user agents also carry the generic WebView marker. */
const IN_APP_BROWSER_SIGNATURES: ReadonlyArray<{ browser: InAppBrowser; pattern: RegExp }> = [
  { browser: "X", pattern: /TwitterAndroid|Twitter for iP/ },
  { browser: "Instagram", pattern: /Instagram/ },
  { browser: "Facebook", pattern: /FBAN|FBAV|MetaIAB/ },
  { browser: "LinkedIn", pattern: /LinkedInApp/ },
  { browser: "TikTok", pattern: /musical_ly|BytedanceWebview/ },
  { browser: "Snapchat", pattern: /Snapchat/ },
  { browser: "LINE", pattern: / Line\// },
  { browser: UNNAMED_ANDROID_WEBVIEW, pattern: /; wv\)/ }
];

export function detectInAppBrowser(userAgent: string): InAppBrowser | undefined {
  return IN_APP_BROWSER_SIGNATURES.find(({ pattern }) => pattern.test(userAgent))?.browser;
}
