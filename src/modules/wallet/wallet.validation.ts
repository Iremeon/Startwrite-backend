import Joi from 'joi';

// Rwanda phone numbers: MTN (078/079) and Airtel (073/072)
const rwandaPhoneSchema = Joi.string()
  .pattern(/^(07[2389]\d{7})$/)
  .messages({
    'string.pattern.base':
      'Phone number must be a valid Rwanda mobile number (e.g. 0781234567)',
  });

export const topUpSchema = Joi.object({
  packageId: Joi.string().uuid().required(),
  phoneNumber: rwandaPhoneSchema.required(),
});

export const directPaySchema = Joi.object({
  phoneNumber: rwandaPhoneSchema.required(),
});