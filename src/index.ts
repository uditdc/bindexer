import { parseAbiItem, type AbiEvent } from 'viem'
import { generateDatabaseSchemas } from './utils/dbClient'
import { startApiServer } from './server'
import { setupEventWatchers, processHistoricalEvents } from './logs'
import {
  parseCommandLineArgs,
  handleInitCommand,
  handleGenerateConfigCommand,
  handleValidateCommand,
  printHelp,
} from './cli'
import type { BindexerConfig, NetworkConfig, ContractConfig, EventConfig } from './types/config'
import { logger } from './utils/logger'

/**
 * Main entry point for Bindexer
 * Enhanced with comprehensive configuration management and project templates
 */
async function main() {
  try {
    // Parse command line arguments and load configuration
    const { config, action, profile, template } = await parseCommandLineArgs()

    // Handle special commands
    switch (action) {
      case 'help':
        printHelp()
        process.exit(0)

      case 'init':
        await handleInitCommand(template)
        process.exit(0)

      case 'generate-config':
        await handleGenerateConfigCommand(template)
        process.exit(0)

      case 'validate':
        await handleValidateCommand()
        process.exit(0)

      case 'run':
        break // Continue to main execution

      default:
        console.error(`Unknown action: ${action}`)
        process.exit(1)
    }

    // Main execution with enhanced configuration
    await runIndexer(config, profile)
  } catch (error) {
    console.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    process.exit(1)
  }
}

/**
 * Run the main indexer with the provided configuration
 */
async function runIndexer(config: BindexerConfig, profile?: string) {
  // Initialize logger with configured log level
  if (config.monitoring?.logLevel) {
    logger.setLevel(config.monitoring.logLevel)
  }

  // Display startup information
  logger.info('🔗 Bindexer - Ethereum Event Indexer')
  logger.info('=====================================')

  if (config.project) {
    logger.info(`📁 Project: ${config.project}`)
  }

  if (config.environment) {
    logger.info(`🌍 Environment: ${config.environment}`)
  }

  if (profile) {
    logger.info(`📋 Profile: ${profile}`)
  }

  const networkConfig = config.network as NetworkConfig
  logger.info(`🌐 Network: ${networkConfig.name} (Chain ID: ${networkConfig.chainId})`)
  logger.info(`🔌 RPC URL: ${networkConfig.rpcUrl || networkConfig.defaultRpcUrl}`)

  const contractAddresses = (config.contracts as ContractConfig[]).map((c) => c.address)
  const contractNames = (config.contracts as ContractConfig[]).map((c) => c.name || c.address)
  logger.info(`📄 Contracts: ${contractNames.join(', ')}`)

  const eventSignatures = (config.events as EventConfig[]).map((e) => e.signature)
  const eventNames = (config.events as EventConfig[]).map((e) => e.name || e.signature)
  logger.info(`🎯 Events: ${eventNames.join(', ')}`)

  if (config.startBlock) {
    logger.info(`📊 Start block: ${config.startBlock}`)
  }

  if (config.api && typeof config.api === 'object' && config.api.enabled) {
    logger.info(`🚀 API server: http://${config.api.host || 'localhost'}:${config.api.port}`)
  }

  logger.info('=====================================')
  logger.logPhase('Bindexer Initialization', 'start')

  // Generate database schema based on event ABIs
  const abis = eventSignatures.map((signature: string) => parseAbiItem(signature)) as AbiEvent[]
  generateDatabaseSchemas(abis)

  // Start API server if requested
  if (config.api && typeof config.api === 'object' && config.api.enabled) {
    await startApiServer(config.api.port, abis)
    logger.info(`✅ API server running on port ${config.api.port}`)
  }

  logger.logPhase('Bindexer Initialization', 'complete')

  // Process historical events if a start block is specified
  if (config.startBlock) {
    await processHistoricalEvents(contractAddresses, abis, BigInt(config.startBlock))
  }

  // Set up event watchers
  let unwatchFunctions: (() => void)[] = []
  try {
    unwatchFunctions = await setupEventWatchers(contractAddresses, abis)

    // Display final status
    logger.info(
      `🎉 Bindexer is running! Monitoring ${contractAddresses.length} contract(s) for events...`
    )

    if (config.monitoring?.logLevel) {
      logger.debug(`Log level: ${config.monitoring.logLevel}`)
    }

    // Set up graceful shutdown
    process.on('SIGINT', () => {
      logger.info('\n⏹️  Shutting down Bindexer...')
      unwatchFunctions.forEach((unwatch) => unwatch())
      logger.info('✅ Shutdown complete')
      process.exit(0)
    })

    process.on('SIGTERM', () => {
      logger.info('\n⏹️  Received SIGTERM, shutting down Bindexer...')
      unwatchFunctions.forEach((unwatch) => unwatch())
      logger.info('✅ Shutdown complete')
      process.exit(0)
    })
  } catch (error) {
    logger.error(
      `❌ Error in main process: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    process.exit(1)
  }
}

// Only run if called directly (not imported)
if (import.meta.main) {
  main().catch(console.error)
}
