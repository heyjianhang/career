import {getStore} from '@edgeone/pages-blob';
import {blobNamespace, blobStore} from './blob.mjs';
import {handlePortal} from './server.mjs';

export function handleCloudPortal(request, {env = {}, baseline}) {
  let kv;
  try { kv = blobStore(getStore(blobNamespace(env))); }
  catch { /* An incomplete deployment must preserve public fallback downloads. */ }
  return handlePortal(request, {kv, env, baseline});
}
