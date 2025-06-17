import { logger } from './logger'

// Base block defaults for different networks
const baseBlockMainnet = 17000000n
const baseBlockHolesky = 1159609n
const baseBlockSepolia = 8080000n

/**
 * Helper function to loop through blocks in batches with enhanced progress tracking
 */
export async function loopThroughBlocks(
  firstBlock: bigint,
  lastBlock: bigint,
  cb: (fromBlock: bigint, toBlock: bigint) => Promise<void>,
  defaultBatchSize?: bigint
) {
  const batchSize = defaultBatchSize ? defaultBatchSize : 1000n
  let currentBlock = firstBlock
  let nextBlock = firstBlock

  const totalBlocks = lastBlock - firstBlock + 1n
  let processedBlocks = 0n
  const startTime = Date.now()
  let batchCount = 0

  logger.info(
    `🚀 Starting batch processing: ${firstBlock} → ${lastBlock} (${Number(totalBlocks).toLocaleString()} blocks, batch size: ${batchSize})`
  )

  while (nextBlock < lastBlock) {
    nextBlock = currentBlock + batchSize
    if (nextBlock >= lastBlock) nextBlock = lastBlock

    const batchStartTime = Date.now()
    batchCount++

    try {
      await cb(currentBlock, nextBlock)

      const batchEndTime = Date.now()
      const batchDuration = batchEndTime - batchStartTime
      processedBlocks += nextBlock - currentBlock + 1n

      // Calculate progress and ETA
      const progressPercent = Number((processedBlocks * 100n) / totalBlocks)
      const elapsed = Date.now() - startTime
      const rate = Number(processedBlocks) / (elapsed / 1000) // blocks per second
      const remainingBlocks = Number(totalBlocks - processedBlocks)
      const estimatedTimeRemaining = remainingBlocks / rate // seconds

      // Smart progress logging - show progress every 10 batches or at major milestones
      if (batchCount % 10 === 0 || (progressPercent >= 10 && progressPercent % 10 < 1)) {
        logger.logProgress(
          Number(processedBlocks),
          Number(totalBlocks),
          rate,
          logger.formatDuration(estimatedTimeRemaining),
          `Batch ${batchCount}`
        )
      } else {
        logger.debug(`Batch ${batchCount}: ${batchDuration}ms | ${rate.toFixed(1)} blocks/s`)
      }
    } catch (error) {
      logger.error(
        `Error processing batch ${currentBlock}-${nextBlock}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      // Continue with next batch even if current batch fails
    }

    currentBlock = nextBlock + 1n
  }

  const totalDuration = Date.now() - startTime
  const avgRate = Number(processedBlocks) / (totalDuration / 1000)
  logger.info(
    `🏁 Batch processing completed: ${Number(processedBlocks).toLocaleString()} blocks in ${logger.formatDuration(totalDuration / 1000)} (avg: ${avgRate.toFixed(1)} blocks/s)`
  )

  return lastBlock
}
