import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  // Base directory for resolving plugin configs relative to this file.
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "prisma/migrations/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
