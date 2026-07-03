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
import userRoutes, { adminUsersRouter } from './modules/users/users.routes';
import * as categoryRoutes from './modules/categories/categories.routes';
import * as templateRoutes from './modules/templates/templates.routes';
import { packagesRouter, walletRouter } from './modules/wallet/wallet.routes';
import { handleWebhook } from './modules/wallet/wallet.controller';
import adminRoutes from './modules/admin/admin.routes';

const app: Application = express();
const API_PREFIX = process.env.API_PREFIX || '/api/v1';

registerMailerListeners();

app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.post(`${API_PREFIX}/wallet/webhook`, express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json());

app.use(API_PREFIX, globalRateLimiter);

app.get('/health', (_req, res) => res.status(200).json({ status: 'ok' }));

if (process.env.NODE_ENV !== 'production') {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// ── Routes ──
app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/users`, userRoutes);
app.use(`${API_PREFIX}/admin/users`, adminUsersRouter);

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