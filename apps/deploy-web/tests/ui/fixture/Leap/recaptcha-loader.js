!(function () {
  var c = window,
    a = "___grecaptcha_cfg",
    e = (c[a] = c[a] || {}),
    t = "grecaptcha",
    n = (c[t] = c[t] || {});
  (n.ready =
    n.ready ||
    function (c) {
      (e.fns = e.fns || []).push(c);
    }),
    (c.__recaptcha_api = "https://www.google.com/recaptcha/api2/"),
    (e.render = e.render || []).push("explicit"),
    (e.action = e.action || []).push("faucet"),
    (c.__google_recaptcha_client = !0);
})();
