!(function () {
  try {
    var e = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {},
      t = new e.Error().stack;
    t &&
      ((e._sentryDebugIds = e._sentryDebugIds || {}),
      (e._sentryDebugIds[t] = "9324f7cc-5bb3-4db8-9f3b-d36e4c8f60be"),
      (e._sentryDebugIdIdentifier = "sentry-dbid-9324f7cc-5bb3-4db8-9f3b-d36e4c8f60be"));
  } catch (e) {}
})();
var _global = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
_global.SENTRY_RELEASE = { id: "0.23.1" };
("use strict");
(self.webpackChunk_leap_cosmos_extension = self.webpackChunk_leap_cosmos_extension || []).push([
  ["9712"],
  {
    52056: function (e, t, s) {
      var n, a;
      s.d(t, { y: () => n }),
        s(55968),
        s(95238),
        ((a = n || (n = {})).SEND_TX = "send-tx-to-background"),
        (a.REQUEST_SIGN_DIRECT = "request-sign-direct"),
        (a.REQUEST_SIGN_AMINO = "request-sign-amino"),
        (a.GET_KEY = "get-key"),
        (a.GET_KEYS = "get-keys"),
        (a.ENABLE_ACCESS = "enable-access"),
        (a.GET_CHAIN_INFOS_WITHOUT_ENDPOINTS = "get-chain-infos-without-endpoints"),
        (a.GET_SUPPORTED_CHAINS = "get-supported-chains"),
        (a.GET_CONNECTION_STATUS = "get-connection-status"),
        (a.ADD_SUGGESTED_CHAIN = "add-suggested-chain"),
        (a.DISCONNECT = "disconnect"),
        (a.GET_SECRET20_VIEWING_KEY = "get-secret20-viewing-key"),
        (a.SUGGEST_TOKEN = "suggest-token"),
        (a.SUGGEST_CW20_TOKEN = "suggest-cw20-token"),
        (a.UPDATE_SECRET20_VIEWING_KEY = "update-secret20-viewing-key"),
        (a.GET_PUBKEY_MSG = "get-pubkey-msg"),
        (a.GET_TX_ENCRYPTION_KEY_MSG = "get-tx-encryption-key-msg"),
        (a.REQUEST_ENCRYPT_MSG = "request-encrypt-msg"),
        (a.REQUEST_DECRYPT_MSG = "request-decrypt-msg"),
        (a.REQUEST_VERIFY_ADR36_AMINO_SIGN_DOC = "request-verify-adr36-amino-sign-doc"),
        (a.REQUEST_SIGN_EIP712 = "request-sign-eip712"),
        (a.OPEN_SIDE_PANEL = "open-side-panel");
    },
    84166: function (e, t, s) {
      var n, a, i, _, o, l;
      s.d(t, { z3: () => _, JY: () => c }),
        ((n = i || (i = {})).DISCONNECT = "disconnect"),
        (n.GET_KEYS = "get-keys"),
        (n.GET_NETWORK = "get-network"),
        (n.SIGN_TRANSACTION = "sign-transaction"),
        (n.SWITCH_NETWORK = "switch-chain"),
        (n.SIGN_MESSAGE = "sign-message"),
        (n.OPEN_SIDE_PANEL = "open-side-panel"),
        ((a = _ || (_ = {})).CONNECT_WALLET = "connect-wallet"),
        (a.GET_ADDRESS = "get-address"),
        (a.GET_ACCOUNTS = "get-accounts"),
        (a.GET_NETWORK = "get-network"),
        (a.GET_PUBLIC_KEY = "get-public-key"),
        (a.REQUEST_ACCOUNTS = "request-accounts"),
        (a.SEND_BITCOIN = "send-bitcoin"),
        (a.SIGN_MESSAGE = "sign-message"),
        (a.SIGN_PSBT = "sign-psbt"),
        (a.SIGN_PSBTS = "sign-psbts"),
        (a.SWITCH_NETWORK = "switch-network"),
        (a.OPEN_SIDE_PANEL = "open-side-panel");
      let r = {
          ETH__REQUEST_ACCOUNTS: "eth_requestAccounts",
          ETH__SEND_TRANSACTION: "eth_sendTransaction",
          ETH__SIGN: "eth_sign",
          ETH__SIGN_TYPED_DATA_V4: "eth_signTypedData_v4",
          PERSONAL_SIGN: "personal_sign",
          WALLET__REQUEST_PERMISSIONS: "wallet_requestPermissions",
          WALLET__WATCH_ASSET: "wallet_watchAsset",
          WALLET__SWITCH_ETHEREUM_CHAIN: "wallet_switchEthereumChain",
          WALLET__ADD_ETHEREUM_CHAIN: "wallet_addEthereumChain",
          OPEN_SIDE_PANEL: s(52056).y.OPEN_SIDE_PANEL
        },
        c = Object.assign(
          Object.assign(
            {},
            {
              ETH__ACCOUNTS: "eth_accounts",
              ETH__CHAIN_ID: "eth_chainId",
              ETH__CALL: "eth_call",
              ETH__GET_CODE: "eth_getCode",
              ETH__GET_BALANCE: "eth_getBalance",
              ETH__BLOCK_NUMBER: "eth_blockNumber",
              ETH__ESTIMATE_GAS: "eth_estimateGas",
              ETH__GAS_PRICE: "eth_gasPrice",
              ETH__GET_BLOCK_BY_NUMBER: "eth_getBlockByNumber",
              WALLET__REVOKE_PERMISSIONS: "wallet_revokePermissions",
              ETH__GET_TRANSACTION_RECEIPT: "eth_getTransactionReceipt",
              ETH__GET_TRANSACTION_BY_HASH: "eth_getTransactionByHash",
              ETH__GET_TRANSACTION_COUNT: "eth_getTransactionCount"
            }
          ),
          r
        );
      ((l = o || (o = {})).MAINNET = "mainnet"), (l.TESTNET = "testnet"), (l.SIGNET = "signet"), s(28649);
    },
    79215: function (e, t, s) {
      s.d(t, { og: () => N });
      var n = s(52322),
        a = s(26793),
        i = s(89187),
        _ = s(16283),
        o = s(85027),
        l = s(86240),
        r = s(65953);
      s(2784);
      var c = s(70514),
        E = s(49409);
      let d = e => {
          let { activeIndex: t, setActiveIndex: s, limit: r } = e,
            { walletAvatar: E, walletName: d } = (0, l.v)();
          return (0, n.jsxs)(o.m, {
            className: "bg-secondary-50 border-b border-secondary-100",
            children: [
              (0, n.jsx)("div", { className: "w-[72px]" }),
              (0, n.jsx)(_.G2, { className: "bg-secondary-200", showWalletAvatar: !0, walletName: d, walletAvatar: E, handleDropdownClick: () => void 0 }),
              (0, n.jsx)("div", {
                className: "min-w-[72px]",
                children:
                  void 0 !== t &&
                  void 0 !== r &&
                  r > 1 &&
                  (0, n.jsxs)("div", {
                    className: "flex items-center rounded-full bg-secondary-200 p-2 justify-between",
                    children: [
                      (0, n.jsx)(a.W, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": 0 === t, "text-foreground cursor-pointer": 0 !== t }),
                        onClick: () => {
                          s && void 0 !== t && t > 0 && s(t - 1);
                        }
                      }),
                      (0, n.jsxs)("p", { className: "text-sm font-bold text-foreground", children: [t + 1, "/", r] }),
                      (0, n.jsx)(i.T, {
                        size: 14,
                        className: (0, c.cn)("", { "text-muted-foreground": t === r - 1, "text-foreground cursor-pointer": t !== r - 1 }),
                        onClick: () => {
                          s && void 0 !== t && r && t < r - 1 && s(t + 1);
                        }
                      })
                    ]
                  })
              })
            ]
          });
        },
        T = e =>
          (0, n.jsxs)("div", {
            className: "flex items-center gap-5",
            children: [
              (0, n.jsx)("img", { src: e.logo, onError: (0, E._)(r.Globe), className: "size-[54px] rounded-full" }),
              (0, n.jsxs)("div", {
                className: "flex flex-col gap-[3px]",
                children: [
                  (0, n.jsx)("span", { className: "text-lg font-bold", children: e.title }),
                  (0, n.jsx)("span", { className: "text-xs text-muted-foreground", children: e.subTitle })
                ]
              })
            ]
          }),
        N = e =>
          (0, n.jsxs)(n.Fragment, {
            children: [
              (0, n.jsx)(d, { activeIndex: e.activeIndex, setActiveIndex: e.setActiveIndex, limit: e.limit }),
              (0, n.jsxs)("div", {
                className: (0, c.cn)(
                  "flex flex-col gap-6 mx-auto h-[calc(100%-165px)] w-full max-w-2xl box-border overflow-y-scroll pt-6 px-6 bg-secondary-50",
                  e.className
                ),
                children: [(0, n.jsx)(T, { ...e }), e.children]
              })
            ]
          });
    },
    74703: function (e, t, s) {
      s.d(t, { u: () => a });
      var n,
        a =
          (((n = {}).signResponse = "sign-response"),
          (n.signingPopupOpen = "signing-popup-open"),
          (n.signTransaction = "sign-transaction"),
          (n.signBitcoinResponse = "sign-bitcoin-response"),
          (n.signSeiEvmResponse = "sign-sei-evm-response"),
          n);
    },
    25053: function (e, t, s) {
      s.d(t, { z: () => c });
      var n = s(52322),
        a = s(91486),
        i = s(65903),
        _ = s(2784),
        o = s(70514);
      let l = (0, _.forwardRef)((e, t) =>
        (0, n.jsx)("button", {
          ref: t,
          className: (0, o.cn)(
            "text-sm font-medium text-foreground transition-colors capitalize pb-3.5 rounded-full",
            a.YV,
            e.active ? "text-accent-green" : "text-secondary-700 hover:text-foreground",
            e.className
          ),
          onClick: e.onClick,
          "aria-label": `tab button in stake v2 flow ${e.children}`,
          children: (0, n.jsx)("span", { "aria-label": `tab button text in stake v2 flow ${e.children}`, children: e.children })
        })
      );
      l.displayName = "TabButton";
      let r = { transform: "translateX(0px) scaleX(0.441654)" },
        c = e => {
          var t;
          let { setSelectedTab: s, selectedIndex: a, buttons: _, buttonClassName: c, className: E, indicatorDefaultScale: d } = e,
            { containerRef: T, indicatorRef: N, childRefs: g } = (0, i.r)({ navItems: _, activeLabel: null === (t = _[a]) || void 0 === t ? void 0 : t.label });
          return (0, n.jsxs)("div", {
            ref: T,
            className: (0, o.cn)("relative flex items-center isolate gap-7", E),
            children: [
              _.map((e, t) =>
                (0, n.jsx)(
                  l,
                  {
                    ref: e => g.current.set(t, e),
                    active: t === a,
                    onClick: () => s(e),
                    className: c,
                    "aria-label": `tab button in stake v2 flow ${e.label}`,
                    children: (0, n.jsx)("span", { "aria-label": `tab button text in stake v2 flow ${e.label}`, children: e.label })
                  },
                  e.id ?? e.label
                )
              ),
              (0, n.jsx)("div", {
                className:
                  "absolute bottom-0 h-0.5 origin-left scale-0 translate-x-3 transition-transform duration-200 w-full rounded-[50vmin/10vmin] z-10 bg-accent-green",
                ref: N,
                style: d ?? r
              })
            ]
          });
        };
      c.displayName = "TabSelectors";
    },
    56052: function () {}
  }
]);
//# sourceMappingURL=9712.js.map
