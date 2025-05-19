import type { AbiEvent } from 'viem'
import { getLogsFromDatabase } from './utils/dbClient'

export async function startApiServer(port: number, abis: AbiEvent[]) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  const handleApiError = (error: unknown) => {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    )
  }

  const server = Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url)

      // Handle CORS preflight requests
      if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
      }

      // API endpoint to get all events
      if (url.pathname === '/api/events' && req.method === 'GET') {
        try {
          const eventName = url.searchParams.get('eventName') || ''
          const limit = url.searchParams.get('limit')
            ? parseInt(url.searchParams.get('limit')!, 10)
            : 100
          const offset = url.searchParams.get('offset')
            ? parseInt(url.searchParams.get('offset')!, 10)
            : 0

          const logs = getLogsFromDatabase(eventName, { limit, offset })

          return new Response(JSON.stringify({ success: true, data: logs }), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          })
        } catch (error) {
          return handleApiError(error)
        }
      }

      // API endpoint to get available event types
      if (url.pathname === '/api/event-types' && req.method === 'GET') {
        try {
          const eventTypes = abis.map((abi) => abi.name)

          return new Response(JSON.stringify({ success: true, data: eventTypes }), {
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          })
        } catch (error) {
          return handleApiError(error)
        }
      }

      // Default route - return 404
      return new Response('Not Found', { status: 404 })
    },
  })

  console.log(`API server started on http://localhost:${port}`)
  return server
}
