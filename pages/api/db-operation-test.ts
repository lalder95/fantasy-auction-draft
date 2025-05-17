// pages/api/db-operation-test.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { createAuction } from '../../lib/auction';
import { saveAuction } from '../../lib/database-neon';
import { neon } from '@neondatabase/serverless';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get query parameters
    const { operation = 'test' } = req.query;
    
    // Create a connection to database
    const sql = neon(process.env.DATABASE_URL || '');
    
    // Different operations for testing
    if (operation === 'tables') {
      // Check tables
      const tables = await sql`
        SELECT table_name
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      
      return res.status(200).json({
        success: true,
        tables: tables.map(t => t.table_name)
      });
    }
    
    if (operation === 'create-minimal') {
      // Try to insert just a basic auction record
      const auctionId = `test-${Date.now()}`;
      
      await sql`
        INSERT INTO auctions (
          id, created_at, status, commissioner_id, 
          current_nomination_manager_index, settings
        )
        VALUES (
          ${auctionId}, 
          NOW(), 
          'setup', 
          'test-commissioner', 
          0, 
          '{"leagueId":"test","leagueName":"Test League","defaultBudget":200}'
        )
      `;
      
      return res.status(200).json({
        success: true,
        message: 'Minimal auction created directly',
        auctionId
      });
    }
    
    // Default operation: create full test auction
    const testAuction = createAuction(
      'test-league-id',
      'Test League',
      'test-commissioner-id'
    );
    
    // Log the auction structure before saving
    console.log('Test auction created:', {
      id: testAuction.id,
      leagueName: testAuction.settings.leagueName,
      createdAt: testAuction.createdAt,
      status: testAuction.status,
      managersCount: testAuction.managers.length,
      availablePlayersCount: testAuction.availablePlayers.length
    });
    
    // Try to save it
    await saveAuction(testAuction);
    
    return res.status(200).json({
      success: true,
      message: 'Test auction created and saved successfully',
      auctionId: testAuction.id,
      leagueName: testAuction.settings.leagueName
    });
  } catch (error) {
    console.error('Test auction operation failed:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}