import { Router } from 'express';
import * as categoriesController from './categories.controller';
import { ValidationMiddleware } from '../../middlewares/validate';
import { authMiddleware } from '../../middlewares/authenticate';
import { requireAdmin } from '../../middlewares/authorize';
import {
  createCategorySchema,
  updateCategorySchema,
  createSubcategorySchema,
  updateSubcategorySchema,
} from './categories.validation';

// ── Public — mounted at /categories ──
export const publicRouter = Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: List all active categories with nested subcategories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories
 */
publicRouter.get('/', categoriesController.listCategories);

/**
 * @swagger
 * /categories/{slug}:
 *   get:
 *     summary: Get a category by slug, with its subcategories
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: slug
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category detail
 *       404:
 *         description: Category not found
 */
publicRouter.get('/:slug', categoriesController.getCategory);

// ── Admin — mounted at /admin/categories ──
export const adminRouter = Router();

/**
 * @swagger
 * /admin/categories:
 *   post:
 *     summary: Create a category (admin)
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               iconUrl: { type: string }
 *               displayOrder: { type: integer }
 *     responses:
 *       201:
 *         description: Category created
 *       409:
 *         description: Slug already in use
 */
adminRouter.post(
  '/',
  authMiddleware,
  requireAdmin,
  ValidationMiddleware({ type: 'body', schema: createCategorySchema }),
  categoriesController.createCategory,
);

/**
 * @swagger
 * /admin/categories/{id}:
 *   patch:
 *     summary: Update a category (admin)
 *     tags: [Categories]
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
 *               name: { type: string }
 *               slug: { type: string }
 *               description: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Category updated
 *   delete:
 *     summary: Soft-delete a category (admin)
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Category deleted
 */
adminRouter.patch(
  '/:id',
  authMiddleware,
  requireAdmin,
  ValidationMiddleware({ type: 'body', schema: updateCategorySchema }),
  categoriesController.updateCategory,
);

adminRouter.delete('/:id', authMiddleware, requireAdmin, categoriesController.deleteCategory);

/**
 * @swagger
 * /admin/categories/{id}/subcategories:
 *   post:
 *     summary: Create a subcategory under a category (admin)
 *     tags: [Categories]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug]
 *             properties:
 *               name: { type: string }
 *               slug: { type: string }
 *               displayOrder: { type: integer }
 *     responses:
 *       201:
 *         description: Subcategory created
 */
adminRouter.post(
  '/:id/subcategories',
  authMiddleware,
  requireAdmin,
  ValidationMiddleware({ type: 'body', schema: createSubcategorySchema }),
  categoriesController.createSubcategory,
);

// Subcategory update/delete operate on a subcategory id directly, mounted
// at /admin/subcategories in app.ts (see §8.3 of the spec).
export const subcategoryAdminRouter = Router();

subcategoryAdminRouter.patch(
  '/:id',
  authMiddleware,
  requireAdmin,
  ValidationMiddleware({ type: 'body', schema: updateSubcategorySchema }),
  categoriesController.updateSubcategory,
);

subcategoryAdminRouter.delete(
  '/:id',
  authMiddleware,
  requireAdmin,
  categoriesController.deleteSubcategory,
);
