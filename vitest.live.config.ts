import { defineConfig } from 'vitest/config'
import path from 'path'

// 실 API를 타는 검증용. 기본 npm test에서는 제외된다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.manual.ts'],
    testTimeout: 300000,
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
