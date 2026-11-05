// Empacota a pasta dist/ em aba-zen-v<versão>.zip, pronto para enviar à Chrome Web Store.
// Sem dependências: usa apenas zlib do Node (>= 22).
import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const output = join(root, `aba-zen-v${version}.zip`);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)])),
  );
  return files.flat().sort();
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const locals = [];
const centrals = [];
let offset = 0;

for (const file of await walk(dist)) {
  const name = Buffer.from(relative(dist, file).split(sep).join('/'));
  const data = await readFile(file);
  const compressed = deflateRawSync(data, { level: 9 });
  const { time, day } = dosDateTime((await stat(file)).mtime);
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4); // versão necessária
  local.writeUInt16LE(0x0800, 6); // nomes em UTF-8
  local.writeUInt16LE(8, 8); // deflate
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  locals.push(local, name, compressed);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(offset, 42);
  centrals.push(central, name);

  offset += local.length + name.length + compressed.length;
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0);
const count = centrals.length / 2;
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(count, 8);
end.writeUInt16LE(count, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

await writeFile(output, Buffer.concat([...locals, ...centrals, end]));
console.log(`✔ ${relative(root, output)} (${count} arquivos)`);
