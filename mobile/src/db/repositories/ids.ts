let counter = 0;

/**
 * A new unique id with a readable prefix (`prep_`, `usr_`). Time + a per-launch counter + random digits:
 * unique on one phone without a crypto dependency. Prefixes keep user ids from ever matching content ids.
 */
export function newId(prefix: string): string {
  counter = (counter + 1) % 46656;
  const time = Date.now().toString(36);
  const seq = counter.toString(36).padStart(3, '0');
  const random = Math.floor(Math.random() * 1679616)
    .toString(36)
    .padStart(4, '0');
  return `${prefix}${time}${seq}${random}`;
}
