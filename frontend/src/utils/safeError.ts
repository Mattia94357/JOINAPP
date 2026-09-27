type SafeErrorMetadata = { name: string; code?: string; status?: number; method?: string; path?: string; requestId?: string };

const shortToken = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? value : undefined;

export const safeErrorMetadata = (error: unknown): SafeErrorMetadata => {
  const candidate = typeof error === 'object' && error !== null ? error as any : {};
  const rawUrl = typeof candidate.config?.url === 'string' ? candidate.config.url : undefined;
  let path: string | undefined;
  if (rawUrl) {
    try { path = new URL(rawUrl, 'https://join.invalid').pathname.slice(0, 200); }
    catch { path = rawUrl.split('?')[0].slice(0, 200); }
  }
  return {
    name: shortToken(candidate.name) || 'Error',
    code: shortToken(candidate.code),
    status: typeof candidate.response?.status === 'number' ? candidate.response.status : undefined,
    method: typeof candidate.config?.method === 'string' ? candidate.config.method.toUpperCase().slice(0, 10) : undefined,
    path,
    requestId: shortToken(candidate.response?.headers?.['x-request-id']),
  };
};

export const reportFrontendError = (context: string, error: unknown) => {
  console.warn(`[JOIN] ${context}`, safeErrorMetadata(error));
};
