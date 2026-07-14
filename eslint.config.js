"use strict";

const eslintConfigPrettier = require("eslint-config-prettier");

const nodeGlobals = {
  process: "readonly",
  require: "readonly",
  module: "writable",
  exports: "writable",
  __dirname: "readonly",
  __filename: "readonly",
  console: "readonly",
  Buffer: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  fetch: "readonly",
};

const rules = {
  "no-unused-vars": "error",
  "no-undef": "error",
  "no-var": "error",
  "prefer-const": "error",
  eqeqeq: ["error", "smart"],
};

module.exports = [
  // The React client is linted by its own Vite toolchain, not this Node config.
  {
    ignores: ["node_modules/**", "data/**", "client/**", "phase-1-planning/**", "vite.config.js"],
  },
  {
    files: ["server/**/*.js", "core/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
    rules,
  },
  eslintConfigPrettier,
];
