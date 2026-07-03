import Joi from 'joi';

export const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(150).optional(),
  phoneNumber: Joi.string().allow('', null).optional(),
}).min(1);