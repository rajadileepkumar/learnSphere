// ponytail: flat config, shared across workspaces — split per-package only if rules actually diverge
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**'] },
  ...tseslint.configs.recommended,
);
