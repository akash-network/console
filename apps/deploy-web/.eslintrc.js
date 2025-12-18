module.exports = {
  extends: [require.resolve("@akashnetwork/dev-config/.eslintrc.next")],
  rules: {
    "no-restricted-imports": [
      "error",
      {
        paths: [
          {
            name: "@auth0/nextjs-auth0",
            message: "Import patched version of @auth0/nextjs-auth0 from @src/lib/auth0 instead of @auth0/nextjs-auth0."
          }
        ]
      }
    ]
  }
};
