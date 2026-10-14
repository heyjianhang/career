const {app}=require('electron');
const fs=require('node:fs/promises');
const {printHtml}=require('./pdf.cjs');
// Keep the process alive after the hidden print window closes, until the file is flushed.
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 try{const [input,output]=process.argv.slice(process.argv.indexOf('--career-print')+1);const bytes=await printHtml(await fs.readFile(input,'utf8'));await fs.writeFile(output,bytes,{flag:'wx',mode:0o600});app.exit(0);}
 catch(e){console.error(e.message);app.exit(1);}
});
