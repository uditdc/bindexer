import { parseAbiItem, type AbiEvent } from 'viem'
import { generateDatabaseSchemas } from './utils/dbClient'
import { parseArgs } from 'util'
import { startApiServer } from './server'
import { setupEventWatchers } from './logs'

// Parse command line arguments using util.parseArgs
function parseCommandLineArgs() {
  try {
    const { values } = parseArgs({
      args: Bun.argv,
      options: {
        contract: {
          type: 'string',
          short: 'c',
          multiple: true,
        },
        event: {
          type: 'string',
          short: 'e',
          multiple: true,
        },
        help: {
          type: 'boolean',
          short: 'h',
        },
        port: {
          type: 'string',
          short: 'p',
          default: '3000',
        },
        api: {
          type: 'boolean',
          short: 'a',
        },
      },
      strict: true,
      allowPositionals: true,
    })

    if (values.help) {
      printHelp()
      process.exit(0)
    }

    // Extract contract addresses
    const contractAddresses: string[] = values.contract
      ? Array.isArray(values.contract)
        ? values.contract
        : [values.contract]
      : []

    // Extract event signatures
    const eventArgs = values.event
      ? Array.isArray(values.event)
        ? values.event
        : [values.event]
      : []

    // Validate inputs
    if (contractAddresses.length === 0) {
      console.error('Error: At least one contract address is required')
      printHelp()
      process.exit(1)
    }

    if (eventArgs.length === 0) {
      console.error('Error: At least one event signature is required')
      printHelp()
      process.exit(1)
    }

    // Extract port for API server
    const port = parseInt(values.port || '3000', 10)

    // Check if API server should be started
    const startApi = values.api || false

    return { contractAddresses, eventArgs, port, startApi }
  } catch (error) {
    console.error(
      `Error parsing arguments: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    printHelp()
    process.exit(1)
  }
}

function printHelp() {
  console.log(`
Ethereum Event Monitor CLI

Usage:
  bun run src/index.ts [options]

Options:
  -c, --contract <address>       Contract address to monitor (can be used multiple times)
  -e, --event <abi-string>       Event to monitor with abi-string (provide pairs of arguments)
  -p, --port <port>              Port for the API server (default: 3000)
  -a, --api                      Start the API server
  -h, --help                     Show this help message
`)
}

async function main() {
  // Parse command line arguments
  const { contractAddresses, eventArgs, port, startApi } = parseCommandLineArgs()

  console.log('Ethereum Event Monitor Starting...')
  console.log(`Monitoring contracts: ${contractAddresses.join(', ')}`)
  console.log(`Tracking events: ${eventArgs.join(', ')}`)

  // Generate database schema based on event ABIs
  const abis = eventArgs.map((abi) => parseAbiItem(abi)) as AbiEvent[]
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
