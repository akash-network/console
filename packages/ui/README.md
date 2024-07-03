# UI Package

This package contains a set of reusable UI components that can be used in other applications within this monorepo.

## Installation

To install the UI package, follow these steps:

1. Add `"@akashnetwork/ui": "*"` to the list of dependencies of your project.
2. Open a terminal and navigate to the root directory.
3. Run the following command to install the package:

```bash
npm install
```

## Usage

To use the UI components in your application, follow these steps:

1. Import the desired component from the `@akashnetwork/ui` package:

```javascript
import { Button, Input } from "@akashnetwork/ui/components";
```

2. Use the imported component in your application's code:

```javascript
const App = () => {
  return (
    <div>
      <Button>Click me</Button>
      <Input placeholder="Enter your name" />
    </div>
  );
};
```

## Customization

The UI components provided by this package can be customized to fit your application's needs. You can refer to the documentation of each component to learn more about the available customization options.

## Contributing

If you would like to contribute to the development of the UI package, please follow the guidelines outlined in the [CONTRIBUTING.md](./CONTRIBUTING.md) file.

## License

This package is licensed under the [MIT License](./LICENSE).
