// pages/api/auction/[id].ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { sql } from '../../../lib/database-neon';

// Enhanced debug helper with error handling
const debugLog = (step: string, data: any) => {
  try {
    console.log(`[DEBUG][${new Date().toISOString()}][${step}]`, 
      JSON.stringify(data, (key, value) => {
        if (value instanceof Error) {
          return {
            message: value.message,
            name: value.name,
            stack: value.stack,
            ...value
          };
        }
        return value;
      }, 2)
    );
  } catch (error) {
    console.log(`[DEBUG][${new Date().toISOString()}][ERROR LOGGING]`, 
      'Failed to stringify debug data:', error);
  }
};

// Request validation helper
const validateRequest = (req: NextApiRequest): string | null => {
  const { id } = req.query;
  const auctionId = Array.isArray(id) ? id[0] : id;
  
  if (!auctionId || typeof auctionId !== 'string') {
    return null;
  }
  return auctionId;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();
  
  try {
    // Step 1: Initial request logging
    debugLog('Request Details', {
      method: req.method,
      query: req.query,
      headers: {
        ...req.headers,
        // Redact sensitive headers
        cookie: req.headers.cookie ? '[REDACTED]' : undefined,
        authorization: req.headers.authorization ? '[REDACTED]' : undefined
      },
      url: req.url
    });

    // Step 2: Validate request
    const auctionId = validateRequest(req);
    if (!auctionId) {
      debugLog('Validation Failed', { query: req.query });
      return res.status(400).json({ message: 'Invalid auction id' });
    }

    // Step 3: Database connection check
    debugLog('DB Check Starting', { auctionId });
    try {
      await sql`SELECT 1`;
      debugLog('DB Check Success', { auctionId });
    } catch (dbError) {
      debugLog('DB Connection Failed', { error: dbError });
      throw new Error('Database connection failed');
    }

    // Step 4: Fetch basic auction data with timeout
    const queryTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Query timeout')), 5000)
    );
    
    const queryPromise = sql`
      SELECT 
        id, 
        status, 
        nomination_index,
        settings::text as settings_raw,
        COALESCE(settings::jsonb, '{}'::jsonb) as settings
      FROM auctions 
      WHERE id = ${auctionId}
    `;

    debugLog('Query Starting', { auctionId, sql: queryPromise.text });
    
    const basicAuctionQuery = await Promise.race([queryPromise, queryTimeout])
      .catch(error => {
        debugLog('Query Failed', { error, auctionId });
        throw error;
      });

    // Step 5: Process query results
    if (!basicAuctionQuery?.rows?.length) {
      debugLog('No Results', { auctionId });
      return res.status(404).json({ message: 'Auction not found' });
    }

    const auctionResult = basicAuctionQuery.rows[0];
    debugLog('Raw Result', {
      hasData: !!auctionResult,
      fields: Object.keys(auctionResult || {})
    });

    // Step 6: Build minimal response
    const response = {
      auction: {
        id: auctionResult.id,
        status: auctionResult.status || 'pending',
        settings: auctionResult.settings || {},
        nominationIndex: auctionResult.nomination_index || 0,
        availablePlayers: [],
        completedPlayers: [],
        playersUp: []
      }
    };

    debugLog('Response Ready', {
      timeMs: Date.now() - startTime,
      responseSize: JSON.stringify(response).length
    });

    return res.status(200).json(response);

  } catch (error) {
    debugLog('Fatal Error', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
      timeMs: Date.now() - startTime
    });

    // Send detailed error in development only
    const isDev = process.env.NODE_ENV === 'development';
    return res.status(500).json({
      message: 'Server error',
      ...(isDev && {
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    });
  }
}