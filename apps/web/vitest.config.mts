import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  css: { modules: { localsConvention: 'as-is' } },
  test: {
    include: [
      'lib/**/*.spec.ts',
      'design/**/*.spec.ts',
      'components/**/*.spec.tsx',
      'public/**/*.spec.ts',
    ],
    environment: 'node',
  },
});
