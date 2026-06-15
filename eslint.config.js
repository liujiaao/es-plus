/**
 * ES-Plus monorepo ESLint flat config.
 *
 * Stack: ESLint 9 (flat config) + typescript-eslint 8 + eslint-plugin-vue 9.
 *
 * Critical separation: Vue 2 vs Vue 3 SFC rules MUST be applied per package
 * — eslint-plugin-vue's `flat/recommended` is Vue 3 by default, and its
 * autofix happily rewrites Vue 2's `:foo.sync` into Vue 3's `v-model:foo`,
 * which silently breaks Vue 2 + Element UI runtime. We explicitly route
 * vue2 → flat/vue2-recommended, vue3 → flat/recommended, and never let
 * vue2 files touch the Vue-3 ruleset.
 *
 * Layout:
 *   1. ignores
 *   2. base JS/TS — recommended JS + recommended TS (non-type-checked)
 *   3. Vue 2 SFC — flat/vue2-recommended for packages/vue2/**\/*.vue
 *   4. Vue 3 SFC — flat/recommended for packages/vue3/**\/*.vue
 *   5. node-script files — process.* globals, console allowed
 *   6. tests — relax any-typing & unused-vars
 *   7. mcp-server / cli — console is the product
 *   8. global rule overrides
 *
 * Why not type-checked TS rules across the whole monorepo:
 *   `recommendedTypeChecked` requires every linted file to be in a tsconfig
 *   project graph. Cost too high until we have a concrete bug it would catch.
 */

import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

// Helper — apply a vue plugin preset to a specific files glob.
// eslint-plugin-vue's `configs['flat/...']` is an array of config objects
// with no `files` field, so we attach our `files` and language options.
const vuePresetFor = (glob, presetName) =>
  vue.configs[presetName].map((cfg) => ({
    ...cfg,
    files: [glob],
    languageOptions: {
      ...(cfg.languageOptions || {}),
      parser: vueParser,
      parserOptions: {
        ...(cfg.languageOptions?.parserOptions || {}),
        parser: tseslint.parser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: { ...globals.browser, ...globals.node },
    },
  }))

export default [
  // ─── 1. ignores ──────────────────────────────────────────────────
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.cache/**',
      '**/.vite/**',
      '**/coverage/**',
      // Doc site has its own pipeline / vitepress idioms — out of scope
      'es-plus-docs/**',
      // Sibling projects, not part of monorepo workspaces
      'es-pc/**',
      // es-eui is the legacy independent doc/showcase project (es-eui-docs);
      // its source predates the monorepo and uses Vue 2 patterns that don't
      // align with the unified ruleset. Out of scope for ES-Plus quality gates.
      'es-eui/**',
      // Local verification scratchpad — not part of any published package
      'test-project/**',
      // Generated / vendored
      '**/schemas/**',
      '**/fixtures/**',
      // Fixture sandboxes copied at e2e time
      '__tests__/e2e/fixtures/**/dist/**',
      // ESLint config itself
      'eslint.config.js',
    ],
  },

  // ─── 2. base JS/TS ───────────────────────────────────────────────
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // ─── 3. Vue 2 SFC ────────────────────────────────────────────────
  // CRITICAL: this preset is Vue-2-aware. Do NOT replace with `flat/recommended`
  // — that would let the autofixer rewrite `:foo.sync` → `v-model:foo`,
  // which is Vue 3 syntax and breaks Element UI runtime.
  ...vuePresetFor('packages/vue2/**/*.vue', 'flat/vue2-recommended'),

  // ─── 4. Vue 3 SFC ────────────────────────────────────────────────
  ...vuePresetFor('packages/vue3/**/*.vue', 'flat/recommended'),

  // ─── 5. node-script files ────────────────────────────────────────
  {
    files: [
      '**/*.config.{js,mjs,ts}',
      '**/scripts/**/*.{js,mjs,ts}',
      '__tests__/e2e/scripts/**/*.{js,mjs}',
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // ─── 6. tests ────────────────────────────────────────────────────
  {
    files: ['**/__tests__/**/*.{ts,vue,mjs,js}', '**/*.spec.{ts,js}', '**/*.test.{ts,js}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      'no-console': 'off',
    },
  },

  // ─── 7. mcp-server / cli — console IS the product ───────────────
  {
    files: ['packages/mcp-server/**/*.{ts,js,mjs}', 'packages/cli/**/*.{ts,js,mjs}'],
    rules: {
      'no-console': 'off',
    },
  },

  // ─── 8. global rule overrides ────────────────────────────────────
  // Decision tree (how to assign a rule):
  //   - true bug source → keep 'error'  (no-cond-assign, no-func-assign,
  //                                       prefer-const, no-dupe-keys, ...)
  //   - stylistic / preference         → 'off'
  //   - legacy-pattern noise           → 'off'  (with rationale)
  //   - quality signal worth tracking  → 'warn' (counted but doesn't gate CI)
  //   - true bug but >50 sites today   → 'warn' temporarily, with TODO to
  //                                       upgrade to 'error' once cleaned
  {
    rules: {
      // ── DISABLED: TypeScript handles these better ──
      // typescript-eslint's official guidance: turn off no-undef when using
      // @typescript-eslint/parser. Otherwise .cjs UMD wrappers, browser
      // globals (window/document), and Node globals (module/require) all
      // need duplicated declarations across three files.
      'no-undef': 'off',

      // ── DISABLED: legitimate legacy patterns ──
      // `const self = this` is required in vue 2 + composition-api setup
      // bridges; obj.hasOwnProperty(k) is valid CommonJS-era code.
      '@typescript-eslint/no-this-alias': 'off',
      'no-prototype-builtins': 'off',
      // .cjs files MUST use require()
      '@typescript-eslint/no-require-imports': 'off',
      // {} as a type is occasionally needed at type-erasure boundaries
      '@typescript-eslint/no-empty-object-type': 'off',
      // ESLint 9 added this; flags too many legacy patterns to be useful
      'no-useless-assignment': 'off',

      // ── WARN: quality signal, not yet a gate ──
      // any is sometimes necessary at framework boundaries
      '@typescript-eslint/no-explicit-any': 'warn',
      // Function-as-type is intentional in some Vue 2↔3 adapter signatures
      '@typescript-eslint/no-unsafe-function-type': 'warn',
      // 85+ existing sites; clean up gradually before upgrading to 'error'
      // TODO(stage-C+): re-enable as 'error' once unused-var debt < 10
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // 53+ existing sites; many are intentional `expr && expr2()` short-circuit
      // TODO(stage-C+): audit each, then upgrade to 'error'
      '@typescript-eslint/no-unused-expressions': 'warn',
      // Allow warn/error/info; only plain console.log warns
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],

      // ── ERROR: real bugs, must fix ──
      // (these ride on the eslint:recommended defaults — listed here only
      // for visibility / documentation purposes, no override needed)
      // - no-cond-assign
      // - no-func-assign
      // - no-useless-escape
      // - no-empty
      // - no-dupe-keys
      // - prefer-const

      // ts-ignore is sometimes needed at framework boundaries; require
      // a meaningful comment to deter casual escape-hatching.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': 'allow-with-description',
          minimumDescriptionLength: 10,
        },
      ],

      // ── DISABLED: Vue stylistic / churn ──
      'vue/multi-word-component-names': 'off',
      'vue/html-self-closing': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/attributes-order': 'off',
      'vue/component-tags-order': 'off',
      'vue/html-closing-bracket-newline': 'off',
      'vue/html-indent': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/require-default-prop': 'off',
      'vue/no-template-shadow': 'off',
      'vue/one-component-per-file': 'off',
    },
  },
]
