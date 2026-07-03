import { Request, Response, NextFunction } from 'express';
import { ResponseService } from '../../utils/response';
import { IRequestUser } from '../../middlewares/authenticate';
import * as templatesService from './templates.service';

export const listTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items, meta } = await templatesService.listTemplates(
      req.query as Record<string, string>,
    );
    return res.status(200).json({ success: true, data: items, meta });
  } catch (error) {
    next(error);
  }
};

export const getTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templatesService.getTemplateBySlug(req.params.slug);
    return ResponseService({ data: template, status: 200, success: true, res });
  } catch (error) {
    next(error);
  }
};

export const downloadTemplate = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const result = await templatesService.downloadTemplate(req.user!.id, req.params.id);
    return ResponseService({
      data: result,
      status: 200,
      success: true,
      message: 'Download authorized',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const createTemplate = async (req: IRequestUser, res: Response, next: NextFunction) => {
  try {
    const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
    const file = files?.file?.[0];
    const preview = files?.preview?.[0];

    if (!file) {
      return ResponseService({
        data: null,
        status: 400,
        success: false,
        message: 'No file provided. Attach the template file under the "file" field.',
        res,
      });
    }

    const template = await templatesService.createTemplateWithUpload(
      req.body,
      req.user!.id,
      file.buffer,
      file.originalname,
      file.mimetype,       // ← new: passed to upload helper for MIME + magic byte validation
      preview?.buffer,     // ← now correctly in 6th position
    );

    return ResponseService({
      data: template,
      status: 201,
      success: true,
      message: 'Template uploaded and created',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const updateTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const template = await templatesService.updateTemplate(req.params.id, req.body);
    return ResponseService({
      data: template,
      status: 200,
      success: true,
      message: 'Template updated',
      res,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await templatesService.softDeleteTemplate(req.params.id);
    return ResponseService({
      data: null,
      status: 200,
      success: true,
      message: 'Template deleted',
      res,
    });
  } catch (error) {
    next(error);
  }
};