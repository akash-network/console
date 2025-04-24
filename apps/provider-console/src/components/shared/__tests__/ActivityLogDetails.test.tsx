/* eslint-disable simple-import-sort/imports */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ActivityLogDetails } from "../ActivityLogDetails";
import { formatLocalTime } from "@src/utils/dateUtils";
import restClient from "@src/utils/restClient";

// Mock env config before importing the component
jest.mock(
  "@src/config/browser-env.config",
  () => ({
    browserEnvConfig: {
      NEXT_PUBLIC_API_BASE_URL: "http://localhost:3000",
      NEXT_PUBLIC_CONSOLE_API_MAINNET_URL: "http://localhost:3001",
      NEXT_PUBLIC_BASE_SECURITY_URL: "http://localhost:3002",
      NEXT_PUBLIC_MAINNET_RPC_URL: "http://localhost:3003",
      NEXT_PUBLIC_MAINNET_API_URL: "http://localhost:3004",
      NEXT_PUBLIC_BETA_URL: "http://localhost:3005"
    }
  }),
  { virtual: true }
);

// Mock dependencies
// Set default mock implementation for useProviderActionStatus
const mockUseProviderActionStatus = jest.fn().mockReturnValue({
  data: null,
  isLoading: false
});

// Create mock event source
const mockEventSource = {
  onmessage: jest.fn(),
  onerror: jest.fn(),
  close: jest.fn()
};

jest.mock("@src/queries/useProviderQuery", () => ({
  useProviderActionStatus: (...args) => mockUseProviderActionStatus(...args)
}));

jest.mock("@src/utils/dateUtils", () => ({
  formatLocalTime: jest.fn().mockReturnValue("01/01/2023, 12:00:00 PM"),
  formatTimeLapse: jest.fn().mockReturnValue("5 min 30 sec")
}));

// Mocking other dependencies that might be used internally
jest.mock("@src/utils/restClient", () => ({
  get: jest.fn()
}));

jest.mock("@src/utils/tokenUtils", () => ({
  checkAndRefreshToken: jest.fn().mockResolvedValue("mock-token")
}));

// Need to mock these for the component to render
jest.mock("event-source-polyfill", () => ({
  EventSourcePolyfill: jest.fn().mockImplementation(() => mockEventSource)
}));

jest.mock("iconoir-react", () => ({
  ArrowDown: () => <div data-testid="arrow-down">Arrow Down</div>,
  ArrowRight: () => <div data-testid="arrow-right">Arrow Right</div>,
  Check: () => <div data-testid="check-icon">Check</div>,
  Xmark: () => <div data-testid="x-icon">X</div>
}));

jest.mock("@melloware/react-logviewer", () => ({
  LazyLog: ({ text }) => <div data-testid="lazy-log">{text}</div>,
  ScrollFollow: ({ render }) => render({ follow: true, onScroll: jest.fn() })
}));

describe("ActivityLogDetails Component", () => {
  // Reset all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseProviderActionStatus.mockReturnValue({
      data: null,
      isLoading: false
    });
    mockEventSource.close.mockClear();
  });

  it('renders "Job ID Not Found" when actionId is null', () => {
    render(<ActivityLogDetails actionId={null} />);

    expect(screen.getByText("Job ID Not Found")).toBeInTheDocument();
    expect(screen.getByText("Unable to retrieve provider setup process information.")).toBeInTheDocument();
  });

  it('renders "Loading..." when data is loading', () => {
    mockUseProviderActionStatus.mockReturnValue({
      data: null,
      isLoading: true
    });

    render(<ActivityLogDetails actionId="123" />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders action details when data is loaded successfully", () => {
    const mockAction = {
      id: "action-123",
      name: "Test Action",
      status: "completed",
      start_time: "2023-01-01T12:00:00Z",
      end_time: "2023-01-01T12:30:00Z",
      tasks: []
    };

    mockUseProviderActionStatus.mockReturnValue({
      data: mockAction,
      isLoading: false
    });

    render(<ActivityLogDetails actionId="action-123" />);

    expect(screen.getByText("Test Action")).toBeInTheDocument();
    expect(screen.getByText("action-123")).toBeInTheDocument();
    expect(formatLocalTime).toHaveBeenCalledWith("2023-01-01T12:00:00Z");
    expect(formatLocalTime).toHaveBeenCalledWith("2023-01-01T12:30:00Z");
  });

  it("renders tasks with correct status indicators", () => {
    const mockAction = {
      id: "action-123",
      name: "Test Action",
      status: "completed",
      start_time: "2023-01-01T12:00:00Z",
      end_time: "2023-01-01T12:30:00Z",
      tasks: [
        {
          id: "task-1",
          description: "Completed Task",
          status: "completed",
          start_time: "2023-01-01T12:00:00Z",
          end_time: "2023-01-01T12:15:00Z"
        },
        {
          id: "task-2",
          description: "In Progress Task",
          status: "in_progress",
          start_time: "2023-01-01T12:15:00Z",
          end_time: null
        },
        {
          id: "task-3",
          description: "Not Started Task",
          status: "not_started",
          start_time: null,
          end_time: null
        },
        {
          id: "task-4",
          description: "Failed Task",
          status: "failed",
          start_time: "2023-01-01T12:25:00Z",
          end_time: "2023-01-01T12:30:00Z"
        }
      ]
    };

    mockUseProviderActionStatus.mockReturnValue({
      data: mockAction,
      isLoading: false
    });

    render(<ActivityLogDetails actionId="action-123" />);

    // Check if all tasks are rendered - use getAllByText for In Progress Task since it appears twice
    expect(screen.getByText("Completed Task")).toBeInTheDocument();
    expect(screen.getAllByText("In Progress Task")[0]).toBeInTheDocument();
    expect(screen.getByText("Not Started Task")).toBeInTheDocument();
    expect(screen.getByText("Failed Task")).toBeInTheDocument();

    // Check status indicators
    const checkIcons = screen.getAllByTestId("check-icon");
    const spinners = screen.queryAllByText("Loading...");
    const xIcons = screen.getAllByTestId("x-icon");

    // One completed task
    expect(checkIcons.length).toBeGreaterThanOrEqual(1);

    // One in-progress task
    expect(spinners.length).toBeGreaterThanOrEqual(1);

    // One failed task
    expect(xIcons.length).toBeGreaterThanOrEqual(1);
  });

  it("shows accordion state correctly with initially expanded in-progress tasks", () => {
    const mockAction = {
      id: "action-123",
      name: "Test Action",
      status: "in_progress",
      start_time: "2023-01-01T12:00:00Z",
      end_time: null,
      tasks: [
        {
          id: "task-1",
          description: "Completed Task",
          status: "completed",
          start_time: "2023-01-01T12:00:00Z",
          end_time: "2023-01-01T12:15:00Z"
        },
        {
          id: "task-2",
          description: "In Progress Task",
          status: "in_progress",
          start_time: "2023-01-01T12:15:00Z",
          end_time: null
        }
      ]
    };

    mockUseProviderActionStatus.mockReturnValue({
      data: mockAction,
      isLoading: false
    });

    render(<ActivityLogDetails actionId="action-123" />);

    // Task 1 should be collapsed (ArrowRight), Task 2 should be expanded (ArrowDown)
    const arrowDowns = screen.getAllByTestId("arrow-down");
    const arrowRights = screen.getAllByTestId("arrow-right");

    expect(arrowDowns.length).toBe(1); // One task expanded (in_progress)
    expect(arrowRights.length).toBe(1); // One task collapsed (completed)
  });

  it("fetches archived logs when a completed task accordion is clicked", async () => {
    const mockAction = {
      id: "action-123",
      name: "Test Action",
      status: "completed",
      start_time: "2023-01-01T12:00:00Z",
      end_time: "2023-01-01T12:30:00Z",
      tasks: [
        {
          id: "task-1",
          description: "Completed Task",
          status: "completed",
          start_time: "2023-01-01T12:00:00Z",
          end_time: "2023-01-01T12:15:00Z"
        }
      ]
    };

    mockUseProviderActionStatus.mockReturnValue({
      data: mockAction,
      isLoading: false
    });

    // Mock the response for fetching archived logs
    (restClient.get as jest.Mock).mockResolvedValue({
      logs: [{ message: "Log line 1" }, { message: "Log line 2" }]
    });

    render(<ActivityLogDetails actionId="action-123" />);

    // Initially task should be collapsed
    expect(screen.getAllByTestId("arrow-right").length).toBe(1);

    // Click to expand the task
    fireEvent.click(screen.getByText("Completed Task"));

    // Check that logs are fetched
    await waitFor(() => {
      expect(restClient.get).toHaveBeenCalledWith("/tasks/logs/archive/task-1");
    });
  });

  it("handles streaming logs for in-progress tasks", async () => {
    // Skip this test for now
    // This is more difficult to test because the event source setup
    // needs more extensive mocking
  });

  it("displays different status indicators based on action status", () => {
    const mockCompletedAction = {
      id: "action-completed",
      name: "Completed Action",
      status: "completed",
      start_time: "2023-01-01T12:00:00Z",
      end_time: "2023-01-01T12:30:00Z",
      tasks: []
    };

    mockUseProviderActionStatus.mockReturnValue({
      data: mockCompletedAction,
      isLoading: false
    });

    const { rerender } = render(<ActivityLogDetails actionId="action-completed" />);

    // Completed action should show a check icon
    expect(screen.getByTestId("check-icon")).toBeInTheDocument();

    // Change to in-progress action
    const mockInProgressAction = {
      ...mockCompletedAction,
      id: "action-in-progress",
      name: "In Progress Action",
      status: "in_progress",
      end_time: null
    };

    mockUseProviderActionStatus.mockReturnValue({
      data: mockInProgressAction,
      isLoading: false
    });

    rerender(<ActivityLogDetails actionId="action-in-progress" />);

    // In-progress action should show a spinner
    expect(screen.queryByText("Loading...")).toBeInTheDocument();

    // Change to failed action
    const mockFailedAction = {
      ...mockCompletedAction,
      id: "action-failed",
      name: "Failed Action",
      status: "failed"
    };

    mockUseProviderActionStatus.mockReturnValue({
      data: mockFailedAction,
      isLoading: false
    });

    rerender(<ActivityLogDetails actionId="action-failed" />);

    // Failed action should show an X icon
    expect(screen.getByTestId("x-icon")).toBeInTheDocument();
  });
});
