import { parseArgs } from 'util'
import * as path from 'path'
import * as fs from 'fs'
import { ConfigManager, ConfigValidationError } from './utils/configManager'
import type { CLIConfig, BindexerConfig } from './types/config'
import { DEFAULT_NETWORKS } from './types/config'

export interface ParsedCLIArgs {
  config: BindexerConfig
  action: 'run' | 'init' | 'generate-config' | 'validate' | 'help'
  profile?: string
  template?: string
}

// Parse command line arguments with enhanced configuration support
export async function parseCommandLineArgs(): Promise<ParsedCLIArgs> {
  try {
    const { values, positionals } = parseArgs({
      args: Bun.argv,
      options: {
        // Core options
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
        network: {
          type: 'string',
          short: 'n',
        },
        startBlock: {
          type: 'string',
          short: 's',
        },

        // API options
        api: {
          type: 'boolean',
          short: 'a',
        },
        port: {
          type: 'string',
          short: 'p',
        },
        host: {
          type: 'string',
        },

        // Config management
        config: {
          type: 'string',
          short: 'f',
        },
        profile: {
          type: 'string',
        },

        // Generation options
        init: {
          type: 'boolean',
        },
        generateConfig: {
          type: 'boolean',
        },
        template: {
          type: 'string',
          short: 't',
        },

        // Database options
        database: {
          type: 'string',
          short: 'd',
        },

        // Monitoring options
        logLevel: {
          type: 'string',
        },
        quiet: {
          type: 'boolean',
          short: 'q',
        },
        verbose: {
          type: 'boolean',
          short: 'v',
        },

        // Utility options
        validate: {
          type: 'boolean',
        },
        help: {
          type: 'boolean',
          short: 'h',
        },
        version: {
          type: 'boolean',
          short: 'V',
        },
      },
      strict: false, // Allow unknown options for flexibility
      allowPositionals: true,
    })

    // Handle special actions first
    if (values.help) {
      return { config: {} as BindexerConfig, action: 'help' }
    }

    if (values.version) {
      console.log('Bindexer v1.0.0')
      process.exit(0)
    }

    if (values.init) {
      return {
        config: {} as BindexerConfig,
        action: 'init',
        template: typeof values.template === 'string' ? values.template : undefined,
      }
    }

    if (values.generateConfig) {
      return {
        config: {} as BindexerConfig,
        action: 'generate-config',
        template: typeof values.template === 'string' ? values.template : undefined,
      }
    }

    if (values.validate) {
      return {
        config: {} as BindexerConfig,
        action: 'validate',
      }
    }

    // Load base configuration (skip for special commands)
    let config: BindexerConfig
    try {
      const configPath = typeof values.config === 'string' ? values.config : undefined

      // For normal operation, load existing config
      config = await ConfigManager.loadConfig(configPath)
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        console.error('Configuration Error:', error.message)
        process.exit(1)
      }
      throw error
    }

    // Apply CLI overrides
    const cliConfig: Partial<CLIConfig> = {
      configPath: typeof values.config === 'string' ? values.config : undefined,
      profile: typeof values.profile === 'string' ? values.profile : undefined,
    }

    // Override with CLI arguments
    if (values.contract && typeof values.contract !== 'boolean') {
      const contracts = Array.isArray(values.contract) ? values.contract : [values.contract]
      cliConfig.contracts = contracts.filter((c): c is string => typeof c === 'string')
    }

    if (values.event && typeof values.event !== 'boolean') {
      const events = Array.isArray(values.event) ? values.event : [values.event]
      cliConfig.events = events.filter((e): e is string => typeof e === 'string')
    }

    if (values.network && typeof values.network !== 'boolean') {
      cliConfig.network = values.network
    }

    if (values.startBlock && typeof values.startBlock !== 'boolean') {
      cliConfig.startBlock = parseInt(values.startBlock, 10)
    }

    if (typeof values.api === 'boolean') {
      const portStr = typeof values.port === 'string' ? values.port : '3000'
      cliConfig.api = { enabled: values.api, port: parseInt(portStr, 10) }
    }

    if (values.port && typeof values.port === 'string') {
      if (typeof cliConfig.api === 'object') {
        cliConfig.api.port = parseInt(values.port, 10)
      } else {
        cliConfig.api = { enabled: true, port: parseInt(values.port, 10) }
      }
    }

    if (values.host && typeof values.host === 'string') {
      if (typeof cliConfig.api === 'object') {
        cliConfig.api.host = values.host
      } else {
        cliConfig.api = { enabled: true, port: 3000, host: values.host }
      }
    }

    if (values.database && typeof values.database === 'string') {
      cliConfig.database = { path: values.database }
    }

    if (values.logLevel && typeof values.logLevel === 'string') {
      cliConfig.monitoring = {
        progressTracking: true,
        logLevel: values.logLevel as any,
      }
    }

    if (values.quiet) {
      cliConfig.monitoring = {
        progressTracking: true,
        logLevel: 'error',
      }
    }

    if (values.verbose) {
      cliConfig.monitoring = {
        progressTracking: true,
        logLevel: 'debug',
      }
    }

    // Merge CLI overrides with loaded config
    const finalConfig = ConfigManager.mergeConfigs(config, cliConfig) as BindexerConfig

    // Apply profile if specified
    if (
      values.profile &&
      typeof values.profile === 'string' &&
      finalConfig.profiles?.[values.profile]
    ) {
      const profileConfig = finalConfig.profiles[values.profile]
      const mergedConfig = ConfigManager.mergeConfigs(finalConfig, profileConfig) as BindexerConfig
      return {
        config: ConfigManager.normalizeConfig(mergedConfig),
        action: 'run',
        profile: values.profile,
      }
    }

    // Final validation
    try {
      const validatedConfig = ConfigManager.validateConfig(finalConfig)
      return {
        config: ConfigManager.normalizeConfig(validatedConfig),
        action: 'run',
      }
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        console.error('\n❌ Configuration Validation Failed:')
        console.error(error.message)
        console.error('\n💡 Run `bindexer --help` for usage information')
        console.error('💡 Run `bindexer --init` to create a new configuration')
        process.exit(1)
      }
      throw error
    }
  } catch (error) {
    console.error(
      `Error parsing arguments: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    printHelp()
    process.exit(1)
  }
}

export async function handleInitCommand(template?: string): Promise<void> {
  console.log('🚀 Initializing new Bindexer project...\n')

  // Check if config already exists
  const existingConfig = await ConfigManager.discoverConfigFile()
  if (existingConfig) {
    console.log(`⚠️  Configuration file already exists: ${existingConfig}`)
    console.log('Use --generate-config to create a new one or --config to specify a different path')
    return
  }

  // Generate default config
  const config = ConfigManager.generateDefaultConfig(template)
  const configPath = 'bindexer.config.json'

  // Write config file
  await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2))

  console.log(`✅ Created configuration file: ${configPath}`)
  console.log('\n📝 Next steps:')
  console.log('1. Edit the configuration file to specify your contracts and events')
  console.log('2. Set your RPC URL: export RPC_URL="your-rpc-endpoint"')
  console.log('3. Run: bun run src/index.ts')
  console.log('\n📖 Documentation: https://github.com/uditdc/bindexer#readme')
}

export async function handleGenerateConfigCommand(template?: string): Promise<void> {
  try {
    const config = ConfigManager.generateDefaultConfig(template)
    console.log(JSON.stringify(config, null, 2))
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error('❌ Template Error:', error.message)
      process.exit(1)
    }
    throw error
  }
}

export async function handleValidateCommand(): Promise<void> {
  try {
    const configPath = await ConfigManager.discoverConfigFile()
    if (!configPath) {
      console.error('❌ No configuration file found')
      console.log('💡 Run `bindexer --init` to create a new configuration')
      process.exit(1)
    }

    const config = await ConfigManager.loadConfig(configPath)
    ConfigManager.validateConfig(config)

    console.log('✅ Configuration is valid')
    console.log(`📁 Config file: ${configPath}`)
    console.log(
      `🌐 Network: ${typeof config.network === 'string' ? config.network : config.network.name}`
    )
    console.log(`📄 Contracts: ${config.contracts.length}`)
    console.log(`🎯 Events: ${config.events.length}`)
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error('❌ Configuration validation failed:')
      console.error(error.message)
      process.exit(1)
    }
    throw error
  }
}

export function printHelp() {
  const networks = Object.keys(DEFAULT_NETWORKS).join(', ')

  // Get available templates
  let templatesText = ''
  try {
    const { listTemplates } = require('./templates/index')
    const templates = listTemplates()
    templatesText = templates.map((t: any) => `${t.name.padEnd(15)} ${t.description}`).join('\n  ')
  } catch {
    templatesText = 'Templates not available'
  }

  console.log(`
🔗 Bindexer - Ethereum Event Indexer CLI

USAGE:
  bindexer [COMMAND] [OPTIONS]

COMMANDS:
  (default)                      Start the event indexer
  --init [--template=<name>]     Initialize a new project with config file
  --generate-config              Generate config to stdout
  --validate                     Validate existing configuration
  --help                         Show this help message
  --version                      Show version information

CORE OPTIONS:
  -c, --contract <address>       Contract address to monitor (multiple allowed)
  -e, --event <signature>        Event signature to monitor (multiple allowed)
  -n, --network <name>           Network to use (${networks})
  -s, --startBlock <number>      Starting block for historical sync

CONFIG OPTIONS:
  -f, --config <path>            Path to config file (auto-discovery if not specified)
  --profile <name>               Use specific config profile/environment
  -t, --template <name>          Template to use for --init command

API OPTIONS:
  -a, --api                      Enable API server
  -p, --port <number>            API server port (default: 3000)
  --host <address>               API server host (default: localhost)

DATABASE OPTIONS:
  -d, --database <path>          Database file path (default: logs.sqlite)

MONITORING OPTIONS:
  --logLevel <level>             Log level: debug, info, warn, error
  -v, --verbose                  Enable verbose logging (debug level)
  -q, --quiet                    Enable quiet mode (error level only)

EXAMPLES:
  # Quick start with CLI arguments
  bindexer -c 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 \\
           -e "Transfer(address indexed,address indexed,uint256)" \\
           -n mainnet -a

  # Initialize new project with template
  bindexer --init --template=erc20
  bindexer --init --template=uniswap-v3

  # Use config file
  bindexer --config=./my-project.json

  # Use specific environment profile
  bindexer --profile=production

  # Validate configuration
  bindexer --validate

CONFIGURATION:
  Bindexer looks for config files in this order:
  1. --config specified path
  2. bindexer.config.json
  3. .bindexerrc
  4. .bindexerrc.json
  5. package.json (bindexer field)

ENVIRONMENT VARIABLES:
  BINDEXER_NETWORK              Default network
  BINDEXER_RPC_URL              RPC endpoint URL
  BINDEXER_START_BLOCK          Starting block number
  BINDEXER_API_PORT             API server port
  BINDEXER_DATABASE_PATH        Database file path
  BINDEXER_LOG_LEVEL            Logging level
  RPC_URL                       RPC endpoint (alias for BINDEXER_RPC_URL)

TEMPLATES:
  ${templatesText}

NETWORKS:
  ${Object.entries(DEFAULT_NETWORKS)
    .map(
      ([name, config]) => `${name.padEnd(12)} Chain ID ${config.chainId} - ${config.defaultRpcUrl}`
    )
    .join('\n  ')}

For more information, visit: https://github.com/uditdc/bindexer
`)
}
