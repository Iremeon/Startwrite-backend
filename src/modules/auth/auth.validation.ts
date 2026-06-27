import Joi from 'joi';

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).max(128).required(),
  phoneNumber: Joi.string().optional().allow(''),
  // Rwanda RRA TIN format: exactly 9 digits, numeric only. Schema-validated
  // shape only — no live lookup against RRA's database.
  tinNumber: Joi.string()
    .pattern(/^\d{9}$/)
    .messages({ 'string.pattern.base': 'tinNumber must be exactly 9 digits (Rwanda RRA format)' })
    .optional(),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

export const googleTokenSchema = Joi.object({
  idToken: Joi.string().required(),
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const verifyEmailSchema = Joi.object({
  token: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const verifyResetTokenSchema = Joi.object({
  token: Joi.string().required(),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(8).max(128).required(),
});
