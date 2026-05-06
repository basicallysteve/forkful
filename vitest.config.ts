/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['**/*.integration.test.ts', 'node_modules/**', '.next/**'],
    env: {
      JWT_SECRET: 'test-secret-for-unit-tests',
    },
    alias: {
      'server-only': path.resolve(__dirname, './src/test/mocks/server-only.ts'),
      'next/link': path.resolve(__dirname, './src/test/mocks/next-link.tsx'),
      'next/navigation': path.resolve(__dirname, './src/test/mocks/next-navigation.ts'),
    },
  },
})
