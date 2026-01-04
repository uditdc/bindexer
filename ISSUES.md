# Bindexer Improvement Issues

Use this file to create GitHub issues. Copy each section as a new issue.

---

## Issue 1: fix: Use configured database path instead of hardcoded value

**Labels:** `bug`, `database`, `priority: critical`

### Problem

The database path is hardcoded in `src/utils/dbClient.ts:6`:

```typescript
const db = new Database('logs.sqlite')
```

This ignores the `database.path` configuration option defined in `src/types/config.ts`.

### Impact

- Users cannot configure a custom database location
- The `BINDEXER_DATABASE_PATH` environment variable has no effect
- Config file `database.path` setting is ignored

### Solution

1. Export an `initDatabase(path: string)` function that accepts the configured path
2. Call this during startup with the resolved config value
3. Ensure the database instance is properly shared across modules

### Files to Modify

- `src/utils/dbClient.ts` - Accept path parameter
- `src/index.ts` - Pass configured path during initialization

---

## Issue 2: feat: Add chain_id column to event tables for multi-chain support

**Labels:** `enhancement`, `database`, `priority: critical`

### Problem

Event tables lack a `chain_id` column, making it impossible to distinguish events from different networks when indexing multiple chains into the same database.

### Current Schema

```sql
CREATE TABLE event_transfer (
  id INTEGER PRIMARY KEY,
  contract_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  -- No chain_id!
  ...
);
```

### Impact

- Cannot index mainnet + polygon + arbitrum into same database
- Events from different chains with same tx hash could conflict
- No way to filter or query by network

### Solution

1. Add `chain_id INTEGER NOT NULL` column to all event tables
2. Include chain_id in the unique constraint: `(chain_id, transaction_hash, log_index)`
3. Add index for chain-specific queries: `(chain_id, block_number)`
4. Pass chain_id from network config to database functions

### Proposed Schema Change

```sql
CREATE TABLE event_transfer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id INTEGER NOT NULL,  -- NEW
  contract_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  log_index INTEGER NOT NULL,
  ...
);

CREATE UNIQUE INDEX idx_event_transfer_unique
  ON event_transfer(chain_id, transaction_hash, log_index);
CREATE INDEX idx_event_transfer_chain_block
  ON event_transfer(chain_id, block_number);
```

### Files to Modify

- `src/utils/dbClient.ts` - Update schema generation and save functions
- `src/logs.ts` - Pass chain_id when saving logs
- `src/types/config.ts` - Ensure chain_id is available from network config

---

## Issue 3: fix: Store actual block timestamp instead of insertion timestamp

**Labels:** `bug`, `database`, `priority: critical`

### Problem

The `timestamp` column uses `DEFAULT CURRENT_TIMESTAMP` which records when the row was **inserted into the database**, not when the event actually occurred on the blockchain.

### Current Implementation

```sql
-- src/utils/dbClient.ts:221
timestamp DATETIME DEFAULT CURRENT_TIMESTAMP  -- Insertion time, NOT block time
```

### Impact

- Historical sync shows all events with recent timestamps
- Cannot accurately query "events from last 24 hours on-chain"
- Time-series analysis is incorrect
- Misleading data for analytics

### Solution

1. Add `block_timestamp INTEGER` column (Unix timestamp from block)
2. Fetch block timestamp when processing logs
3. Keep `indexed_at` as separate column for tracking when we processed it

### Proposed Schema Change

```sql
CREATE TABLE event_transfer (
  ...
  block_number INTEGER NOT NULL,
  block_timestamp INTEGER,        -- Unix timestamp from chain
  indexed_at DATETIME DEFAULT CURRENT_TIMESTAMP,  -- When we indexed it
  ...
);
```

### Implementation Options

**Option A: Fetch per-block (accurate but slower)**
```typescript
const block = await viemClient.getBlock({ blockNumber: log.blockNumber })
log.blockTimestamp = block.timestamp
```

**Option B: Batch fetch blocks (balanced)** - RECOMMENDED
- Collect unique block numbers from batch
- Fetch all blocks in parallel
- Map timestamps to logs

**Option C: Estimate from block number (fast but approximate)**
- Use known block time (~12s for Ethereum)
- Calculate from a reference block

### Files to Modify

- `src/utils/dbClient.ts` - Add column, accept timestamp parameter
- `src/logs.ts` - Fetch and pass block timestamps

---

## Issue 4: feat: Use ABI parameter names for database columns

**Labels:** `enhancement`, `database`, `priority: medium`

### Problem

Event parameters are stored with generic index-based names instead of using the actual parameter names from the ABI.

### Current Implementation

```typescript
// src/utils/dbClient.ts:228
const columnName = `param_${i}_${input.type}`
// Result: param_0_address, param_1_address, param_2_uint256
```

### Impact

- Column names are not human-readable
- Queries are harder to write: `WHERE param_0_address = '0x...'`
- No semantic meaning in column names

### Solution

Use the ABI parameter names when available (code already exists but is commented out):

```typescript
// src/utils/dbClient.ts:227 (currently commented)
const columnName = input.name
  ? `${input.name}_${input.type}`.toLowerCase()  // from_address, value_uint256
  : `param_${i}_${input.type}`                   // fallback for unnamed params
```

### Result

```sql
-- Before:
param_0_address, param_1_address, param_2_uint256

-- After:
from_address, to_address, value_uint256
```

### Files to Modify

- `src/utils/dbClient.ts` - Uncomment and adjust column naming logic

---

## Issue 5: feat: Store raw event data for debugging and reprocessing

**Labels:** `enhancement`, `database`, `priority: medium`

### Problem

Only decoded event parameters are stored. The original raw event data (topics and data hex) is discarded.

### Impact

- Cannot debug decoding issues
- Cannot reprocess events with updated ABI
- Cannot verify decoded values against raw data
- Lost information if ABI was incomplete

### Solution

Add columns for raw event data:

```sql
CREATE TABLE event_transfer (
  ...
  -- Raw data for debugging/reprocessing
  event_signature TEXT,    -- topic[0] - the event selector hash
  raw_topics TEXT,         -- JSON array of all topic hashes
  raw_data TEXT,           -- Original hex data field
  ...
);
```

### Implementation

```typescript
// In saveLogToDatabase:
values.push(log.topics?.[0])                    // event_signature
values.push(JSON.stringify(log.topics || []))   // raw_topics
values.push(log.data)                           // raw_data
```

### Files to Modify

- `src/utils/dbClient.ts` - Add columns to schema, save raw data

---

## Issue 6: feat: Track indexed event parameters

**Labels:** `enhancement`, `database`, `priority: low`

### Problem

The database schema doesn't indicate which event parameters were indexed (stored in topics) vs non-indexed (stored in data).

### Current Implementation

```typescript
// src/utils/dbClient.ts:227 (commented out, includes indexed flag)
// const columnName = `param_${i}_${input.indexed ? 'indexed_' : ''}${input.type}`;
```

### Impact

- Cannot distinguish indexed from non-indexed parameters
- Useful metadata for understanding event structure is lost
- Some queries might benefit from knowing indexed status

### Solution Options

**Option A: Include in column name**
```sql
from_indexed_address TEXT,
to_indexed_address TEXT,
value_uint256 TEXT,
```

**Option B: Separate metadata table**
```sql
CREATE TABLE event_metadata (
  event_name TEXT,
  param_index INTEGER,
  param_name TEXT,
  param_type TEXT,
  is_indexed BOOLEAN
);
```

**Option C: Store as JSON in event table**
```sql
param_metadata TEXT,  -- {"from": {"indexed": true}, "to": {"indexed": true}, ...}
```

### Files to Modify

- `src/utils/dbClient.ts` - Add indexed tracking

---

## Issue 7: feat: Add PostgreSQL storage support

**Labels:** `enhancement`, `database`, `priority: low`

### Problem

SQLite is the only storage option. Production workloads often require PostgreSQL for:
- Better concurrent access
- Horizontal scaling
- Advanced querying (JSON operators, full-text search)
- Cloud-managed options (RDS, Cloud SQL)

### Current Implementation

```typescript
// src/utils/dbClient.ts
import { Database } from 'bun:sqlite'
const db = new Database('logs.sqlite')
```

### Solution

1. Create a database abstraction layer/interface
2. Implement SQLite adapter (current code)
3. Implement PostgreSQL adapter (using `pg` or `postgres` package)
4. Select adapter based on configuration

### Proposed Config

```json
{
  "database": {
    "type": "postgres",  // or "sqlite"
    "connection": {
      "host": "localhost",
      "port": 5432,
      "database": "bindexer",
      "user": "indexer",
      "password": "..."
    }
  }
}
```

### Database Abstraction Interface

```typescript
interface DatabaseAdapter {
  init(): Promise<void>
  createTable(schema: TableSchema): Promise<void>
  insert(table: string, data: Record<string, any>): Promise<void>
  query(table: string, options: QueryOptions): Promise<any[]>
  close(): Promise<void>
}

class SQLiteAdapter implements DatabaseAdapter { ... }
class PostgresAdapter implements DatabaseAdapter { ... }
```

### Files to Modify

- `src/utils/dbClient.ts` - Refactor to adapter pattern
- `src/utils/adapters/sqlite.ts` - New file
- `src/utils/adapters/postgres.ts` - New file
- `src/types/config.ts` - Add PostgreSQL config types
- `package.json` - Add `pg` or `postgres` dependency

---

## Priority Summary

| Issue | Priority | Effort |
|-------|----------|--------|
| #1 Hardcoded DB path | 🔴 Critical | Small |
| #2 Chain ID support | 🔴 Critical | Medium |
| #3 Block timestamp | 🔴 Critical | Medium |
| #4 ABI parameter names | 🟡 Medium | Small |
| #5 Raw event data | 🟡 Medium | Small |
| #6 Indexed parameters | 🟢 Low | Small |
| #7 PostgreSQL support | 🟢 Low | Large |
