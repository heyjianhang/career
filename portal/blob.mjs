// Adapt project Blob storage to the small storage interface shared with local preview.
// Keep one object per event: object storage does not provide atomic counters or locks.
export function blobStore(store) {
  async function call(operation) {
    try { return await operation(); }
    catch (cause) {
      const message = cause?.code === 'QUOTA_EXCEEDED' ? '门户存储容量已满，请联系维护者处理。'
        : cause?.code === 'RATE_LIMITED' ? '门户存储请求过于频繁，请稍后重试。'
        : '门户存储暂时无法连接，请稍后重试。';
      // SDK errors can contain signed URLs or account details. Never return them to visitors.
      throw Object.assign(new Error(message), {status: 503});
    }
  }
  return {
    get: key => call(() => store.get(key, {type: 'text', consistency: 'strong'})),
    put: (key, value) => call(() => store.set(key, value, {cacheControl: 'no-store'})),
    async list({prefix = '', limit = 256, cursor} = {}) {
      // SDK 0.0.18 supports limit. Without it, listing would aggregate the whole store.
      const result = await call(() => store.list({prefix, limit, cursor, paginate: false, consistency: 'strong'}));
      return {keys: result.blobs.map(({key}) => ({key})), cursor: result.cursor, complete: !result.cursor};
    },
  };
}

export function blobNamespace(env = {}) {
  // PORTAL_ORIGIN is configured in production only. Preview must never write production events.
  return env.PORTAL_ORIGIN === 'https://career.heyjianhang.top' ? 'career-portal-production' : 'career-portal-preview';
}
