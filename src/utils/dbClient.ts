import { Database } from 'bun:sqlite'
import type { parseAbiItem } from 'viem'
import { logger } from './logger'

// Create a SQLite database using Bun's built-in SQLite
const db = new Database('logs.sqlite')

// Function to save logs to the database with duplicate prevention
export function saveLogToDatabase(log: any, eventName: string) {
  // Now save to the event-specific table
  const tableName = `event_${eventName.toLowerCase()}`
  const logArgsArray = log.args ? Object.values(log.args) : []

  try {
    // Check if the table exists (it should if generateDatabaseSchemas was called)
    const tableExists = db
      .query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName)

    if (tableExists) {
      // Check for duplicate using transaction_hash and log_index
      const existingLog = db
        .query(`SELECT id FROM ${tableName} WHERE transaction_hash = ? AND log_index = ?`)
        .get(log.transactionHash, log.logIndex || 0)

      if (existingLog) {
        // Track duplicate statistics instead of logging each one
        logger.trackStat('current_batch', 'duplicate')
        logger.throttled(
          'duplicate_logs',
          `Skipping duplicate events (last: ${log.transactionHash?.slice(0, 10)}...)`,
          'debug'
        )
        return // Skip duplicate
      }
      // Get all columns for this table
      const columnsResult = db.query(`PRAGMA table_info(${tableName})`).all()
      const columns = columnsResult.map((col: any) => col.name)

      // Filter out the id and timestamp columns which are auto-generated
      const insertableColumns = columns.filter((col) => col !== 'id' && col !== 'timestamp')

      // Build the dynamic SQL statement
      const placeholders = insertableColumns.map(() => '?').join(', ')
      const columnList = insertableColumns.join(', ')

      const stmt = db.prepare(`
        INSERT INTO ${tableName} (${columnList})
        VALUES (${placeholders})
      `)

      // Build the values array
      const values = []

      for (const column of insertableColumns) {
        if (column === 'contract_address') {
          values.push(log.address)
        } else if (column === 'transaction_hash') {
          values.push(log.transactionHash)
        } else if (column === 'block_number') {
          values.push(log.blockNumber)
        } else if (column === 'log_index') {
          values.push(log.logIndex || 0)
        } else if (column.startsWith('param_')) {
          // Extract parameter info from column name
          // Format is param_INDEX_[indexed_]TYPE
          const parts = column.substring(6).split('_') // Remove 'param_' prefix and split
          const index = parseInt(parts[0], 10)
          const arg = logArgsArray[index]

          values.push(arg !== undefined ? formatValueForSql(arg) : null)
        } else {
          values.push(null)
        }
      }

      stmt.run(...values)

      // Track successful processing
      logger.trackStat('current_batch', 'processed')
      logger.debug(`Saved event: ${log.transactionHash?.slice(0, 10)}... (${eventName})`)
    }
  } catch (error) {
    // Track error statistics
    logger.trackStat('current_batch', 'error')
    logger.throttled(
      'db_save_errors',
      `Failed to save events to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
    // Continue execution even if event-specific table insert fails
  }
}

/**
 * Format a value for SQL storage based on its JavaScript type
 */
function formatValueForSql(value: any): any {
  if (value === null || value === undefined) {
    return null
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return JSON.stringify(value)
  }

  if (typeof value === 'bigint') {
    return value.toString()
  }

  return value
}

/**
 * Get logs from the database for a specific event
 * @param eventName The name of the event to query
 * @param options Query options including filters, limit, and offset
 * @returns Array of log entries
 */
export function getLogsFromDatabase(
  eventName: string,
  options: {
    filters?: Record<string, any>
    limit?: number
    offset?: number
    orderBy?: string
    orderDirection?: 'ASC' | 'DESC'
  } = {}
) {
  const tableName = `event_${eventName.toLowerCase()}`
  const {
    filters = {},
    limit = 100,
    offset = 0,
    orderBy = 'timestamp',
    orderDirection = 'DESC',
  } = options

  try {
    // Check if the table exists
    const tableExists = db
      .query(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
      .get(tableName)

    if (!tableExists) {
      return []
    }

    // Build the WHERE clause from filters
    let whereClause = ''
    const filterValues: any[] = []

    if (Object.keys(filters).length > 0) {
      const conditions = []

      for (const [key, value] of Object.entries(filters)) {
        conditions.push(`${key} = ?`)
        filterValues.push(formatValueForSql(value))
      }

      whereClause = `WHERE ${conditions.join(' AND ')}`
    }

    // Build and execute the query
    const query = `
      SELECT * FROM ${tableName}
      ${whereClause}
      ORDER BY ${orderBy} ${orderDirection}
      LIMIT ? OFFSET ?
    `

    const stmt = db.prepare(query)
    const results = stmt.all(...filterValues, limit, offset)

    // Parse any JSON strings in the results
    return results.map((row: any) => {
      const parsedRow: Record<string, any> = {}

      for (const [key, value] of Object.entries(row)) {
        if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
          try {
            parsedRow[key] = JSON.parse(value)
          } catch {
            parsedRow[key] = value
          }
        } else {
          parsedRow[key] = value
        }
      }

      return parsedRow
    })
  } catch (error) {
    console.error(
      `Failed to get logs from database: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    return []
  }
}

/**
 * Generates SQL table schemas based on the provided event ABIs
 * @param abis Array of parsed ABI items
 * @returns Array of SQL create table statements
 */
export function generateDatabaseSchemas(abis: ReturnType<typeof parseAbiItem>[]): string[] {
  const tableSchemas: string[] = []

  for (const abi of abis) {
    if (abi.type !== 'event') continue

    const eventName = abi.name
    const tableName = `event_${eventName.toLowerCase()}`

    let createTableSql = `CREATE TABLE IF NOT EXISTS ${tableName} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_address TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  block_number INTEGER NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP`

    // Add columns for each input in the event
    if (abi.inputs && abi.inputs.length > 0) {
      for (let i = 0; i < abi.inputs.length; i++) {
        const input = abi.inputs[i]
        // const columnName = input.name ? `param_${input.name}` : `param_${i}_${input.indexed ? 'indexed_' : ''}${input.type}`;
        const columnName = `param_${i}_${input.type}`
        let sqlType = getSqlTypeFromEthType(input.type)

        createTableSql += `,
  ${columnName} ${sqlType}`
      }
    }

    createTableSql += `
);`

    // Add indexes for better performance and duplicate prevention
    createTableSql += `\nCREATE INDEX IF NOT EXISTS idx_${tableName}_contract ON ${tableName}(contract_address);`
    createTableSql += `\nCREATE INDEX IF NOT EXISTS idx_${tableName}_block ON ${tableName}(block_number);`
    createTableSql += `\nCREATE UNIQUE INDEX IF NOT EXISTS idx_${tableName}_unique ON ${tableName}(transaction_hash, log_index);`

    tableSchemas.push(createTableSql)
  }

  // Execute all the SQL statements to create tables
  let createdCount = 0
  for (const schema of tableSchemas) {
    try {
      db.exec(schema)
      createdCount++
      const tableName = schema.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1]
      logger.debug(`Created table: ${tableName}`)
    } catch (error) {
      logger.error(
        `Failed to create schema: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  if (createdCount > 0) {
    logger.info(`📋 Database schema ready: ${createdCount} table(s) created/verified`)
  }

  return tableSchemas
}

/**
 * Maps Ethereum types to SQL data types
 * @param ethType Ethereum type from ABI
 * @returns Corresponding SQL data type
 */
function getSqlTypeFromEthType(ethType: string): string {
  // Basic mapping of Ethereum types to SQL types
  if (ethType.startsWith('uint') || ethType.startsWith('int')) {
    // For larger integers, use TEXT to avoid overflow
    if (ethType.includes('256') || ethType.includes('128')) {
      return 'TEXT'
    }
    return 'INTEGER'
  } else if (ethType === 'address') {
    return 'TEXT'
  } else if (ethType === 'bool') {
    return 'BOOLEAN'
  } else if (ethType.startsWith('bytes')) {
    return 'BLOB'
  } else if (ethType === 'string') {
    return 'TEXT'
  } else if (ethType.includes('[]')) {
    // Arrays are stored as JSON strings
    return 'TEXT'
  } else {
    // Default for unknown types
    return 'TEXT'
  }
}
