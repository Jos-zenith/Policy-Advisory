import next from "eslint-config-next";

const config = [
  ...next,
  {
    ignores: [".next/**", "node_modules/**", "playwright-report/**", "test-results/**", "next-env.d.ts", "src/qa/*.json"],
  },
  {
    files: ["src/engine/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-imports": ["error", { patterns: ["react", "react-dom", "next/*", "fs", "node:*", "@/server/*", "@/components/*", "@/app/*", "@/lib/*"] }],
    },
  },
];
export default config;
