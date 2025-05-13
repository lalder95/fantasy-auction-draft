// lib/email.ts
import sgMail from '@sendgrid/mail';
import { Auction, getAuctionResults, generateAuctionUrls } from './auction';

// Initialize SendGrid with API key
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Send auction URLs to commissioner
 */
export async function sendAuctionUrls(
  auction: Auction,
  commissionerEmail: string,
  baseUrl: string
): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not set');
      return false;
    }
    
    const urls = generateAuctionUrls(auction, baseUrl);
    
    // Create HTML for manager URLs
    const managerUrlsHtml = urls.managers.map(manager => 
      `<tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${manager.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">
          <a href="${manager.url}" target="_blank">${manager.url}</a>
        </td>
      </tr>`
    ).join('');
    
    const htmlContent = `
      <h1>Fantasy Football Auction URLs</h1>
      <p>Hello Commissioner,</p>
      <p>Your auction "${auction.settings.leagueName}" is ready! Below are the URLs for each manager:</p>
      
      <h3>Commissioner Access URL:</h3>
      <p><a href="${urls.commissioner}" target="_blank">${urls.commissioner}</a></p>
      
      <h3>Manager Access URLs:</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr>
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Manager</th>
          <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">URL</th>
        </tr>
        ${managerUrlsHtml}
      </table>
      
      <h3>Viewer URL (Read-only):</h3>
      <p><a href="${urls.viewer}" target="_blank">${urls.viewer}</a></p>
      
      <p>Please send each manager their respective URL. They will use this URL to access the auction.</p>
      <p>Good luck with your auction!</p>
    `;
    
    const msg = {
      to: commissionerEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@fantasydraft.com',
      subject: `Fantasy Football Auction URLs - ${auction.settings.leagueName}`,
      html: htmlContent,
    };
    
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending auction URLs email:', error);
    return false;
  }
}

/**
 * Send auction results to commissioner
 */
export async function sendAuctionResults(
  auction: Auction,
  commissionerEmail: string
): Promise<boolean> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not set');
      return false;
    }
    
    const results = getAuctionResults(auction);
    
    // Group results by position
    const resultsByPosition: Record<string, typeof results> = {};
    results.forEach(result => {
      if (!resultsByPosition[result.position]) {
        resultsByPosition[result.position] = [];
      }
      resultsByPosition[result.position].push(result);
    });
    
    // Create HTML for results by position
    let positionResultsHtml = '';
    for (const [position, players] of Object.entries(resultsByPosition)) {
      // Sort by bid amount (highest first)
      const sortedPlayers = [...players].sort((a, b) => b.winningBid - a.winningBid);
      
      positionResultsHtml += `
        <h3>${position}</h3>
        <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
          <tr>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Player</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Team</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Winning Bid</th>
            <th style="padding: 8px; text-align: left; border: 1px solid #ddd; background-color: #f2f2f2;">Manager</th>
          </tr>
          ${sortedPlayers.map(player => `
            <tr>
              <td style="padding: 8px; border: 1px solid #ddd;">${player.playerName}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${player.team}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">$${player.winningBid}</td>
              <td style="padding: 8px; border: 1px solid #ddd;">${player.winningManager}</td>
            </tr>
          `).join('')}
        </table>
      `;
    }
    
    // Create HTML for results by manager
    const resultsByManager: Record<string, typeof results> = {};
    results.forEach(result => {
      if (!resultsByManager[result.winningManager]) {
        resultsByManager[result.winningManager] = [];
      }
      resultsByManager[result.winningManager].push(result);
    });
    
    let managerResultsHtml = '';
    for (const [manager, players] of Object.entries(resultsByManager)) {
      // Calculate total spent
      const totalSpent = players.reduce((sum, player) => sum + player.winningBid, 0);
      
      // Group by position
      const playersByPosition: Record<string, typeof results> = {};
      players.forEach(player => {
        if (!playersByPosition[player.position]) {
          playersByPosition[player.position] = [];
        }
        playersByPosition[player.position].push(player);
      });
      
      let positionHtml = '';
      for (const [position, posPlayers] of Object.entries(playersByPosition)) {
        positionHtml += `
          <h4>${position}</h4>
          <ul>
            ${posPlayers.map(player => `
              <li>${player.playerName} (${player.team}) - $${player.winningBid}</li>
            `).join('')}
          </ul>
        `;
      }
      
      managerResultsHtml += `
        <h3>${manager} - Total Spent: $${totalSpent}</h3>
        ${positionHtml}
      `;
    }
    
    const htmlContent = `
      <h1>Fantasy Football Auction Results</h1>
      <p>Hello Commissioner,</p>
      <p>The auction "${auction.settings.leagueName}" is complete! Here are the results:</p>
      
      <h2>Results by Position</h2>
      ${positionResultsHtml}
      
      <h2>Results by Manager</h2>
      ${managerResultsHtml}
      
      <p>Thank you for using our Fantasy Football Auction platform!</p>
    `;
    
    const msg = {
      to: commissionerEmail,
      from: process.env.SENDGRID_FROM_EMAIL || 'noreply@fantasydraft.com',
      subject: `Fantasy Football Auction Results - ${auction.settings.leagueName}`,
      html: htmlContent,
    };
    
    await sgMail.send(msg);
    return true;
  } catch (error) {
    console.error('Error sending auction results email:', error);
    return false;
  }
}