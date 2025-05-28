import { waitFor } from "@testing-library/react";

class ContainerTestingChildCapturer<T> {
  private child?: T;

  constructor() {
    this.renderChild = this.renderChild.bind(this);
  }

  renderChild(props: T) {
    this.child = props;
    return null;
  }

  async awaitChild(condition: (child: T) => boolean = () => true): Promise<T> {
    return await waitFor(() => {
      if (!this.child || !condition(this.child)) {
        throw new Error("Child not rendered yet");
      }
      return this.child as T;
    });
  }
}

export function createContainerTestingChildCapturer<T>() {
  return new ContainerTestingChildCapturer<T>();
}
