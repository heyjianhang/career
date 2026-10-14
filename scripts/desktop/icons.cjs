// Rebuild all native icon formats from the same measured career c. wordmark.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const path=require('node:path');
const root=path.resolve(__dirname,'../..');
function ico(images){
 const header=Buffer.alloc(6+images.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(images.length,4);
 let offset=header.length;
 images.forEach(({size,png},i)=>{const at=6+i*16;header[at]=size===256?0:size;header[at+1]=header[at];header.writeUInt16LE(1,at+4);header.writeUInt16LE(32,at+6);header.writeUInt32LE(png.length,at+8);header.writeUInt32LE(offset,at+12);offset+=png.length;});
 return Buffer.concat([header,...images.map(i=>i.png)]);
}
function icns(images){
 const types={16:'icp4',32:'icp5',64:'icp6',128:'ic07',256:'ic08',512:'ic09',1024:'ic10'};
 const chunks=images.map(({size,png})=>{const h=Buffer.alloc(8);h.write(types[size]);h.writeUInt32BE(png.length+8,4);return Buffer.concat([h,png]);});
 const h=Buffer.alloc(8);h.write('icns');h.writeUInt32BE(8+chunks.reduce((s,c)=>s+c.length,0),4);return Buffer.concat([h,...chunks]);
}
app.whenReady().then(async()=>{
 app.dock?.hide();
 const win=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await win.loadURL('data:text/html,<meta charset="utf-8">');
 const rendered=await win.webContents.executeJavaScript(`(async()=>{
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  ctx.font='bold 800px Georgia';const m=ctx.measureText('c');
  const scale=440/(m.actualBoundingBoxAscent+m.actualBoundingBoxDescent);
  const font=800*scale,w=(m.actualBoundingBoxLeft+m.actualBoundingBoxRight)*scale;
  const radius=66,gap=66,total=w+gap+radius*2,left=(1024-total)/2,top=(1024-440)/2;
  const x=left+m.actualBoundingBoxLeft*scale,y=top+m.actualBoundingBoxAscent*scale;
  const glyph=(ink,dot)=>'<text x="'+x+'" y="'+y+'" font-family="Georgia,serif" font-size="'+font+'" font-weight="bold" fill="'+ink+'">c</text><circle cx="'+(left+w+gap+radius)+'" cy="'+(top+440-radius)+'" r="'+radius+'" fill="'+dot+'"/>';
  const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect x="20" y="20" width="984" height="984" rx="220" fill="#22352d"/>'+glyph('#f5f6f0','#a2bb79')+'</svg>';
  // Menu-bar mark uses a tighter frame so c. remains legible at 16 physical points.
  const tray='<svg xmlns="http://www.w3.org/2000/svg" viewBox="'+(left-26)+' '+(top-30)+' '+(total+52)+' 500">'+glyph('#000','#000')+'</svg>';
  async function raster(source,size,height=size){canvas.width=size;canvas.height=height;const img=new Image();img.src='data:image/svg+xml;base64,'+btoa(source);await img.decode();ctx.clearRect(0,0,size,height);ctx.drawImage(img,0,0,size,height);return canvas.toDataURL('image/png').split(',')[1];}
  const images=[];for(const size of [16,20,24,32,40,48,64,128,256,512,1024])images.push({size,data:await raster(svg,size)});
  return {svg,images,tray1:await raster(tray,22,16),tray2:await raster(tray,44,32),bounds:{left,top,width:total,height:440,centerX:left+total/2,centerY:top+220}};
 })()`);
 const out=path.join(root,'desktop/assets');await fs.mkdir(out,{recursive:true});
 const images=rendered.images.map(({size,data})=>({size,png:Buffer.from(data,'base64')}));
 await fs.writeFile(path.join(root,'desktop/icon.svg'),rendered.svg+'\n');
 await fs.writeFile(path.join(out,'icon.png'),images.find(i=>i.size===1024).png);
 await fs.writeFile(path.join(out,'icon.ico'),ico(images.filter(i=>i.size<=256)));
 await fs.writeFile(path.join(out,'icon.icns'),icns(images.filter(i=>[16,32,64,128,256,512,1024].includes(i.size))));
 await fs.writeFile(path.join(out,'tray.ico'),ico(images.filter(i=>i.size<=48)));
 await fs.writeFile(path.join(out,'trayTemplate.png'),Buffer.from(rendered.tray1,'base64'));
 await fs.writeFile(path.join(out,'trayTemplate@2x.png'),Buffer.from(rendered.tray2,'base64'));
 console.log(JSON.stringify({output:out,bounds:rendered.bounds}));app.exit(0);
}).catch(e=>{console.error(e);app.exit(1);});
