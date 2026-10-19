import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=new URL('../dist/',import.meta.url),html=fs.readFileSync(new URL('index.html',base),'utf8'),app=fs.readFileSync(new URL('app.mjs',base),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(x=>x[1]);assert.equal(new Set(ids).size,ids.length,'unique element IDs');
for(const [,id]of app.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),`missing #${id}`);
for(const [,file]of html.matchAll(/(?:src|href)="\.\/([^"]+)"/g))assert.ok(fs.existsSync(new URL(file.split('?')[0],base)),file);
assert.ok(html.includes('<option value="gain">'));assert.ok(html.includes('id="recommendLimit" type="range" min="0" max="100" step="5" value="100"'));
assert.ok(!/id="double"[^>]*checked/.test(html),'double must be explicitly confirmed');
for(const file of ['app.mjs','worker.mjs','dashboard.mjs','history.mjs','strategy.mjs']){
 const text=fs.readFileSync(new URL(file,base),'utf8');for(const [,path]of text.matchAll(/(?:from\s+|import\()'\.\/([^']+)'/g))assert.ok(fs.existsSync(new URL(path.split('?')[0],base)),path);
}
console.log('Interface: unique IDs, app bindings, local module/assets and explicit defaults passed (not browser QA).');
