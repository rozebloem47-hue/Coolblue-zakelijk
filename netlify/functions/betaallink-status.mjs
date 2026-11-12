/**
 * Netlify function: status/resultaat van een betaallink-job.
 * GET /.netlify/functions/betaallink-status?job=<jobId>
 *
 * -> { status: "pending" }
 * -> { status: "ready", url: "https://pay.ideal.nl/...", fallback?: true }
 */

import { getStore } from '@netlify/blobs';

const STORE_NAME = 'betaallinks';

export const handler = async (event) => {
  const jobId = event.queryStringParameters?.job;
  if (!jobId) {
    return { statusCode: 400, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'job ontbreekt' }) };
  }

  const data = await getStore(STORE_NAME).get(jobId, { type: 'json' });

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(data ?? { status: 'pending' }),
  };
};
