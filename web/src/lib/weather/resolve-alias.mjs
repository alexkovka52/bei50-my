import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Node's test runner does not apply tsconfig paths. This hook maps `@/` and
// extensionless relative imports onto the TypeScript sources.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function isFile(candidate) {
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function basePath(specifier, parentURL) {
  if (specifier.startsWith("@/")) return path.join(SRC, specifier.slice(2));
  if (specifier.startsWith(".")) {
    const parentDir = parentURL ? path.dirname(fileURLToPath(parentURL)) : process.cwd();
    return path.resolve(parentDir, specifier);
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  const base = basePath(specifier, context.parentURL);
  if (base) {
    const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.mts`, path.join(base, "index.ts")];
    for (const candidate of candidates) {
      if (isFile(candidate)) return nextResolve(pathToFileURL(candidate).href, context);
    }
  }
  return nextResolve(specifier, context);
}
