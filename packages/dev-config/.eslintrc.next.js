const path = require("path");

module.exports = {
  extends: [path.resolve(__dirname, "./.eslintrc.ts.js")],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      extends: ["next/core-web-vitals"],
      rules: {
        "react/no-unescaped-entities": "warn",
        "react-hooks/exhaustive-deps": "warn",
        "import/no-anonymous-default-export": "warn",
        "react/display-name": "off"
      }
    }
  ],
  settings: {
    next: {
      rootDir: "."
    },
    "import-x/ignore": ["react"]
  }
};
