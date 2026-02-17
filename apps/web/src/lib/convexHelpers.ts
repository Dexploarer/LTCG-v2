// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Convex generated types resolve at runtime via Vite
import { api } from "@convex-generated-api";
import { useMutation, useQuery, useAction } from "convex/react";

/**
 * Type-cast API to avoid TS2589 errors.
 * Use this instead of `api as any` in components.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const apiAny = api as any;

/**
 * Wrapper for useMutation to avoid type instantiation errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useConvexMutation(path: any) {
  return useMutation(path);
}

/**
 * Wrapper for useQuery to avoid type instantiation errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useConvexQuery(path: any, args?: any) {
  return useQuery(path, args);
}

/**
 * Wrapper for useAction to avoid type instantiation errors.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useConvexAction(path: any) {
  return useAction(path);
}
