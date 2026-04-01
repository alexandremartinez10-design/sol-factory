import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function truncateAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}

export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(4);
}
