module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  env: {
    node: true,
    es2020: true
  },
  overrides: [
    {
      // Route handlers must use req.db (tenant-scoped, see middleware/tenant.ts), never the global client
      files: ['src/routes/**/*.ts'],
      rules: {
        'no-restricted-imports': ['error', {
          paths: [
            {
              name: '../index',
              importNames: ['prisma'],
              message: 'Route handlers must use req.db (tenant-scoped). See middleware/tenant.ts.'
            },
            {
              name: '@prisma/client',
              importNames: ['PrismaClient'],
              message: 'Route handlers must use req.db (tenant-scoped). See middleware/tenant.ts.'
            }
          ]
        }]
      }
    }
  ]
};
