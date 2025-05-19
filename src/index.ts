import { parseAbiItem, type AbiEvent } from 'viem'
import { generateDatabaseSchemas } from './utils/dbClient'
import { startApiServer } from './server'
import { setupEventWatchers } from './logs'
import { parseCommandLineArgs } from './cli'

/**
 * Main entry point for the Ethereum Event Monitor
 * Parses command line arguments, loads configuration, and starts the event monitor
 */
async function main() {
  // Parse command line arguments
  const { contractAddresses, eventArgs, port, startApi } = await parseCommandLineArgs()

  console.log('Ethereum Event Monitor Starting...')
  console.log(`Monitoring contracts: ${contractAddresses.join(', ')}`)
  console.log(`Tracking events: ${eventArgs.join(', ')}`)

  // Generate database schema based on event ABIs
  const abis = eventArgs.map((abi: string) => parseAbiItem(abi)) as AbiEvent[]
  generateDatabaseSchemas(abis)

  // Start API server if requested
  if (startApi) {
    await startApiServer(port, abis)
    console.log(`API server running on port ${port}`)
  }

  // Set up event watchers
  let unwatchFunctions: (() => void)[] = []
  try {
    unwatchFunctions = await setupEventWatchers(contractAddresses, abis)

    // Set up graceful shutdown
    process.on('SIGINT', () => {
      console.log('\nShutting down event monitor...')
      unwatchFunctions.forEach((unwatch) => unwatch())
      process.exit(0)
    })
  } catch (error) {
    console.error(
      `Error in main process: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    process.exit(1)
  }
}

// Only run if called directly (not imported)
if (import.meta.main) {
  main().catch(console.error)
}
