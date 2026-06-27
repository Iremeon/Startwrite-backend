import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';

import { swaggerSpec } from './config/swagger';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { globalRateLimiter } from './middlewares/rateLimiter';
import { registerMailerListeners } from './utils/mailer';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/users/users.routes';
import * as categoryRoutes from './modules/categories/categories.routes';
import * as templateRoutes from './modules/templates/templates.routes';
import { packagesRouter, walletRouter } from './modules/wallet/wallet.routes';
import { handleWebhook } from './modules/wallet/wallet.controller';
import adminRoutes from './modules/admin/admin.routes';

const app: Application = express();
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

// Domain-event listeners (email sending) registered once at boot.
registerMailerListeners();

app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

// ── Stripe webhook MUST receive the raw body for signature verification.
// This is registered BEFORE express.json() and only for this exact path. ──
app.post(`${API_PREFIX}/wallet/webhook`, express.raw({ type: 'application/json' }), handleWebhook);

// Global JSON body parser for everything else.
app.use(express.json());

// Rate limit all API traffic. Generous ceiling so normal browsing isn't
// affected; stricter, endpoint-specific limiters (auth, checkout, downloads,
// uploads) are layered on top of this in their own route files.
app.use(API_PREFIX, globalRateLimiter);

// Health check
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

// Swagger — hidden in production unless explicitly enabled.
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// ── Routes ──
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);

app.use(`${API_PREFIX}/categories`, categoryRoutes.publicRouter);
app.use(`${API_PREFIX}/admin/categories`, categoryRoutes.adminRouter);
app.use(`${API_PREFIX}/admin/subcategories`, categoryRoutes.subcategoryAdminRouter);

app.use(`${API_PREFIX}/templates`, templateRoutes.publicRouter);
app.use(`${API_PREFIX}/admin/templates`, templateRoutes.adminRouter);

app.use(`${API_PREFIX}/wallet/packages`, packagesRouter);
app.use(`${API_PREFIX}/wallet`, walletRouter);

app.use(`${API_PREFIX}/admin`, adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
