import { parseArgs } from 'util'
import * as path from 'path'

// Parse command line arguments using util.parseArgs
export async function parseCommandLineArgs() {
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
        config: {
          type: 'string',
          short: 'f',
        },
      },
      strict: true,
      allowPositionals: true,
    })

    if (values.help) {
      printHelp()
      process.exit(0)
    }

    // Load config file if specified
    let configValues: any = {}
    if (values.config) {
      try {
        const configPath = path.resolve(values.config)
        const configFile = Bun.file(configPath)
        
        if (await configFile.exists()) {
          const configContent = await configFile.text()
          configValues = JSON.parse(configContent)
          console.log(`Loaded configuration from ${configPath}`)
        } else {
          console.error(`Config file not found: ${configPath}`)
          process.exit(1)
        }
      } catch (error) {
        console.error(`Error loading config file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        process.exit(1)
      }
    }

    // Extract contract addresses (CLI args take precedence over config file)
    const contractAddresses: string[] = values.contract
      ? Array.isArray(values.contract)
        ? values.contract
        : [values.contract]
      : configValues.contracts || []

    // Extract event signatures
    const eventArgs = values.event
      ? Array.isArray(values.event)
        ? values.event
        : [values.event]
      : configValues.events || []

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
    const port = parseInt(values.port || configValues.port || '3000', 10)

    // Check if API server should be started
    const startApi = values.api !== undefined ? values.api : configValues.api || false

    return { contractAddresses, eventArgs, port, startApi }
  } catch (error) {
    console.error(
      `Error parsing arguments: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    printHelp()
    process.exit(1)
  }
}

export function printHelp() {
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
  -f, --config <path>            Path to JSON config file

Example:
  bun run src/index.ts -c 0x1234567890123456789012345678901234567890 -e "Transfer(address,address,uint256)" -p 3000 -a
  bun run src/index.ts -f config.json
`)
}
