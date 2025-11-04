// Lint-staged 已禁用
// const path = require("path");

// const buildNextEslintCommand = (filenames) =>
//   `yarn next:lint --fix --file ${filenames
//     .map((f) => path.relative(path.join("packages", "nextjs"), f))
//     .join(" --file ")}`;

// const checkTypesNextCommand = () => "yarn next:check-types";

// const buildHardhatEslintCommand = (filenames) =>
//   `yarn hardhat:lint-staged --fix ${filenames
//     .map((f) => path.relative(path.join("packages", "hardhat"), f))
//     .join(" ")}`;

module.exports = {
  // 所有检查已禁用
  "packages/nextjs/**/*.{ts,tsx}": [],
  "packages/hardhat/**/*.{ts,tsx}": [],
};
