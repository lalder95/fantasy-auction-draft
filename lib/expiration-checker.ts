// lib/expiration-checker.ts
import axios from 'axios';

// Simple class to manage checking for expired auctions
export class ExpirationChecker {
  private auctionId: string;
  private intervalId: NodeJS.Timeout | null = null;
  private secretKey: string;
  
  constructor(auctionId: string, secretKey: string) {
    this.auctionId = auctionId;
    this.secretKey = secretKey;
  }
  
  // Start checking for expired auctions
  start(intervalMs: number = 1000) {
    // Clear any existing interval
    this.stop();
    
    // Set up new interval
    this.intervalId = setInterval(() => {
      this.checkExpiredAuctions();
    }, intervalMs);
    
    console.log(`Started expiration checker for auction ${this.auctionId} (every ${intervalMs}ms)`);
  }
  
  // Stop checking
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log(`Stopped expiration checker for auction ${this.auctionId}`);
    }
  }
  
  // Check for expired auctions
  private async checkExpiredAuctions() {
    try {
      await axios.get(`/api/auction/check-expired`, {
        params: {
          auctionId: this.auctionId,
          secretKey: this.secretKey
        }
      });
    } catch (error) {
      console.error('Error checking for expired auctions:', error);
    }
  }
}