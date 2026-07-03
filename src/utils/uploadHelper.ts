import cloudinary from '../config/cloudinary';
import { UploadApiResponse } from 'cloudinary';
import { ApiError } from './ApiError';

const ALLOWED_EXTENSIONS = ['docx', 'xlsx', 'pdf', 'pptx'];

const ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/pdf',
];

const MAGIC_BYTES: Record<string, number[][]> = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  docx: [[0x50, 0x4b, 0x03, 0x04]],
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
  pptx: [[0x50, 0x4b, 0x03, 0x04]],
};

const validateMagicBytes = (buffer: Buffer, ext: string): boolean => {
  const signatures = MAGIC_BYTES[ext];
  if (!signatures) return true;
  return signatures.some(sig => sig.every((byte, i) => buffer[i] === byte));
};

interface UploadResult {
  url: string;
  fileType: string;
  bytes: number;
}

export const uploadBufferToCloudinary = (
  buffer: Buffer,
  options: { folder?: string; originalFilename?: string; mimetype?: string } = {},
): Promise<UploadResult> => {
  const ext = options.originalFilename?.split('.').pop()?.toLowerCase() ?? '';

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new ApiError(
      400,
      'INVALID_FILE_TYPE',
      `Only ${ALLOWED_EXTENSIONS.join(', ')} files are accepted. Received: .${ext || 'unknown'}`,
    );
  }

  if (options.mimetype && !ALLOWED_MIME_TYPES.includes(options.mimetype)) {
    throw new ApiError(
      400,
      'INVALID_FILE_TYPE',
      `File MIME type "${options.mimetype}" is not accepted for document uploads.`,
    );
  }

  if (!validateMagicBytes(buffer, ext)) {
    throw new ApiError(
      400,
      'INVALID_FILE_CONTENT',
      `The file content does not match the expected .${ext} format. Make sure the file is a real ${ext.toUpperCase()} document.`,
    );
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'startwrite/templates',
        resource_type: 'auto',
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
          fileType: ext,
          bytes: result.bytes,
        });
      },
    );
    stream.end(buffer);
  });
};

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