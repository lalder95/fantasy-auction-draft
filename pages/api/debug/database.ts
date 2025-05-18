// pages/api/debug/database.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { neon } from '@neondatabase/serverless';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Get database connection
    const sql = neon(process.env.DATABASE_URL || '');
    
    // Test basic connection
    const connectionTest = await sql`SELECT 1 as connection_test`;
    
    // Get table information
    const tableInfo = await sql`
      SELECT 
        table_name, 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM 
        information_schema.tables t
      WHERE 
        table_schema = 'public' 
      ORDER BY 
        table_name
    `;
    
    // Get row counts for each table
    const tableData = [];
    for (const table of tableInfo) {
      try {
        // Dynamic SQL to count rows safely
        const countResult = await sql`
          SELECT COUNT(*) as row_count FROM ${sql(table.table_name)}
        `;
        
        tableData.push({
          tableName: table.table_name,
          columnCount: table.column_count,
          rowCount: countResult[0].row_count
        });
      } catch (countError) {
        tableData.push({
          tableName: table.table_name,
          columnCount: table.column_count,
          rowCount: 'Error counting rows',
          error: countError instanceof Error ? countError.message : String(countError)
        });
      }
    }
    
    // Get auction details if ID provided
    const { auctionId } = req.query;
    let auctionDetails = null;
    
    if (auctionId && typeof auctionId === 'string') {
      // Get auction record
      const auction = await sql`SELECT * FROM auctions WHERE id = ${auctionId}`;
      
      if (auction && auction.length > 0) {
        // Count related records
        const managerCount = await sql`SELECT COUNT(*) as count FROM managers WHERE auction_id = ${auctionId}`;
        const playerCount = await sql`SELECT COUNT(*) as count FROM available_players WHERE auction_id = ${auctionId}`;
        const playersUpCount = await sql`SELECT COUNT(*) as count FROM players_up WHERE auction_id = ${auctionId}`;
        const completedCount = await sql`SELECT COUNT(*) as count FROM completed_players WHERE auction_id = ${auctionId}`;
        
        auctionDetails = {
          id: auction[0].id,
          createdAt: auction[0].created_at,
          status: auction[0].status,
          commissionerId: auction[0].commissioner_id,
          managersCount: managerCount[0].count,
          availablePlayersCount: playerCount[0].count,
          playersUpCount: playersUpCount[0].count,
          completedPlayersCount: completedCount[0].count,
          settings: auction[0].settings
        };
      }
    }
    
    return res.status(200).json({
      success: true,
      databaseConnection: connectionTest[0].connection_test === 1,
      tables: tableData,
      auctionDetails
    });
  } catch (error) {
    console.error('Database debug error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      databaseUrl: process.env.DATABASE_URL ? 'Set (not showing for security)' : 'Not set'
    });
  }
}