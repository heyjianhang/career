import {readFile,writeFile,mkdir,cp,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const source=path.join(root,'browser-extension'),out=path.join(root,'build/browser-extension');
await mkdir(path.join(out,'icons'),{recursive:true});
// Reuse the desktop's existing PNG icon chunks, without an image dependency.
const icon=await readFile(path.join(root,'desktop/assets/icon.icns'));
for(let offset=8;offset<icon.length;){
  const type=icon.toString('ascii',offset,offset+4),size=icon.readUInt32BE(offset+4);
  if(size<8||offset+size>icon.length)throw new Error('Invalid icon chunk');
  const pixels={icp4:16,icp5:32,ic07:128}[type];
  if(pixels)await writeFile(path.join(out,`icons/${pixels}.png`),icon.subarray(offset+8,offset+size));
  offset+=size;
}
const files=['manifest.json','model.js','capture.js','store.js','background.js','popup.html','popup.js','styles.css'];
for(const name of files)await cp(path.join(source,name),path.join(out,name));
await cp(path.join(root,'LICENSE'),path.join(out,'LICENSE'));
for(const size of [16,32,128])await readFile(path.join(out,`icons/${size}.png`));
const manifest=JSON.parse(await readFile(path.join(out,'manifest.json'),'utf8'));
// Portable uncompressed ZIP with an explicit allowlist; no samples/history/credentials.
const names=[...files,'LICENSE',...(await readdir(path.join(out,'icons'))).filter(x=>/^(16|32|128)\.png$/.test(x)).map(x=>'icons/'+x)];
function crc32(buffer){let crc=0xffffffff;for(const b of buffer){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;
for(const name of names){const data=await readFile(path.join(out,name)),filename=Buffer.from(name),crc=crc32(data);const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt32LE(crc,14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(filename.length,26);local.push(h,filename,data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);central.push(c,filename);offset+=h.length+filename.length+data.length;}
const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(names.length,8);end.writeUInt16LE(names.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
const zip=path.join(root,`build/career-job-clipper-${manifest.version}.zip`);await writeFile(zip,Buffer.concat([...local,directory,end]));
console.log(JSON.stringify({directory:out,zip,files:names.length}));
