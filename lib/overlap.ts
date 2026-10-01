import { componentName } from "./files";

type OpenChange = { id: string; author_id: string; title: string; changed_files: string[] };

export type Overlap = {
  change: OpenChange;
  files: string[];
  components: string[];
};

/**
 * Other people's open Changes that touch the same files as `mine`.
 * Overlap is an early warning, not a conflict ("Nothing is wrong yet").
 */
export function findOverlaps(mine: OpenChange, others: OpenChange[]): Overlap[] {
  const myFiles = new Set(mine.changed_files);
  const result: Overlap[] = [];
  for (const other of others) {
    if (other.id === mine.id || other.author_id === mine.author_id) continue;
    const files = other.changed_files.filter((f) => myFiles.has(f));
    if (files.length === 0) continue;
    result.push({ change: other, files, components: [...new Set(files.map(componentName))] });
  }
  return result;
}

/** Every pair of open Changes (by different people) that share files. */
export function findAllOverlaps(changes: OpenChange[]) {
  const pairs: { a: OpenChange; b: OpenChange; components: string[] }[] = [];
  changes.forEach((a, i) => {
    for (const b of changes.slice(i + 1)) {
      if (a.author_id === b.author_id) continue;
      const shared = a.changed_files.filter((f) => b.changed_files.includes(f));
      if (shared.length) pairs.push({ a, b, components: [...new Set(shared.map(componentName))] });
    }
  });
  return pairs;
}
