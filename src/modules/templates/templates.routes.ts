import { Router } from 'express';
import multer from 'multer';
import * as templatesController from './templates.controller';
import { ValidationMiddleware } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/authenticate';
import { requireAdmin } from '../../middlewares/authorize';
import { downloadRateLimiter, uploadRateLimiter } from '../../middlewares/rateLimiter';
import {
  listTemplatesQuerySchema,
  createTemplateSchema,
  updateTemplateSchema,
} from './templates.validation';

// In-memory storage — files are streamed straight to Cloudinary, never written to disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB ceiling for template files
});

// ── Public — mounted at /templates ──
export const publicRouter = Router();

/**
 * @swagger
 * /templates:
 *   get:
 *     summary: List/search templates
 *     tags: [Templates]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: subcategory
 *         schema: { type: string }
 *       - in: query
 *         name: class
 *         schema: { type: string, enum: [A, B, C] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of templates
 */
publicRouter.get(
  '/',
  ValidationMiddleware({ type: 'query', schema: listTemplatesQuerySchema }),
  templatesController.listTemplates,
);

/**
 * @swagger
 * /templates/{slug}:
 *   get:
 *     summary: Get template detail by slug, including its current class price
 *     tags: [Templates]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template detail (fileUrl never included — only revealed after a successful download)
 *       404:
 *         description: Template not found
 */
publicRouter.get('/:slug', templatesController.getTemplate);

/**
 * @swagger
 * /templates/{id}/download:
 *   get:
 *     summary: Download a template — deducts the template's class price from the caller's wallet balance atomically
 *     tags: [Templates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Returns the fileUrl, amountCharged, and newBalance
 *       401:
 *         description: LOGIN_REQUIRED — no token provided
 *       402:
 *         description: INSUFFICIENT_BALANCE — wallet balance is below the template's class price
 *       404:
 *         description: Template not found
 */
publicRouter.get(
  '/:id/download',
  downloadRateLimiter,
  authMiddleware,
  templatesController.downloadTemplate,
);

// ── Admin — mounted at /admin/templates ──
export const adminRouter = Router();

/**
 * @swagger
 * /admin/templates:
 *   post:
 *     summary: Create a template — uploads the file directly AND creates the record in one request
 *     tags: [Templates]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [subcategoryId, title, slug, templateClass, file]
 *             properties:
 *               subcategoryId: { type: string, format: uuid }
 *               title: { type: string, example: "Employment Offer Letter" }
 *               slug: { type: string, example: "employment-offer-letter" }
 *               description: { type: string }
 *               templateClass: { type: string, enum: [A, B, C] }
 *               file:
 *                 type: string
 *                 format: binary
 *               preview:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Template uploaded and created
 *       409:
 *         description: Slug already in use
 */
adminRouter.post(
  '/',
  authMiddleware,
  requireAdmin,
  uploadRateLimiter,
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'preview', maxCount: 1 },
  ]),
  ValidationMiddleware({ type: 'body', schema: createTemplateSchema }),
  templatesController.createTemplate,
);

/**
 * @swagger
 * /admin/templates/{id}:
 *   patch:
 *     summary: Update a template's metadata or class (admin) — does not replace the file
 *     tags: [Templates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               templateClass: { type: string, enum: [A, B, C] }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Template updated
 *   delete:
 *     summary: Soft-delete a template (admin)
 *     tags: [Templates]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Template deleted
 */
adminRouter.patch(
  '/:id',
  authMiddleware,
  requireAdmin,
  ValidationMiddleware({ type: 'body', schema: updateTemplateSchema }),
  templatesController.updateTemplate,
);

adminRouter.delete('/:id', authMiddleware, requireAdmin, templatesController.deleteTemplate);
