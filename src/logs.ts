import type { AbiEvent } from 'viem'
import { saveLogToDatabase } from './utils/dbClient'
import viemClient from './utils/viemClient'

export async function setupEventWatchers(contractAddresses: string[], abis: AbiEvent[]) {
  console.log('\nSetting up event subscriptions...')

  // Array to store unwatch functions for clean shutdown
  const unwatchFunctions: (() => void)[] = []

  try {
    // Create a watch function for each contract and event combination
    for (const contractAddress of contractAddresses) {
      for (const abi of abis) {
        console.log(`Watching for ${abi.name} events on contract ${contractAddress}`)

        const unwatch = viemClient.watchContractEvent({
          address: contractAddress as `0x${string}`,
          abi: [abi],
          eventName: abi.name as string,
          onLogs: async (logs) => {
            console.log(`Received ${logs.length} ${abi.name} events from ${contractAddress}`)

            // Process and save each log to the database
            for (const log of logs) {
              try {
                await saveLogToDatabase(log, abi.name)
                console.log(`Saved log: ${log.transactionHash} (${abi.name})`)
              } catch (error) {
                console.error(
                  `Failed to save log: ${error instanceof Error ? error.message : 'Unknown error'}`
                )
              }
            }
          },
          onError: (error) => {
            console.error(
              `Subscription error for ${abi.name} on ${contractAddress}: ${error.message}`
            )
          },
        })

        unwatchFunctions.push(unwatch)
      }
    }

    console.log('All event subscriptions are active. Monitoring for events...')
    return unwatchFunctions
  } catch (error) {
    console.error(
      `Failed to set up event subscriptions: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
    throw error
  }
}
