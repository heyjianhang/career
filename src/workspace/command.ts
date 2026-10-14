import {readFile} from 'node:fs/promises';
import path from 'node:path';

/** Command shown to an Agent; execution still resolves and validates its own workspace. */
export async function workspaceCommand(workspace:string){
  try{const runtime=JSON.parse(await readFile(path.join(workspace,'.local/desktop-runtime.json'),'utf8'));
    if(runtime.schema==='career-desktop-runtime/v1')return process.platform==='win32'?'& .\\.local\\career.cmd':'./.local/career';
  }catch{}
  return 'npm run career --';
}
