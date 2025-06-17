/**
 * Enhanced logging system with smart aggregation and progress indicators
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogStats {
  duplicates: number
  processed: number
  errors: number
  lastUpdate: number
}

interface ThrottledMessage {
  message: string
  count: number
  lastShown: number
  throttleMs: number
}

export class Logger {
  private level: LogLevel = 'info'
  private stats: Map<string, LogStats> = new Map()
  private throttledMessages: Map<string, ThrottledMessage> = new Map()
  private readonly THROTTLE_INTERVAL = 5000 // 5 seconds
  private readonly PROGRESS_INTERVAL = 10 // Show progress every N batches

  constructor(level: LogLevel = 'info') {
    this.level = level
  }

  setLevel(level: LogLevel) {
    this.level = level
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.level)
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString().substr(11, 8)
    const levelEmoji = {
      debug: '🔍',
      info: '💡',
      warn: '⚠️',
      error: '❌',
    }
    return `${timestamp} ${levelEmoji[level]} ${message}`
  }

  debug(message: string) {
    if (this.shouldLog('debug')) {
      console.log(this.formatMessage('debug', message))
    }
  }

  info(message: string) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message))
    }
  }

  warn(message: string) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message))
    }
  }

  error(message: string) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message))
    }
  }

  /**
   * Log a message with smart throttling to prevent spam
   */
  throttled(
    key: string,
    message: string,
    level: LogLevel = 'info',
    throttleMs = this.THROTTLE_INTERVAL
  ) {
    const now = Date.now()
    const existing = this.throttledMessages.get(key)

    if (!existing) {
      // First time seeing this message
      this.throttledMessages.set(key, {
        message,
        count: 1,
        lastShown: now,
        throttleMs,
      })
      this.log(level, message)
    } else {
      existing.count++
      if (now - existing.lastShown > throttleMs) {
        // Time to show the message again
        if (existing.count > 1) {
          this.log(
            level,
            `${message} (${existing.count} occurrences in last ${throttleMs / 1000}s)`
          )
        } else {
          this.log(level, message)
        }
        existing.lastShown = now
        existing.count = 0
      }
    }
  }

  private log(level: LogLevel, message: string) {
    switch (level) {
      case 'debug':
        this.debug(message)
        break
      case 'info':
        this.info(message)
        break
      case 'warn':
        this.warn(message)
        break
      case 'error':
        this.error(message)
        break
    }
  }

  /**
   * Track statistics for batch operations
   */
  trackStat(key: string, type: 'duplicate' | 'processed' | 'error') {
    const stat = this.stats.get(key) || {
      duplicates: 0,
      processed: 0,
      errors: 0,
      lastUpdate: Date.now(),
    }

    switch (type) {
      case 'duplicate':
        stat.duplicates++
        break
      case 'processed':
        stat.processed++
        break
      case 'error':
        stat.errors++
        break
    }

    stat.lastUpdate = Date.now()
    this.stats.set(key, stat)
  }

  /**
   * Get and optionally reset statistics
   */
  getStats(key: string, reset = false): LogStats | null {
    const stats = this.stats.get(key)
    if (reset && stats) {
      this.stats.delete(key)
    }
    return stats || null
  }

  /**
   * Log batch summary with aggregated statistics
   */
  logBatchSummary(
    batchId: string,
    contractAddress: string,
    eventName: string,
    fromBlock: bigint,
    toBlock: bigint,
    duration: number
  ) {
    const stats = this.getStats(batchId, true)
    if (!stats) return

    const total = stats.processed + stats.duplicates
    const rate = total / (duration / 1000)

    let summary = `📊 Batch complete: ${stats.processed} new events`

    if (stats.duplicates > 0) {
      summary += `, ${stats.duplicates} duplicates`
    }

    if (stats.errors > 0) {
      summary += `, ${stats.errors} errors`
    }

    summary += ` | ${eventName}@${contractAddress.slice(0, 8)}... | Blocks ${fromBlock}-${toBlock} | ${duration}ms (${rate.toFixed(1)} events/s)`

    this.info(summary)
  }

  /**
   * Log progress with smart intervals
   */
  logProgress(current: number, total: number, rate: number, eta: string, details?: string) {
    const percent = (current / total) * 100

    // Only show progress at meaningful intervals
    if (percent % 5 < 0.1 || current === total) {
      const progressBar = this.createProgressBar(percent)
      let message = `📈 Progress: ${progressBar} ${percent.toFixed(1)}% (${current.toLocaleString()}/${total.toLocaleString()})`

      if (rate > 0) {
        message += ` | ${rate.toFixed(1)} blocks/s`
      }

      if (eta && current < total) {
        message += ` | ETA: ${eta}`
      }

      if (details) {
        message += ` | ${details}`
      }

      this.info(message)
    }
  }

  /**
   * Create a visual progress bar
   */
  private createProgressBar(percent: number, width = 20): string {
    const filled = Math.round((percent / 100) * width)
    const empty = width - filled
    return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`
  }

  /**
   * Log milestone messages
   */
  logMilestone(message: string, emoji = '🎯') {
    this.info(`${emoji} ${message}`)
  }

  /**
   * Log phase transitions
   */
  logPhase(phase: string, status: 'start' | 'complete' | 'error' = 'start') {
    const emojis = {
      start: '🚀',
      complete: '✅',
      error: '❌',
    }

    const statusText = {
      start: 'Starting',
      complete: 'Completed',
      error: 'Failed',
    }

    this.info(`${emojis[status]} ${statusText[status]}: ${phase}`)
  }

  /**
   * Log session summary
   */
  logSessionSummary(
    totalEvents: number,
    totalDuplicates: number,
    totalErrors: number,
    duration: number,
    networkInfo?: string
  ) {
    this.info('='.repeat(60))
    this.logPhase('Session Summary', 'complete')

    this.info(`📊 Events processed: ${totalEvents.toLocaleString()}`)
    if (totalDuplicates > 0) {
      this.info(`🔄 Duplicates skipped: ${totalDuplicates.toLocaleString()}`)
    }
    if (totalErrors > 0) {
      this.info(`⚠️  Errors encountered: ${totalErrors.toLocaleString()}`)
    }

    this.info(`⏱️  Total duration: ${this.formatDuration(duration / 1000)}`)

    if (totalEvents > 0) {
      const rate = totalEvents / (duration / 1000)
      this.info(`📈 Average rate: ${rate.toFixed(1)} events/second`)
    }

    if (networkInfo) {
      this.info(`🌐 Network: ${networkInfo}`)
    }

    this.info('='.repeat(60))
  }

  /**
   * Format duration in a human-readable way
   */
  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`
    } else if (seconds < 3600) {
      const mins = Math.floor(seconds / 60)
      const secs = Math.floor(seconds % 60)
      return `${mins}m ${secs}s`
    } else {
      const hours = Math.floor(seconds / 3600)
      const mins = Math.floor((seconds % 3600) / 60)
      return `${hours}h ${mins}m`
    }
  }

  /**
   * Clear all statistics and throttled messages
   */
  reset() {
    this.stats.clear()
    this.throttledMessages.clear()
  }
}

// Global logger instance
export const logger = new Logger()

// Convenience functions
export const setLogLevel = (level: LogLevel) => logger.setLevel(level)
export const logDebug = (message: string) => logger.debug(message)
export const logInfo = (message: string) => logger.info(message)
export const logWarn = (message: string) => logger.warn(message)
export const logError = (message: string) => logger.error(message)
export const logThrottled = (key: string, message: string, level: LogLevel = 'info') =>
  logger.throttled(key, message, level)
export const logMilestone = (message: string, emoji?: string) => logger.logMilestone(message, emoji)
export const logPhase = (phase: string, status?: 'start' | 'complete' | 'error') =>
  logger.logPhase(phase, status)
