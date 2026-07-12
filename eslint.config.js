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
};

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  fetch: "readonly",
  console: "readonly",
};

const rules = {
  "no-unused-vars": "error",
  "no-undef": "error",
  "no-var": "error",
  "prefer-const": "error",
  eqeqeq: ["error", "smart"],
};

module.exports = [
  { ignores: ["node_modules/**", "data/**"] },
  {
    files: ["server.js", "core/**/*.js", "test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "commonjs",
      globals: nodeGlobals,
    },
    rules,
  },
  {
    files: ["public/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: browserGlobals,
    },
    rules,
  },
  eslintConfigPrettier,
];
