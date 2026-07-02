import http from 'http';
import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { initializeAuctionSocket } from './sockets/auction.socket';
import { startAuctionLifecycleJob } from './jobs/auctionLifecycle.job';

const httpServer = http.createServer(app);

initializeAuctionSocket(httpServer);

httpServer.listen(env.PORT, () => {
  logger.info(`Backend server listening on port ${env.PORT}`);
  console.log(`Backend server listening on port ${env.PORT}`);
  startAuctionLifecycleJob();
});
