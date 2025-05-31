// pages/api/auction/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/database-neon';

// Debug helper function
const debugLog = (step: string, data: any) => {
  console.log(`[DEBUG][${new Date().toISOString()}][${step}]`, JSON.stringify(data, null, 2));
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();
  debugLog('Init', { 
    method: req.method,
    query: req.query,
    headers: req.headers,
    url: req.url
  });

  const { id } = req.query;
  const auctionId = Array.isArray(id) ? id[0] : id;

  debugLog('Params', { 
    rawId: id,
    processedAuctionId: auctionId,
    isValid: Boolean(auctionId && typeof auctionId === 'string')
  });

  if (!auctionId || typeof auctionId !== 'string') {
    return res.status(400).json({ message: 'Invalid auction id' });
  }
  
  try {
    // Step 1: Validate database connection
    try {
      debugLog('DB Connection Check', 'Starting');
      await sql`SELECT 1`;
      debugLog('DB Connection Check', 'Successful');
    } catch (dbConnError) {
      debugLog('DB Connection Error', {
        error: dbConnError instanceof Error ? {
          message: dbConnError.message,
          stack: dbConnError.stack
        } : String(dbConnError)
      });
      throw new Error('Database connection failed');
    }

    // Step 2: Get basic auction data
    debugLog('Auction Query', { attempting: auctionId });
    let basicAuctionQuery;
    try {
      const queryStartTime = Date.now();
      basicAuctionQuery = await sql`
        SELECT 
          id, 
          status, 
          nomination_index,
          settings::text as settings_raw,
          COALESCE(settings::jsonb, '{}'::jsonb) as settings
        FROM auctions 
        WHERE id = ${auctionId}
      `;
      debugLog('Query Execution Time', {
        ms: Date.now() - queryStartTime,
        rowCount: basicAuctionQuery?.rows?.length
      });
    } catch (dbError) {
      debugLog('Database Error', {
        error: dbError instanceof Error ? {
          message: dbError.message,
          name: dbError.name,
          stack: dbError.stack
        } : String(dbError),
        auctionId,
        timestamp: new Date().toISOString()
      });
      throw dbError;
    }

    // Step 3: Validate query results
    debugLog('Query Results', {
      hasRows: !!basicAuctionQuery?.rows,
      rowCount: basicAuctionQuery?.rows?.length,
      firstRow: basicAuctionQuery?.rows?.[0] ? {
        id: basicAuctionQuery.rows[0].id,
        status: basicAuctionQuery.rows[0].status,
        hasSettings: !!basicAuctionQuery.rows[0].settings,
        settingsRaw: basicAuctionQuery.rows[0].settings_raw,
        nominationIndex: basicAuctionQuery.rows[0].nomination_index
      } : null
    });

    if (!basicAuctionQuery?.rows?.length) {
      debugLog('Not Found', { auctionId });
      return res.status(404).json({ message: 'Auction not found' });
    }

    const auctionResult = basicAuctionQuery.rows[0];

    // Step 4: Process settings
    let settings;
    try {
      settings = typeof auctionResult.settings === 'object' 
        ? auctionResult.settings 
        : JSON.parse(auctionResult.settings_raw || '{}');
      
      debugLog('Settings Processed', {
        originalType: typeof auctionResult.settings,
        processedType: typeof settings,
        hasSettings: !!settings,
        keys: Object.keys(settings)
      });
    } catch (settingsError) {
      debugLog('Settings Parse Error', {
        error: settingsError instanceof Error ? settingsError.message : String(settingsError),
        raw: auctionResult.settings_raw
      });
      settings = {};
    }

    // Step 5: Build response
    const response = {
      auction: {
        id: auctionResult.id,
        status: auctionResult.status || 'pending',
        settings: {
          ...settings,
          playerCountDiagnostic: {
            totalPlayers: 0,
            availablePlayers: 0,
            expectedCount: 0,
            matchesActual: false
          }
        },
        nominationIndex: auctionResult.nomination_index || 0,
        availablePlayers: [],
        completedPlayers: [],
        playersUp: []
      }
    };

    // Final validation
    debugLog('Response Validation', {
      hasId: !!response.auction.id,
      hasStatus: !!response.auction.status,
      hasSettings: !!response.auction.settings,
      totalTime: Date.now() - startTime
    });

    return res.status(200).json(response);

  } catch (error) {
    debugLog('Fatal Error', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      auctionId,
      totalTime: Date.now() - startTime
    });

    return res.status(500).json({ 
      message: 'Server error',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
}