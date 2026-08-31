import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'shared',
          root: 'packages/shared',
          include: ['src/**/*.test.ts'],
          exclude: ['lib/**', 'node_modules/**'],
        },
      },
      {
        test: {
          name: 'functions',
          root: 'functions',
          include: ['src/**/*.test.ts'],
          exclude: ['lib/**', 'node_modules/**'],
        },
      },
      {
        test: {
          name: 'landing',
          root: 'landing',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['dist/**', 'node_modules/**'],
        },
      },
      {
        test: {
          name: 'web',
          root: 'web',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['dist/**', 'node_modules/**'],
        },
      },
    ],
  },
});
