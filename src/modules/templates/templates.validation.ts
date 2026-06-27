import Joi from 'joi';

export const listTemplatesQuerySchema = Joi.object({
  category: Joi.string().optional(),
  subcategory: Joi.string().optional(),
  class: Joi.string().valid('A', 'B', 'C').optional(),
  search: Joi.string().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

// Used by the merged upload+create endpoint — these are the multipart text
// fields that accompany the uploaded file. fileUrl/fileType are NOT here:
// they're computed server-side from the actual uploaded file.
export const createTemplateSchema = Joi.object({
  subcategoryId: Joi.string().uuid().required(),
  title: Joi.string().min(2).max(200).required(),
  slug: Joi.string().min(2).max(200).required(),
  description: Joi.string().allow('').optional(),
  templateClass: Joi.string().valid('A', 'B', 'C').required(),
});

export const updateTemplateSchema = Joi.object({
  subcategoryId: Joi.string().uuid().optional(),
  title: Joi.string().min(2).max(200).optional(),
  slug: Joi.string().min(2).max(200).optional(),
  description: Joi.string().allow('').optional(),
  templateClass: Joi.string().valid('A', 'B', 'C').optional(),
  isActive: Joi.boolean().optional(),
});
