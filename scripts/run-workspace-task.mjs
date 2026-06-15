#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const task = process.argv[2];

if (!task) {
  console.error('Usage: node scripts/run-workspace-task.mjs <task>');
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function collectWorkspacePackages() {
  const workspaceDirs = ['apps', 'packages'];
  const packages = [];

  for (const workspaceDir of workspaceDirs) {
    const absoluteWorkspaceDir = path.join(rootDir, workspaceDir);
    if (!existsSync(absoluteWorkspaceDir)) {
      continue;
    }

    for (const entry of readdirSync(absoluteWorkspaceDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }

      const packageDir = path.join(absoluteWorkspaceDir, entry.name);
      const packageJsonPath = path.join(packageDir, 'package.json');
      if (!existsSync(packageJsonPath)) {
        continue;
      }

      const packageJson = readJson(packageJsonPath);
      packages.push({
        name: packageJson.name,
        dir: packageDir,
        packageJson,
      });
    }
  }

  return packages;
}

function getWorkspaceDependencyNames(packageJson, workspaceNames) {
  const sections = [packageJson.dependencies, packageJson.devDependencies, packageJson.peerDependencies, packageJson.optionalDependencies];
  const result = new Set();

  for (const section of sections) {
    if (!section) {
      continue;
    }

    for (const [dependencyName, version] of Object.entries(section)) {
      if (typeof version === 'string' && version.startsWith('workspace:') && workspaceNames.has(dependencyName)) {
        result.add(dependencyName);
      }
    }
  }

  return [...result];
}

function topologicalSort(packages) {
  const workspaceNames = new Set(packages.map(pkg => pkg.name).filter(Boolean));
  const packageMap = new Map(packages.map(pkg => [pkg.name, pkg]));
  const dependencies = new Map();

  for (const pkg of packages) {
    dependencies.set(pkg.name, getWorkspaceDependencyNames(pkg.packageJson, workspaceNames));
  }

  const visited = new Set();
  const active = new Set();
  const ordered = [];

  function visit(name) {
    if (visited.has(name)) {
      return;
    }

    if (active.has(name)) {
      throw new Error(`Cycle detected in workspace dependencies at ${name}`);
    }

    const pkg = packageMap.get(name);
    if (!pkg) {
      return;
    }

    active.add(name);
    for (const dependencyName of dependencies.get(name) ?? []) {
      visit(dependencyName);
    }
    active.delete(name);
    visited.add(name);
    ordered.push(pkg);
  }

  for (const pkg of packages) {
    visit(pkg.name);
  }

  return ordered;
}

function runPackageTask(packageDir, packageName, taskName) {
  if (taskName === 'clean') {
    rmSync(path.join(packageDir, 'dist'), { recursive: true, force: true });
    console.log(`\n[${packageName}] clean complete`);
    return;
  }

  if (taskName === 'build' || taskName === 'typecheck') {
    const tscPath = path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
    const args = ['-p', path.join(packageDir, 'tsconfig.json')];

    if (taskName === 'typecheck') {
      args.push('--noEmit');
    }

    const result = spawnSync(process.execPath, [tscPath, ...args], {
      stdio: 'inherit',
      env: process.env,
    });

    if (result.status !== 0) {
      process.exit(result.status ?? 1);
    }

    console.log(`\n[${packageName}] ${taskName} complete`);
    return;
  }

  const result = spawnSync('npm', ['run', '--silent', taskName, '--prefix', packageDir], {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  console.log(`\n[${packageName}] ${taskName} complete`);
}

const packages = topologicalSort(collectWorkspacePackages());
const filteredPackages = task === 'clean' ? [...packages].reverse() : packages;

for (const pkg of filteredPackages) {
  if (pkg.packageJson.scripts && Object.prototype.hasOwnProperty.call(pkg.packageJson.scripts, task)) {
    runPackageTask(pkg.dir, pkg.name, task);
  }
}
