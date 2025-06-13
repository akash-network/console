# Akash Console Notifications Service

## Description

The Notifications Service is a key component of the Akash Console application, responsible for handling and routing notifications to users. It's built using the [Nest](https://github.com/nestjs/nest) framework with TypeScript.

## Features

- **Chain Event Processing**: Listens to blockchain events and processes them for notifications
- **Notification Routing**: Routes notifications to appropriate channels (email, etc.)
- **Email Notifications**: Sends email notifications via Novu
- **Broker Service**: Manages message queuing and delivery

## Project Structure

- **modules**: Contains domain specific modules, core business logic
- **interfaces**: Contains various outer interfaces, these can be treated as independent entry points
- **infrastructure**: Contains implementations like dbs, message brokers, etc.
- **common**: Shared utilities and services

## Project Setup

```bash
$ npm install
```

## Docs and OpenAPI
[More details here](./docs/codegen.md)

## Postgresql and Indexes 
[More details here](./docs/sql.md)

## Compile and Run the Project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run Tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Testing Patterns

The service uses a consistent testing pattern with setup functions:

- Each test case calls a `setup()` function to get dependencies
- Mocks are created using `jest-mock-extended` and `MockProvider`
- Tests are isolated and don't share state

Example:

```typescript
describe('SomeService', () => {
  it('should do something', async () => {
    const { service, dependency } = await setup();
    // Test implementation
  });

  async function setup() {
    // Setup dependencies and return them
    return { service, dependency };
  }
});
```

## License

This project is part of Akash Console and is licensed under the terms of its license agreement.