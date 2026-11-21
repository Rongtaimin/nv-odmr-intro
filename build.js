// 纯静态站点构建：仅复制浏览器运行所需文件到 dist/。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'dist');
const files = [
  'index.html',
  'product.html',
  'results.html',
  'styles.css',
  'src/main.js',
  'src/physics.js',
  'src/esr-split.js',
  'src/rotating-frame.js',
  'assets/product.png',
  'papers/Micron-resolved+quantum+precision+measurement+of+magnetic+field+at+the+Tesla+level.pdf',
  'papers/Scalar_Magnetic_Field_Measurement_Based_on_Nitrogen-Vacancy_Centers_in_Diamond.pdf',
];

fs.rmSync(out, { recursive: true, force: true });
for (const file of files) {
  const source = path.join(root, file);
  const target = path.join(out, file);
  if (!fs.statSync(source).isFile()) throw new Error(`不是有效文件：${file}`);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}
console.log(`静态构建完成：${files.length} 个文件 → dist/`);
