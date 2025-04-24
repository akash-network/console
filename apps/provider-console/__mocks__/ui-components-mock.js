const React = require("react");

module.exports = {
  Spinner: ({ className, size }) =>
    React.createElement(
      "div",
      {
        "data-testid": "spinner",
        className,
        "data-size": size
      },
      "Loading..."
    ),
  Separator: () => React.createElement("hr", { "data-testid": "separator" })
};
