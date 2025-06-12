# SQL Queries and Index Documentation

This document provides an overview of the SQL queries used in the notification system and the database indexes that optimize these queries.

## Table Schema Overview

### Notification Channels Table

The `notification_channels` table stores communication channel configurations for sending notifications:

```sql
CREATE TABLE notification_channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  type notification_channel_type NOT NULL,
  config JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### Alerts Table

The `alerts` table stores alert definitions and configurations:

```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
  user_id UUID NOT NULL,
  notification_channel_id UUID NOT NULL REFERENCES notification_channels(id),
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  conditions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true NOT NULL,
  type alert_type NOT NULL,
  status alert_status DEFAULT 'OK' NOT NULL,
  params JSONB,
  min_block_height INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
```

### Block Cursor Table

The `block_cursor` table tracks the last processed blockchain block:

```sql
CREATE TABLE block_cursor (
  id TEXT PRIMARY KEY DEFAULT 'latest' NOT NULL,
  last_processed_block BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT now() NOT NULL,
  updated_at TIMESTAMP DEFAULT now() NOT NULL
);
```

This is a single-record table that only stores one row, used to track the blockchain processing state.

## Common SQL Queries

### Notification Channels Queries

1. **Retrieve a notification channel by ID**:

   ```sql
   SELECT id, user_id, name, type, config, created_at, updated_at
   FROM notification_channels
   WHERE id = $1
   LIMIT $2;
   ```

2. **Retrieve notification channels by user ID with pagination**:

   ```sql
   SELECT id, user_id, name, type, config, created_at, updated_at
   FROM notification_channels
   WHERE user_id = $1
   ORDER BY created_at
   LIMIT $2;
   ```

3. **Count notification channels for a user**:

   ```sql
   SELECT COUNT(id)
   FROM notification_channels
   WHERE user_id = $1;
   ```

4. **Insert a new notification channel**:
   ```sql
   INSERT INTO notification_channels (id, user_id, name, type, config, created_at, updated_at)
   VALUES (default, $1, $2, $3, $4, default, default)
   RETURNING id, user_id, name, type, config, created_at, updated_at;
   ```

### Alert Queries

1. **Retrieve alerts for deployment with complex JSON filtering**:

   ```sql
   SELECT id, user_id, notification_channel_id, name, summary, description,
          conditions, enabled, type, status, params, min_block_height, created_at, updated_at
   FROM alerts
   WHERE (params->>'dseq' = $1 AND
          (params->>'type' IS NOT NULL OR
           (type = $2 AND params->>'owner' IS NOT NULL))) AND
         user_id = $3;
   ```

2. **Retrieve alerts by enabled status, type, and block height with pagination**:

   ```sql
   SELECT id, user_id, notification_channel_id, name, summary, description,
          conditions, enabled, type, status, params, min_block_height, created_at, updated_at
   FROM alerts
   WHERE enabled = $1 AND type = $2 AND min_block_height <= $3
   ORDER BY id
   LIMIT $4;
   ```

3. **Retrieve alerts by enabled status, type, and alert status with pagination**:

   ```sql
   SELECT id, user_id, notification_channel_id, name, summary, description,
          conditions, enabled, type, status, params, min_block_height, created_at, updated_at
   FROM alerts
   WHERE enabled = $1 AND type = $2 AND status = $3
   ORDER BY id
   LIMIT $4;
   ```

4. **Count alerts for a user**:

   ```sql
   SELECT COUNT(id)
   FROM alerts
   WHERE user_id = $1;
   ```

5. **Retrieve alerts by user ID with pagination**:

   ```sql
   SELECT id, user_id, notification_channel_id, name, summary, description,
          conditions, enabled, type, status, params, min_block_height, created_at, updated_at
   FROM alerts
   WHERE user_id = $1
   ORDER BY created_at
   LIMIT $2;
   ```

6. **Insert a new alert**:
   ```sql
   INSERT INTO alerts (id, user_id, notification_channel_id, name, summary, description,
                      conditions, enabled, type, status, params, min_block_height, created_at, updated_at)
   VALUES (default, $1, $2, $3, $4, $5, $6, $7, $8, default, $9, default, default, default)
   RETURNING *;
   ```

## Database Indexes

To optimize the queries above, the following indexes have been created:

### Notification Channels Table Indexes

1. **Primary Key Index**:

   - Automatically created on the `id` column
   - Supports direct lookups by notification channel ID

2. **User ID Index**:

   ```sql
   CREATE INDEX idx_notification_channels_user_id ON notification_channels(user_id);
   ```

   - Optimizes queries that filter by user_id
   - Supports finding all notification channels for a specific user

3. **Created At Index**:
   ```sql
   CREATE INDEX idx_notification_channels_created_at ON notification_channels(created_at);
   ```
   - Optimizes ordering in pagination queries

### Alerts Table Indexes

1. **Primary Key Index**:

   - Automatically created on the `id` column
   - Supports direct lookups by alert ID

2. **User ID Index**:

   ```sql
   CREATE INDEX idx_alerts_user_id ON alerts(user_id);
   ```

   - Optimizes queries that filter alerts by user

3. **Notification Channel ID Index**:

   ```sql
   CREATE INDEX idx_alerts_notification_channel_id ON alerts(notification_channel_id);
   ```

   - Optimizes joins between alerts and notification channels

4. **Type and Enabled Index**:

   ```sql
   CREATE INDEX idx_alerts_type_enabled ON alerts(type, enabled);
   ```

   - Optimizes queries that filter by both type and enabled status

5. **Status Index**:

   ```sql
   CREATE INDEX idx_alerts_status ON alerts(status);
   ```

   - Optimizes queries that filter by alert status

6. **Min Block Height and ID Index**:

   ```sql
   CREATE INDEX idx_alerts_min_block_height_id ON alerts(min_block_height, id);
   ```

   - Optimizes queries that filter by block height and order by ID

7. **Created At and ID Index**:

   ```sql
   CREATE INDEX idx_alerts_created_at_id ON alerts(created_at, id);
   ```

   - Optimizes pagination queries that order by creation date

8. **GIN Index on JSON Params**:

   ```sql
   CREATE INDEX idx_alerts_params ON alerts USING gin(params jsonb_path_ops);
   ```

   - Critical for efficiently querying the JSON params field
   - Significantly improves performance for queries filtering on JSON attributes like dseq, owner, etc.

9. **Composite Index for Combined Filtering**:
   ```sql
   CREATE INDEX idx_alerts_enabled_type_status ON alerts(enabled, type, status);
   ```
   - Optimizes queries that filter by a combination of enabled, type, and status

### Block Cursor Table Indexes

Since the `block_cursor` table is a single-record table (containing only one row), no additional indexes are needed beyond the primary key. PostgreSQL will efficiently retrieve the single record using the primary key.

## Index Selection Logic

PostgreSQL's query planner will choose the most appropriate index for each query based on:

1. The filter conditions (WHERE clauses)
2. The sort requirements (ORDER BY clauses)
3. The selectivity of the indexes

For complex queries with multiple conditions, PostgreSQL might use:

- A single index that covers multiple conditions
- Multiple indexes through bitmap scans
- A combination of indexes and sequential scans

## Index Maintenance Considerations

- The GIN index on the `params` JSON field may require more maintenance overhead due to its complexity
- Consider periodic VACUUM and ANALYZE operations to maintain index efficiency
- Monitor index usage through PostgreSQL's pg_stat_user_indexes to ensure indexes are being utilized
