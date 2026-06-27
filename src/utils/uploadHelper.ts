import cloudinary from '../config/cloudinary';
import { UploadApiResponse } from 'cloudinary';

interface UploadResult {
  url: string;
  fileType: string;
  bytes: number;
}

/**
 * Streams an in-memory file buffer (from multer's memoryStorage) to Cloudinary.
 * Used by the admin template upload-proxy endpoint (POST /admin/templates/:id/upload).
 */
export const uploadBufferToCloudinary = (
  buffer: Buffer,
  options: { folder?: string; originalFilename?: string } = {},
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'startwrite/templates',
        resource_type: 'auto', // allows docx/xlsx/pdf/pptx, not just images
        use_filename: true,
        unique_filename: true,
        filename_override: options.originalFilename,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(error || new Error('Cloudinary upload failed with no result'));
        }
        resolve({
          url: result.secure_url,
          fileType: result.format,
          bytes: result.bytes,
        });
      },
    );
    stream.end(buffer);
  });
};

/** Uploads a preview/thumbnail image specifically (forces image resource type). */
export const uploadImageToCloudinary = (
  buffer: Buffer,
  folder = 'startwrite/previews',
): Promise<UploadResult> => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(error || new Error('Cloudinary image upload failed'));
        }
        resolve({ url: result.secure_url, fileType: result.format, bytes: result.bytes });
      },
    );
    stream.end(buffer);
  });
};
