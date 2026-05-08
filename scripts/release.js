#!/usr/bin/env node
const { execSync } = require("child_process");
const readline = require("readline");

const run = (cmd) => execSync(cmd, { stdio: "inherit" });

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

(async () => {
  const bump = process.argv[2] || "patch";
  if (!["patch", "minor", "major"].includes(bump)) {
    console.error("Usage: npm run release [patch|minor|major]");
    process.exit(1);
  }

  const version = execSync(`npm version ${bump} --no-git-tag-version`).toString().trim();
  console.log(`\nBumped to ${version}`);

  run(`git add package.json package-lock.json`);
  run(`git commit -m "${version.replace("v", "")}"`);
  run(`git tag ${version}`);

  const answer = await ask(`\nPush ${version} and trigger npm publish? (y/N) `);
  rl.close();

  if (answer.toLowerCase() !== "y") {
    console.log("Aborted. Commit and tag are local — undo with:");
    console.log(`  git tag -d ${version} && git reset --soft HEAD~1`);
    process.exit(0);
  }

  run(`git push origin main`);
  run(`git push origin ${version}`);
  console.log(`\n${version} pushed — GitHub Action will publish to npm.`);
})();
