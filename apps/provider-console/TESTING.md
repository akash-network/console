# Testing Strategy for Provider Console

This document outlines the testing strategy for the Provider Console application.

## Unit Tests for the UI

Unit tests focus on testing individual components, hooks, and utilities in isolation to ensure they behave as expected.

### When to use:

- For 99% of components and hooks
- Less frequently for services, as they typically delegate work to the HTTP layer

### Why:

- Ensures components and hooks behave as expected in full isolation
- Fast to run and easy to maintain
- Provides immediate feedback on code changes

### When to run:

- Locally during development
- As part of PR checks in CI/CD
- Automatically on pre-commit hooks

### Requirements:

- All dependencies must be mocked
- Components, hooks, and services should be tested in full isolation
- Tests should focus on behavior, not implementation details
- Minimum code coverage requirement: 70% (statements, branches, functions, lines)

## Pre-commit Hooks

The project uses Husky to run tests and check coverage before commits:

- All changed files in `src/components` and `src/hooks` will trigger test runs
- Tests must pass and meet the minimum coverage threshold (70%)
- If tests fail or coverage is insufficient, the commit will be rejected

To manually run the coverage check:

```bash
npm run test:coverage:check
```

## Directory Structure

Tests are organized following the same directory structure as the components and hooks they test:

```
src/
├── components/
│   └── shared/
│       ├── __tests__/
│       │   ├── Title.test.tsx
│       │   └── LinearLoadingSkeleton.test.tsx
│       ├── Title.tsx
│       └── LinearLoadingSkeleton.tsx
└── hooks/
    ├── __tests__/
    │   └── useWhen.test.tsx
    └── useWhen.ts
```

## Running Tests

To run tests, use one of the following commands:

```
# Run all tests once
npm test -- --no-watch

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with coverage check (will fail if below threshold)
npm run test:coverage:check
```

## Testing Components

When testing components, focus on testing:

1. **Output**: Does the component render the correct output?
2. **Behavior**: Does the component behave correctly in response to user interactions?
3. **API**: Does the component correctly handle props and callbacks?

Example:

```tsx
import { render, screen } from '@testing-library/react';
import { Title } from '../Title';

describe('Title Component', () => {
  it('renders as an h1 by default', () => {
    render(<Title>Hello World</Title>);
    
    const heading = screen.getByText('Hello World');
    expect(heading.tagName).toBe('H1');
    expect(heading).toHaveClass('text-2xl font-bold tracking-tight sm:text-4xl');
  });
});
```

## Testing Hooks

When testing hooks, focus on testing:

1. **Return Values**: Does the hook return the expected values?
2. **Effects**: Does the hook trigger effects correctly?
3. **Updates**: Does the hook correctly update its state in response to input changes?

Example:

```tsx
import { renderHook } from '@testing-library/react';
import { useWhen } from '../useWhen';

describe('useWhen Hook', () => {
  it('should call the callback when condition is true', () => {
    const callback = jest.fn();
    renderHook(() => useWhen(true, callback));
    
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
```

## Mocking Dependencies

When testing components or hooks that depend on external services or context, mock these dependencies:

```tsx
// Example of mocking a component dependency
jest.mock('@mui/material/LinearProgress', () => {
  return {
    __esModule: true,
    default: () => <div data-testid="linear-progress" />
  };
});

// Example of mocking a hook or context
jest.mock('../useAuth', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { id: '123', name: 'Test User' }
  })
}));
```

## Best Practices

1. **Test behavior, not implementation**: Focus on what the component does, not how it does it
2. **Isolate tests**: Each test should be independent and not rely on other tests
3. **Mock external dependencies**: Ensure tests are isolated from external services
4. **Use realistic test data**: Use data that resembles real-world usage
5. **Test error states**: Make sure components handle errors correctly
6. **Keep tests simple**: Each test should test one thing, not multiple behaviors
7. **Use readable assertions**: Tests should read like documentation 