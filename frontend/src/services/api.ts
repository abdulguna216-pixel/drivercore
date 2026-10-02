export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string[] | undefined> = {},
  ) {
    super(message);
  }
}
let csrfPromise: Promise<string> | undefined;
let csrfExpires = 0;
async function getCsrf() {
  if (!csrfPromise || Date.now() >= csrfExpires) {
    csrfExpires = Date.now() + 14 * 60 * 1000;
    csrfPromise = fetch('/api/auth/csrf', { credentials: 'include', cache: 'no-store', signal: AbortSignal.timeout(15000) }).then(async (response) => {
      if (!response.ok) throw new Error('CSRF unavailable');
      return (await response.json() as { token: string }).token;
    }).catch((error: unknown) => { csrfPromise = undefined; throw error; });
  }
  return csrfPromise;
}
export async function api<T>(path: string, options: RequestInit = {}, retriedCsrf = false): Promise<T> {
  let response: Response;
  try {
    let csrfHeaders: Record<string, string> = {};
    if (!['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase())) {
      csrfHeaders = { 'X-CSRF-Token': await getCsrf() };
    }
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...csrfHeaders,
        ...options.headers,
      },
      signal: options.signal || AbortSignal.timeout(15000),
    });
  } catch {
    throw new ApiError(
      'Не удалось связаться с сервером. Проверьте подключение и повторите попытку.',
      0,
    );
  }
  const data = await response
    .json()
    .catch(() => ({ message: 'Не удалось прочитать ответ сервера.' }));
  if (response.status === 403 && data.code === 'CSRF_INVALID' && !retriedCsrf) {
    csrfPromise = undefined;
    return api<T>(path, options, true);
  }
  if (path === '/auth/login' || path === '/auth/logout') csrfPromise = undefined;
  if (!response.ok)
    throw new ApiError(
      data.message || 'Не удалось выполнить действие.',
      response.status,
      data.fields,
    );
  return data as T;
}
let uploadConfig: Promise<{ direct: boolean }> | undefined;
export const send = async <T>(path: string, body: unknown, method = 'POST'): Promise<T> => {
  if (body instanceof FormData) {
    uploadConfig ||= api<{ direct: boolean }>('/uploads/config').catch((error: unknown) => { uploadConfig = undefined; throw error; });
    if ((await uploadConfig).direct) {
      const files = body.getAll('files').filter((value): value is File => value instanceof File && value.size > 0);
      if (files.length > 5) throw new ApiError('Максимум 5 файлов.', 400);
      const raw = Object.fromEntries([...body.entries()].filter(([key]) => key !== 'files'));
      const attachmentIds: string[] = [];
      const requestId = path.match(/^\/requests\/(\d+)\/files$/)?.[1];
      for (const file of files) {
        const ticket = await send<{ id: string; pathname: string; token: string }>('/uploads/tickets', { fileName: file.name, fileType: file.type, fileSize: file.size, ...(requestId ? { requestId: Number(requestId) } : {}) });
        const { put } = await import('@vercel/blob/client');
        await put(ticket.pathname, file, { access: 'private', token: ticket.token, contentType: file.type, abortSignal: AbortSignal.timeout(120000) });
        await send(`/uploads/tickets/${ticket.id}/complete`, {});
        attachmentIds.push(ticket.id);
      }
      body = { ...raw, attachmentIds };
    }
  }
  return api<T>(path, {
    method,
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
};
