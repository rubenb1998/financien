import { execFileSync } from 'node:child_process';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';

const rootFiles = new Set([
  '.gitattributes', '.gitignore', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'START-HIER.md',
  'Financien.exe', 'Start Financiën.command', 'index.html', 'package-lock.json', 'package.json',
  'requirements.txt', 'tsconfig.json', 'vite.config.ts', 'LICENSE', 'LICENSE.md',
]);
const appFiles = new Set([
  'Financiën.app/Contents/Info.plist', 'Financiën.app/Contents/MacOS/launch',
  'Financiën.app/Contents/Resources/Financien.icns', 'Financiën.app/Contents/Resources/start.zsh',
  'Financiën.app/Contents/_CodeSignature/CodeResources',
]);
const sourcePaths = [
  /^\.github\/workflows\/[\w-]+\.ya?ml$/,
  /^docs\/(?:[\w-]+\/)*[\w-]+\.md$/,
  /^scripts\/[\w-]+\.(?:mjs|c|rc|ico)$/,
  /^server\/(?:[\w-]+\/)*[\w-]+\.(?:ts|py)$/,
  /^src\/(?:[\w-]+\/)*[\w-]+\.(?:ts|tsx|css)$/,
  /^tests\/(?:[\w-]+\/)*[\w.-]+\.(?:ts|mjs|py)$/,
];
const sourceDirectories = ['.github', 'docs', 'scripts', 'server', 'src', 'tests'];
const executableFiles = new Set(['Start Financiën.command', 'Financiën.app/Contents/MacOS/launch']);
const binary = /(?:\.exe|\.ico|\.icns|\/MacOS\/launch)$/;

function allowed(path) {
  return rootFiles.has(path) || appFiles.has(path) || sourcePaths.some(pattern => pattern.test(path));
}

function validIban(value) {
  const compact = value.replace(/\s/g, '').toUpperCase();
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, char => String(char.charCodeAt(0) - 55));
  return [...digits].reduce((rest, digit) => (rest * 10 + Number(digit)) % 97, 0) === 1;
}

function checkContents(contents, path) {
  if (binary.test(path)) return;
  const text = contents.toString('utf8');
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk-proj-|sk-ant-api\d+-)[A-Za-z0-9_-]{20,}/.test(text)) {
    throw new Error('Mogelijke privésleutel of token in ' + path);
  }
  if ([...text.matchAll(/\bNL\d{2}\s?[A-Z]{4}(?:\s?\d){10}\b/gi)].some(([value]) => validIban(value))) {
    throw new Error('Mogelijk echt rekeningnummer in ' + path);
  }
}

function checkEntry(path, mode, regular) {
  if (!allowed(path) || !regular) throw new Error('Bestand valt buiten de publicatie: ' + path);
  if (executableFiles.has(path) && (mode & 0o111) === 0 && process.platform !== 'win32') {
    throw new Error('Startbestand mist uitvoerrechten: ' + path);
  }
}

function isWithin(parent, child) {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith('..' + sep) && !/^[A-Za-z]:/.test(path));
}

function privatePaths(root) {
  return [resolve(root, '.private'), resolve(root, process.env.FINANCIEN_DATA_DIR ?? '.private')];
}

async function discover(root, directory, privateRoots) {
  const folder = join(root, directory);
  if (privateRoots.some(path => isWithin(path, folder))) return [];
  if (!(await lstat(folder)).isDirectory()) throw new Error('Projectmap moet een echte map zijn: ' + directory);
  const files = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const path = directory + '/' + entry.name;
    if (entry.isDirectory() && /^[\w-]+$/.test(entry.name)) files.push(...await discover(root, path, privateRoots));
    else if (allowed(path)) files.push(path);
  }
  return files;
}

async function copySource(root, destination) {
  const requested = resolve(destination);
  const target = join(await realpath(dirname(requested)), relative(dirname(requested), requested));
  const privateRoots = privatePaths(root);
  if (isWithin(root, target) || privateRoots.some(path => isWithin(path, target))) {
    throw new Error('Kies een nieuwe doelmap buiten de projectmap.');
  }
  const paths = [...rootFiles, ...appFiles, ...(await Promise.all(sourceDirectories.map(dir => discover(root, dir, privateRoots)))).flat()];
  const files = [];
  for (const path of paths) {
    const file = join(root, path);
    const info = await lstat(file).catch(error => {
      if (error.code === 'ENOENT' && /^LICENSE(?:\.md)?$/.test(path)) return undefined;
      throw error;
    });
    if (!info) continue;
    checkEntry(path, info.mode, info.isFile());
    const physical = await realpath(file);
    if (physical !== file || privateRoots.some(folder => isWithin(folder, file))) {
      throw new Error('Publicatiebestand verwijst naar een andere of persoonlijke locatie: ' + path);
    }
    const buffer = await readFile(file);
    checkContents(buffer, path);
    files.push({ path, buffer, mode: executableFiles.has(path) ? 0o755 : 0o644 });
  }
  await mkdir(target);
  for (const file of files) {
    const to = join(target, file.path);
    await mkdir(dirname(to), { recursive: true });
    await writeFile(to, file.buffer, { mode: file.mode, flag: 'wx' });
  }
  console.log(`${files.length} gecontroleerde projectbestanden gekopieerd naar ${target}.`);
}

function checkGit() {
  const git = (args, options = {}) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024, ...options });
  const root = process.cwd();
  const privateRoots = privatePaths(root);
  const records = git(['ls-files', '--stage', '-z']).toString().split('\0').filter(Boolean);
  for (const record of records) {
    const match = /^(100644|100755) ([0-9a-f]+) 0\t([^\0]+)$/.exec(record);
    if (!match) throw new Error('De Git-index bevat een koppeling, submodule of onopgelost conflict.');
    const [, mode, hash, path] = match;
    checkEntry(path, Number.parseInt(mode, 8), true);
    if (privateRoots.some(folder => isWithin(folder, join(root, path)))) throw new Error('Lokale gegevensmap in Git: ' + path);
    if (executableFiles.has(path) && mode !== '100755') throw new Error('Startbestand mist Git-uitvoerrechten: ' + path);
    if (!binary.test(path)) checkContents(git(['cat-file', 'blob', hash]), path);
  }
  if (!records.length) throw new Error('De Git-index is leeg.');
  console.log(`${records.length} bestanden in de Git-index gecontroleerd.`);
}

try {
  const [mode, destination, ...extra] = process.argv.slice(2);
  if (mode === 'check' && destination === undefined) checkGit();
  else if (mode === 'copy' && destination && !extra.length) await copySource(await realpath(process.cwd()), destination);
  else throw new Error('Gebruik npm run release:check of npm run release:copy -- <nieuwe-map>.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Publicatiecontrole mislukt.');
  process.exitCode = 1;
}
