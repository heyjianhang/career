import {handleCloudPortal} from '../../portal/cloud.mjs';
import baseline from '../../site/downloads.json';

export function onRequest(context) {
  return handleCloudPortal(context.request, {env: context.env, baseline});
}
