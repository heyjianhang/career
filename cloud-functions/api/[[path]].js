import {handleCloudPortal} from '../../portal/cloud.mjs';
import baseline from '../../site/downloads.json';

export async function onRequest(context) {
  const response = await handleCloudPortal(context.request, {env: context.env, baseline});
  response.headers.set('X-Career-Backend', 'node-blob-v1');
  return response;
}
