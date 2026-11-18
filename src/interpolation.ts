import type { InterpolationDelimiters, InterpolationValues } from './types.js';

const DEFAULT_DELIMITERS: InterpolationDelimiters = { prefix: '{', suffix: '}' };
const interpolateDefault = createInterpolator();

/** Replaces interpolation parameters using literal delimiters; defaults to {name}. */
export function interpolateTypo(
  template: string,
  values: InterpolationValues,
  delimiters?: InterpolationDelimiters,
): string {
  const interpolate = delimiters === undefined ? interpolateDefault : createInterpolator(delimiters);
  return interpolate(template, values);
}

/** Compiles once per instance so translators do not create regular expressions on each call. */
export function createInterpolator({ prefix, suffix }: InterpolationDelimiters = DEFAULT_DELIMITERS) {
  if (typeof prefix !== 'string' || !prefix || typeof suffix !== 'string' || !suffix) {
    throw new TypeError('Interpolation prefix and suffix must be nonempty strings');
  }
  const pattern = new RegExp(`${escapeRegExp(prefix)}([\\w.-]+?)${escapeRegExp(suffix)}`, 'g');
  return (template: string, values: InterpolationValues): string =>
    template.replace(pattern, (_, key: string) => {
      const value = Object.hasOwn(values, key) ? values[key] : undefined;
      return value == null ? '' : String(value);
    });
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
