import { Router } from 'express';
import authRoutes from './auth.routes';
import leadRoutes from './lead.routes';
import campaignRoutes from './campaign.routes';
import telnyxRoutes from './telnyx.routes';

const router = Router();

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/leads', leadRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/telnyx', telnyxRoutes);

// Additional routes will be mounted here
// router.use('/calls', callRoutes);
// router.use('/analytics', analyticsRoutes);

export default router;
