import js from '@eslint/js'
import globals from 'globals'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', '.claude', 'packages/shared/lib', 'web/dist', 'landing/dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.tsx'],
    extends: [jsxA11y.flatConfigs.recommended],
  },
  {
    files: [
      'web/src/components/**/*.{ts,tsx}',
      'web/src/context/**/*.{ts,tsx}',
      'web/src/hooks/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'firebase/firestore',
              allowTypeImports: true,
              message: 'Firestore operations must not be called directly from components/contexts/hooks. Use services instead.',
            },
            {
              name: '../services/firestoreRepository',
              message: 'Components/contexts/hooks must not import from firestoreRepository. Use services instead.',
            },
            {
              name: 'web/src/services/firestoreRepository',
              message: 'Components/contexts/hooks must not import from firestoreRepository. Use services instead.',
            },
          ],
        },
      ],
    },
  },
])
