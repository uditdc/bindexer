import type { AbiEvent } from 'viem'
import { saveLogToDatabase } from './utils/dbClient'
import viemClient from './utils/viemClient'
import { loopThroughBlocks } from './utils/seeder'
import { logger } from './utils/logger'

export async function setupEventWatchers(contractAddresses: string[], abis: AbiEvent[]) {
  logger.logPhase('Real-time Event Monitoring', 'start')

  // Array to store unwatch functions for clean shutdown
  const unwatchFunctions: (() => void)[] = []

  try {
    // Create a watch function for each contract and event combination
    for (const contractAddress of contractAddresses) {
      for (const abi of abis) {
        logger.debug(`Setting up watcher: ${abi.name} on ${contractAddress.slice(0, 8)}...`)

        const unwatch = viemClient.watchContractEvent({
          address: contractAddress as `0x${string}`,
          abi: [abi],
          eventName: abi.name as string,
          onLogs: async (logs) => {
            if (logs.length > 0) {
              logger.info(
                `🔔 Received ${logs.length} ${abi.name} event(s) from ${contractAddress.slice(0, 8)}...`
              )

              // Process and save each log to the database
              let processed = 0
              let errors = 0

              for (const log of logs) {
                try {
                  await saveLogToDatabase(log, abi.name)
                  processed++
                } catch (error) {
                  errors++
                  logger.throttled(
                    'realtime_save_errors',
                    `Failed to save real-time event: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    'error'
                  )
                }
              }

              logger.info(`💾 Saved ${processed} events${errors > 0 ? ` (${errors} errors)` : ''}`)
            }
          },
          onError: (error) => {
            logger.throttled(
              'subscription_errors',
              `Event subscription error for ${abi.name}: ${error.message}`,
              'error'
            )
          },
        })

        unwatchFunctions.push(unwatch)
      }
    }

    logger.logPhase('Real-time Event Monitoring', 'complete')
    logger.info(
      `🎯 Monitoring ${contractAddresses.length} contract(s) for ${abis.length} event type(s)`
    )
    return unwatchFunctions
  } catch (error) {
    logger.error(
      `Failed to set up event subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    throw error
  }
}

/**
 * Process historical events from startBlock to current block with enhanced error handling
 */
export async function processHistoricalEvents(
  contractAddresses: string[],
  abis: AbiEvent[],
  startBlock: bigint
): Promise<void> {
  logger.logPhase('Historical Event Processing', 'start')

  // Validate inputs
  if (contractAddresses.length === 0) {
    throw new Error('No contract addresses provided')
  }
  if (abis.length === 0) {
    throw new Error('No event ABIs provided')
  }

  let currentBlock: bigint
  try {
    currentBlock = await viemClient.getBlockNumber()
  } catch (error) {
    throw new Error(
      `Failed to get current block number: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  // Validate block range
  if (startBlock > currentBlock) {
    throw new Error(
      `Start block (${startBlock}) cannot be greater than current block (${currentBlock})`
    )
  }

  const totalBlocks = Number(currentBlock - startBlock + 1n)
  logger.info(
    `📊 Historical sync: blocks ${startBlock} → ${currentBlock} (${totalBlocks.toLocaleString()} blocks)`
  )
  logger.info(
    `🎯 Monitoring ${contractAddresses.length} contract(s) × ${abis.length} event type(s) = ${contractAddresses.length * abis.length} combinations`
  )

  const startTime = Date.now()
  let batchNumber = 0

  await loopThroughBlocks(startBlock, currentBlock, async (fromBlock, toBlock) => {
    batchNumber++
    logger.debug(`Processing batch ${batchNumber}: blocks ${fromBlock} → ${toBlock}`)

    // Reset batch statistics
    logger.reset()

    // Process each contract and event combination with error handling
    for (const contractAddress of contractAddresses) {
      for (const abi of abis) {
        await processContractEventRange(contractAddress, abi, fromBlock, toBlock, batchNumber)
      }
    }
  })

  const duration = Date.now() - startTime
  logger.logPhase('Historical Event Processing', 'complete')
  logger.info(`⏱️  Total sync time: ${logger.formatDuration(duration / 1000)}`)
}

/**
 * Process events for a specific contract and event within a block range with retry logic
 */
async function processContractEventRange(
  contractAddress: string,
  abi: AbiEvent,
  fromBlock: bigint,
  toBlock: bigint,
  batchNumber: number,
  maxRetries: number = 3
): Promise<void> {
  let retryCount = 0
  const batchId = `batch_${batchNumber}_${abi.name}_${contractAddress.slice(0, 8)}`
  const startTime = Date.now()

  while (retryCount <= maxRetries) {
    try {
      // Get historical logs
      const logs = await getContractLogs(contractAddress, abi, fromBlock, toBlock)

      // Process and store logs
      for (const log of logs) {
        try {
          await processEventLog(log, abi)
        } catch (error) {
          logger.throttled(
            'process_log_errors',
            `Failed to process individual log: ${error instanceof Error ? error.message : 'Unknown error'}`,
            'error'
          )
        }
      }

      // Log batch summary using aggregated statistics
      const duration = Date.now() - startTime
      logger.logBatchSummary(batchId, contractAddress, abi.name, fromBlock, toBlock, duration)
      return // Success - exit retry loop
    } catch (error) {
      retryCount++
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check if this is a rate limit error
      if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
        if (retryCount <= maxRetries) {
          const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff: 2s, 4s, 8s
          logger.warn(
            `⏳ Rate limit hit for ${abi.name}. Retrying in ${delay / 1000}s... (attempt ${retryCount}/${maxRetries})`
          )
          await sleep(delay)
          continue
        }
      }

      // Check if this is a "too many logs" error - suggest splitting the range
      if (
        errorMessage.includes('Log response size exceeded') ||
        errorMessage.includes('too many logs')
      ) {
        if (fromBlock === toBlock) {
          logger.warn(`⚠️  Single block ${fromBlock} has too many logs for ${abi.name}. Skipping.`)
          return
        }

        // Split the range in half and process recursively
        const midBlock = fromBlock + (toBlock - fromBlock) / 2n
        logger.info(`🔀 Splitting large range ${fromBlock}-${toBlock} into smaller chunks`)

        await processContractEventRange(
          contractAddress,
          abi,
          fromBlock,
          midBlock,
          batchNumber,
          maxRetries
        )
        await processContractEventRange(
          contractAddress,
          abi,
          midBlock + 1n,
          toBlock,
          batchNumber,
          maxRetries
        )
        return
      }

      if (retryCount > maxRetries) {
        logger.error(
          `❌ Failed to process ${abi.name} at ${contractAddress.slice(0, 8)}... after ${maxRetries} retries: ${errorMessage}`
        )
        return // Don't throw - continue with next contract/event
      }

      logger.warn(
        `⚠️  Error processing ${abi.name} (attempt ${retryCount}/${maxRetries}): ${errorMessage}`
      )
      await sleep(1000 * retryCount) // Linear backoff for other errors
    }
  }
}

/**
 * Sleep utility function for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetches historical logs for a specific contract and event from the blockchain
 */
async function getContractLogs(
  contractAddress: string,
  abi: AbiEvent,
  fromBlock: bigint,
  toBlock: bigint
) {
  try {
    // Validate inputs
    if (fromBlock > toBlock) {
      throw new Error(`Invalid block range: fromBlock (${fromBlock}) > toBlock (${toBlock})`)
    }

    // Use viem's getLogs to fetch historical events
    const logs = await viemClient.getLogs({
      address: contractAddress as `0x${string}`,
      event: abi,
      fromBlock,
      toBlock,
    })

    return logs
  } catch (error) {
    // Handle specific viem errors
    if (error instanceof Error) {
      if (error.message.includes('Log response size exceeded')) {
        // If too many logs, suggest smaller block range
        throw new Error(`Too many logs for range ${fromBlock}-${toBlock}. Try smaller block range.`)
      }
      if (error.message.includes('rate limit')) {
        // Rate limit error - suggest retry with delay
        throw new Error(
          `Rate limit exceeded for range ${fromBlock}-${toBlock}. Retrying with delay...`
        )
      }
    }

    throw new Error(
      `Failed to fetch logs for ${abi.name} on contract ${contractAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Processes and stores a single event log to the database
 */
async function processEventLog(log: any, abi: AbiEvent) {
  try {
    // Validate the log structure
    if (!log || !log.transactionHash || !log.blockNumber) {
      throw new Error('Invalid log structure: missing required fields')
    }

    // Use the existing saveLogToDatabase function
    await saveLogToDatabase(log, abi.name)

    return true
  } catch (error) {
    console.error(
      `Failed to process event log: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    console.error(`Log details: ${JSON.stringify(log, null, 2)}`)
    throw error
  }
}
