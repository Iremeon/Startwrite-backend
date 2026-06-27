import Joi from 'joi';

export const listUsersQuerySchema = Joi.object({
  role: Joi.string().valid('user', 'admin').optional(),
  isActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});

export const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required(),
});
