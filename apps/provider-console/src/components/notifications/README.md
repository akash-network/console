# Notifications

This feature allows provider console users to compose, preview, send, and review notifications. Currently supports maintenance notifications, with more notification types planned for the future.

## Components

### MaintenanceForm
Form component for creating maintenance notifications with validation:
- Reason selection (hardware upgrade, network maintenance, etc.)
- Start/end time inputs (UTC)
- Downtime impact toggle
- Form validation using Zod schemas

### PreviewPanel
Displays a preview of the notification:
- Shows maintenance details summary
- Displays formatted subject and body
- Shows recipient information

### HistoryTable
Table component for viewing past notifications:
- Paginated list of notifications
- Status indicators
- View details action
- Empty state handling

### NoticeDetailsDrawer
Modal drawer for viewing detailed information about a specific notification:
- Complete maintenance details
- Message preview
- Delivery statistics (if available)
- Metadata information

## API Integration

The components use React Query hooks for API integration:
- `useCreateNotificationDraft` - Create draft notifications
- `useSendNotification` - Send notifications
- `useNotifications` - List notifications with pagination
- `useNotification` - Get single notification details

## Validation

Form validation is handled using Zod schemas:
- Required fields validation
- Date range validation (end > start)
- Future date validation (start must be 5+ minutes in future)
- Duration validation (max 14 days)

## Features

- **Create Tab**: Form to create new notifications
- **History Tab**: View past notifications with pagination
- **Preview**: Real-time preview of notification content
- **Rate Limiting**: Visual indicators for send limits
- **Responsive Design**: Works on desktop and mobile
- **Accessibility**: Proper ARIA labels and keyboard navigation
