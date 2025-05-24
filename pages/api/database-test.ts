// pages/api/database-test.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { testDatabaseConnection } from '../../lib/database-neon';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const isConnected = await testDatabaseConnection();
    if (isConnected) {
      res.status(200).json({ message: 'Database connection successful' });
    } else {
      res.status(500).json({ error: 'Database connection failed' });
    }
  } catch (error) {
    console.error('Error testing database connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
