// A Lapin engine started for the tools (make-examples.mjs): the host of a lapin-pro checkout (built with
// `pnpm setup`), on a free port, with a user folder of its own, driven over its WebSocket as Lapin's interface is.
// Node 22, no dependencies.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The engine's binary frame: "LPF1", a uint32 header length, the JSON header (arrays left as references). */
function decode(buf) {
  const b = Buffer.from(buf);
  if (b.toString('latin1', 0, 4) !== 'LPF1') return JSON.parse(b.toString('utf8'));
  const n = b.readUInt32LE(4);
  return JSON.parse(b.toString('utf8', 8, 8 + n));
}

/** Starts the engine of the lapin-pro checkout at `lapin` with the `lapin` edition; resolves to { call, execute, query, stop }. */
export async function startEngine(lapin) {
  const dll = join(lapin, 'engine/src/Host/Lapin.Host/bin/Debug/net10.0/Lapin.Host.dll');
  if (!existsSync(dll)) throw new Error(`No Lapin engine at ${dll}: run pnpm setup in ${lapin} first.`);
  const { resolveProduct } = await import(join(lapin, 'scripts/product.mjs'));
  const work = mkdtempSync(join(tmpdir(), 'lapin-ext-'));
  const product = join(work, 'product.json');
  writeFileSync(product, JSON.stringify(resolveProduct(lapin, 'lapin')));
  const child = spawn('dotnet', [dll, '--product', product, '--modules-dir', join(lapin, 'engine/artifacts/modules'), '--user-dir', join(work, 'user'), '--port', '0'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const port = await new Promise((resolve, reject) => {
    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      const m = /LAPIN_HOST_READY (\{.*\})/.exec(out);
      if (m) resolve(JSON.parse(m[1]).port);
    });
    child.on('exit', (code) => reject(new Error(`The engine stopped (${code}).`)));
  });
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  ws.binaryType = 'arraybuffer';
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = () => reject(new Error('The engine did not answer.')); });
  let next = 1;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = decode(ev.data);
    if (msg.event) return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error)); else p.resolve(msg.result);
  };
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = next++;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  return {
    call, port,
    execute: (command, args = {}) => call('doc.execute', { command, args }),
    query: (name, args = {}) => call('doc.query', { name, args }),
    stop: () => { ws.close(); child.kill('SIGTERM'); },
  };
}
