/**
 * Makes a primitive `T` nominally distinct by tagging it with brand `B`.
 * Never construct one of these directly — use the typed constants or
 * factory functions exported from each domain file.
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };
