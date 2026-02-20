const path = require("path");

module.exports = {
  extends: [require.resolve("@akashnetwork/dev-config/.eslintrc.ts")],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      rules: {
        "react/no-unescaped-entities": "warn",
        "react-hooks/exhaustive-deps": "warn",
        "react/display-name": "off"
      }
    }
  ],
  settings: {
    "import-x/ignore": ["react"]
  }
};
