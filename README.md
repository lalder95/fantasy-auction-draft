# Fantasy Football Auction Draft Platform

![Fantasy Football Auction Draft](https://img.shields.io/badge/Fantasy-Football-brightgreen)
![Sleeper API Integration](https://img.shields.io/badge/Sleeper-API-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.x-black)
![Vercel](https://img.shields.io/badge/Vercel-Deployed-black)

A highly customizable auction draft platform for fantasy football leagues on Sleeper. Run live auction drafts with complete commissioner control, real-time bidding, and extensive customization options.

## 🏈 Features

### Commissioner Controls
- Create custom auction drafts for your Sleeper league
- Set custom budgets per team
- Configure auction completion based on nomination rounds or players won
- Control nomination order, duration, and format
- Pause/resume the auction at any time
- Add/remove time to nominations
- Cancel bids or remove players from the auction
- Force nominations or bids on behalf of managers

### Manager Experience
- Real-time bidding interface with instant updates
- Create nomination queues to prepare for your turn
- Track your budget and acquired players
- Access through unique manager-specific URLs
- Pass on players you're not interested in

### Customization Options
- Blind bidding format (hide current high bidder)
- Set minimum/maximum players per team
- Multiple simultaneous nominations
- Customizable nomination durations
- Auto-nomination options for missed turns

### Connectivity
- Automatic integration with Sleeper league data
- Email delivery of auction URLs and results
- Read-only viewer mode for spectators

## 💻 Technology Stack

- **Frontend**: React, Next.js, Tailwind CSS
- **Backend**: Next.js API Routes, Socket.IO for real-time bidding
- **Database**: Vercel KV (Redis)
- **Deployment**: Vercel
- **APIs**: Sleeper API, SendGrid for emails

## 🚀 Getting Started

### Prerequisites

- Node.js 14.x or later
- npm or yarn
- A Sleeper account and league
- Vercel account (for deployment)

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/fantasy-auction-draft.git
   cd fantasy-auction-draft
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory with:
   ```
   # For email functionality
   SENDGRID_API_KEY=your_sendgrid_api_key
   SENDGRID_FROM_EMAIL=your_verified_email
   
   # For database (if using Upstash Redis)
   UPSTASH_REDIS_REST_URL=your_upstash_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_token
   ```

4. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Open your browser**
   Navigate to http://localhost:3000

### Deployment on Vercel

1. **Push your code to GitHub**

2. **Connect to Vercel**
   - Create a Vercel account if you don't have one
   - Import your GitHub repository
   - Add the required environment variables
   - Deploy

3. **Setup Upstash Redis Integration**
   - In Vercel, go to your project
   - Click on "Integrations" and add "Upstash Redis"
   - Follow the setup steps

## 📖 How to Use

### For Commissioners

1. Go to the website and click "Create New Auction"
2. Enter your Sleeper league ID
3. Configure managers, budgets, and auction rules
4. Select players to include in the auction
5. Share the generated URLs with your league managers
6. Start the auction when everyone is ready
7. Use commissioner controls as needed during the auction
8. When complete, the auction results will be emailed to you

### For Managers

1. Use the URL provided by your commissioner
2. Create a nomination queue for when it's your turn
3. Place bids on players you want to acquire
4. Pass on players you're not interested in
5. Keep track of your remaining budget and acquired players

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- [Sleeper API](https://docs.sleeper.app/) for league data
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Vercel](https://vercel.com/) for hosting and KV database
- [Socket.IO](https://socket.io/) for real-time functionality


---

Made with ❤️ for fantasy football enthusiasts!
#BearDown
#NFL