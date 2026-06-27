import swaggerJSDoc from 'swagger-jsdoc';

const swaggerDefinition: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Startwrite API',
      version: '1.0.0',
      description: 'Backend REST API for the Startwrite business document template marketplace.',
    },
    servers: [{ url: `${process.env.API_PREFIX || '/api/v1'}` }],
    tags: [
      { name: 'Auth', description: 'Registration, login, tokens, password reset' },
      { name: 'Users', description: 'Current user profile' },
      { name: 'Categories', description: 'Catalog categories and subcategories' },
      { name: 'Templates', description: 'Template catalog, detail, and downloads' },
      { name: 'Wallet', description: 'Wallet balance, top-ups, and transaction history' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            data: { type: 'object', nullable: true },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            email: { type: 'string', format: 'email' },
            tinNumber: { type: 'string', nullable: true },
            role: { type: 'string', enum: ['user', 'admin'] },
            walletBalance: { type: 'number' },
            isEmailVerified: { type: 'boolean' },
          },
        },
        Template: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            title: { type: 'string' },
            slug: { type: 'string' },
            description: { type: 'string' },
            fileType: { type: 'string' },
            templateClass: { type: 'string', enum: ['A', 'B', 'C'] },
            previewImageUrl: { type: 'string', nullable: true },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJSDoc(swaggerDefinition);
