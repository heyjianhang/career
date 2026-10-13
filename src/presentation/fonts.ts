import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);

// Embed the original licensed subsets used by the resume. The saved HTML is
// self-contained, and PDF text does not depend on a system font's glyph mapping.
export async function resumeFontCss(text: string): Promise<string> {
  const file = require.resolve('@fontsource-variable/noto-sans-sc');
  const css = await readFile(file, 'utf8');
  const points = [...new Set(Array.from(text, c => c.codePointAt(0)!))];
  const faces: string[] = [];
  for (const match of css.matchAll(/@font-face\s*\{[^}]+\}/g)) {
    const face = match[0];
    const ranges = face.match(/unicode-range:\s*([^;]+);/)?.[1];
    if (!ranges) throw new Error('中文字体缺少 Unicode 范围');
    const used = ranges.split(',').some(range => {
      const [low, high] = range.trim().replace(/^U\+/i, '').split('-').map(v => parseInt(v, 16));
      return points.some(p => p >= low! && p <= (high ?? low!));
    });
    if (!used) continue;
    const source = face.match(/url\((\.\/files\/[^)]+\.woff2)\)/)?.[1];
    if (!source) throw new Error('中文字体文件格式不支持');
    const data = await readFile(path.resolve(path.dirname(file), source));
    faces.push(face.replace(source, 'data:font/woff2;base64,' + data.toString('base64')));
  }
  const license = await readFile(require.resolve('@fontsource-variable/noto-sans-sc/LICENSE'), 'utf8');
  return `/* Noto Sans SC Variable — original Fontsource subsets.\n${license}\n*/\n${faces.join('\n')}`;
}
