import { Buffer } from 'buffer';

// Patch Buffer.isBuffer to accept any Uint8Array across module instances.
// @coral-xyz/anchor bundles its own base-x which captures a private _Buffer
// reference. When that _Buffer.isBuffer(source) is called on a Uint8Array from
// a different Buffer instance, it returns false → "Expected Buffer" TypeError.
// Making isBuffer cross-instance-safe fixes this without touching node_modules.
const _origIsBuffer = Buffer.isBuffer.bind(Buffer);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(Buffer as any).isBuffer = function isBuffer(obj: unknown): obj is Buffer {
  return _origIsBuffer(obj) || (obj instanceof Uint8Array);
};

if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).Buffer = Buffer;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Buffer = Buffer;
}
