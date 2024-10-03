import { stringify } from 'yaml';

// Convert data to a YAML string with an optional prefix
export function toYamlString(data: any, prefix?: string): string {
  const yamlString = stringify(data, { indent: 2, sortMapEntries: true });
  return prefix ? `${prefix}\n${yamlString}` : yamlString;
}

// Remove leading slashes or backslashes from a path
export function stripLeadingSlash(path: string): string {
  return path[0] === '/' || path[0] === '\\' ? path.slice(1) : path;
}

// Map function over array with concurrency limit
export async function concurrentMap<A, B>(
  concurrency: number,
  xs: A[],
  mapFn: (val: A, idx: number) => Promise<B>
): Promise<B[]> {
  const result: B[] = [];
  for (let i = 0; i < xs.length; i += concurrency) {
    const slice = xs.slice(i, i + concurrency);
    const mapped = await Promise.all(slice.map(mapFn));
    result.push(...mapped);
  }
  return result;
}

// Check if item is an object and not an array
export function isObject(item: any): item is Record<string, any> {
  return !!item && typeof item === 'object' && !Array.isArray(item);
}

// Recursively merge objects where b overwrites a in case of conflicts
export function objMerge(
  a: Record<string, any>,
  b: Record<string, any>,
  max_depth = 10
): Record<string, any> {
  if (max_depth === 0) throw new Error('Maximum depth exceeded in objMerge');

  if (isObject(a) && isObject(b)) {
    return Object.keys({ ...a, ...b }).reduce((result, key) => {
      result[key] = key in a && key in b 
        ? objMerge(a[key], b[key], max_depth - 1)
        : b[key] !== undefined 
          ? b[key]
          : a[key];
      return result;
    }, {} as Record<string, any>);
  }

  return b !== undefined ? b : a;
}
