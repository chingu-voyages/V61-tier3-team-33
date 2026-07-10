/** Makes primitive `T` nominally distinct by tagging with brand `B`. Use factory functions, not direct construction. */
export type Brand<T, B extends string> = T & { readonly __brand: B };
