import Joi from 'joi';

export const topUpSchema = Joi.object({
  packageId: Joi.string().uuid().required(),
});