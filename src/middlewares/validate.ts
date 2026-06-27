import { NextFunction, Request, Response } from 'express';
import { ObjectSchema } from 'joi';
import { ResponseService } from '../utils/response';

interface ValidateOption<T> {
  type: 'body' | 'headers' | 'params' | 'query';
  schema: ObjectSchema<T>;
}

export const ValidationMiddleware =
  <T>({ type, schema }: ValidateOption<T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const validationQueries = req[type];
      const { error } = (schema as ObjectSchema<T>).validate(validationQueries);
      if (error) {
        return ResponseService({
          data: error.details,
          status: 400,
          success: false,
          message: error.message,
          res,
        });
      }
      next();
    } catch (error) {
      console.log('Validation error:', error);
      return ResponseService({
        data: error,
        status: 500,
        success: false,
        message: 'Validation failed',
        res,
      });
    }
  };
