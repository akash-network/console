import "@testing-library/jest-dom";

import React from "react";
import { TooltipProvider } from "@akashnetwork/ui/components";
import { PopupProvider } from "@akashnetwork/ui/context";
import { faker } from "@faker-js/faker";

import type { ContactPointsListViewProps } from "./ContactPointsListView";
import { ContactPointsListView } from "./ContactPointsListView";

import { fireEvent, render, screen } from "@testing-library/react";

describe("ContactPointsListView", () => {
  it("renders loading spinner when isLoading is true", () => {
    setup({ isLoading: true });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders error message when isError is true", () => {
    setup({ isError: true });
    expect(screen.getByText("Error loading contact points")).toBeInTheDocument();
  });

  it("renders empty state message when no data is provided", () => {
    setup({ data: [] });
    expect(screen.getByText("No contact points found")).toBeInTheDocument();
  });

  it("renders table with contact points data", () => {
    const name = "Test Contact Point";
    const email = "test@example.com";
    const mockData = [
      {
        name,
        id: faker.string.uuid(),
        type: "email" as const,
        config: {
          addresses: [email]
        },
        userId: faker.string.uuid(),
        createdAt: faker.date.recent(),
        updatedAt: faker.date.recent()
      }
    ];

    setup({ data: mockData });

    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Type")).toBeInTheDocument();
    expect(screen.getByText("Addresses")).toBeInTheDocument();

    expect(screen.getByText("Test Contact Point")).toBeInTheDocument();
    expect(screen.getByText("email")).toBeInTheDocument();
    expect(screen.getByText("test@example.com")).toBeInTheDocument();
  });

  it("calls onEdit when edit button is clicked", () => {
    const onEdit = jest.fn();
    const mockData = [
      {
        id: faker.string.uuid(),
        name: faker.string.alphanumeric(),
        type: "email" as const,
        config: {
          addresses: [faker.internet.email()]
        },
        userId: faker.string.uuid(),
        createdAt: faker.date.recent(),
        updatedAt: faker.date.recent()
      }
    ];

    setup({ data: mockData, onEdit });

    fireEvent.click(screen.getByTestId("edit-contact-point-button"));
    expect(onEdit).toHaveBeenCalledWith(mockData[0].id);
  });

  it("calls onRemoveStart when remove button is clicked", () => {
    const onRemoveStart = jest.fn();
    const mockData = [
      {
        id: faker.string.uuid(),
        name: faker.string.alphanumeric(),
        type: "email" as const,
        config: {
          addresses: [faker.internet.email()]
        },
        userId: faker.string.uuid(),
        createdAt: faker.date.recent(),
        updatedAt: faker.date.recent()
      }
    ];

    setup({ data: mockData, onRemoveStart });

    fireEvent.click(screen.getByTestId("remove-contact-point-button"));
    expect(onRemoveStart).toHaveBeenCalledWith(mockData[0].id);
  });

  it("shows confirmation popup when contactPointIdToRemove is provided", () => {
    const mockContactPointId = faker.string.uuid();
    const mockData = [
      {
        id: faker.string.uuid(),
        name: faker.string.alphanumeric(),
        type: "email" as const,
        config: {
          addresses: [faker.internet.email()]
        },
        userId: faker.string.uuid(),
        createdAt: faker.date.recent(),
        updatedAt: faker.date.recent()
      }
    ];
    setup({ data: mockData, contactPointIdToRemove: mockContactPointId });

    expect(screen.getByText("Are you sure you want to remove this contact point?")).toBeInTheDocument();
    expect(screen.getByText("This action cannot be undone.")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();
  });

  it("calls onRemoveCancel when cancel button in popup is clicked", () => {
    const onRemoveCancel = jest.fn();
    const mockData = [
      {
        id: faker.string.uuid(),
        name: faker.string.alphanumeric(),
        type: "email" as const,
        config: {
          addresses: [faker.internet.email()]
        },
        userId: faker.string.uuid(),
        createdAt: faker.date.recent(),
        updatedAt: faker.date.recent()
      }
    ];
    setup({ data: mockData, contactPointIdToRemove: faker.string.uuid(), onRemoveCancel });

    fireEvent.click(screen.getByText("Cancel"));
    expect(onRemoveCancel).toHaveBeenCalled();
  });

  it("calls onRemoveConfirm when remove button in popup is clicked", () => {
    const mockData = [
      {
        id: faker.string.uuid(),
        name: faker.string.alphanumeric(),
        type: "email" as const,
        config: {
          addresses: [faker.internet.email()]
        },
        userId: faker.string.uuid(),
        createdAt: faker.date.recent(),
        updatedAt: faker.date.recent()
      }
    ];
    const onRemoveConfirm = jest.fn();
    setup({ data: mockData, contactPointIdToRemove: faker.string.uuid(), onRemoveConfirm });

    fireEvent.click(screen.getByText("Remove"));
    expect(onRemoveConfirm).toHaveBeenCalled();
  });

  it("renders pagination when total is greater than minimum page size", () => {
    const pagination = {
      page: 1,
      limit: 10,
      total: 20,
      totalPages: 2
    };
    const mockData = [
      {
        id: faker.string.uuid(),
        name: faker.string.alphanumeric(),
        type: "email" as const,
        config: {
          addresses: [faker.internet.email()]
        },
        userId: faker.string.uuid(),
        createdAt: faker.date.recent(),
        updatedAt: faker.date.recent()
      }
    ];

    setup({ data: mockData, pagination });

    expect(screen.getByRole("navigation")).toBeInTheDocument();
  });

  it("does not render pagination when total is not greater than minimum page size", () => {
    const pagination = {
      page: 1,
      limit: 10,
      total: 5,
      totalPages: 1
    };

    setup({ pagination });

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  function setup(props: Partial<ContactPointsListViewProps> = {}) {
    const defaultProps: ContactPointsListViewProps = {
      data: [],
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0
      },
      isLoading: false,
      onEdit: jest.fn(),
      contactPointIdToRemove: null,
      onRemoveStart: jest.fn(),
      onRemoveCancel: jest.fn(),
      onRemoveConfirm: jest.fn(),
      isRemoving: false,
      onPageChange: jest.fn(),
      isError: false,
      ...props
    };

    render(
      <PopupProvider>
        <TooltipProvider>
          <ContactPointsListView {...defaultProps} />
        </TooltipProvider>
      </PopupProvider>
    );
    return defaultProps;
  }
});
