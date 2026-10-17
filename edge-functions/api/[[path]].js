import {handlePortal} from '../../portal/server.mjs';
import baseline from '../../site/downloads.json';

export function onRequest(context) {
  const kv = context.env.CAREER_PORTAL || (typeof CAREER_PORTAL === 'undefined' ? null : CAREER_PORTAL);
  return handlePortal(context.request, {kv, env: context.env, baseline});
}
