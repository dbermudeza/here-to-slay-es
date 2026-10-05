import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Regla local: los únicos comentarios de tareas pendientes permitidos son los
// marcados con "(regla)", que documentan dudas registradas en docs/DUDAS_REGLAS.md.
const soloTodoRegla = {
  meta: {
    type: 'problem',
    messages: {
      prohibido:
        'Solo se permite TODO(regla) documentado en docs/DUDAS_REGLAS.md; resuelve o elimina este comentario.',
    },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        for (const comentario of context.sourceCode.getAllComments()) {
          if (/\b(TODO|FIXME|XXX)\b(?!\(regla\))/i.test(comentario.value)) {
            context.report({ loc: comentario.loc, messageId: 'prohibido' });
          }
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-e2e/**',
      'dist-app/**',
      'apps/e2e/informe/**',
      'apps/e2e/resultados/**',
      '**/coverage/**',
      'Referencias/**',
      'assets/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    plugins: { hts: { rules: { 'solo-todo-regla': soloTodoRegla } } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'hts/solo-todo-regla': 'error',
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
);
