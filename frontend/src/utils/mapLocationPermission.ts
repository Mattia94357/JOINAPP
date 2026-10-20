// Advisory inspection only. Never prompts, and never overrides a position result.
export type MapPermission = 'granted' | 'denied' | 'prompt' | 'unknown';
export const inspectMapPermission = async (): Promise<MapPermission> => {
  if (typeof navigator === 'undefined' || typeof navigator.permissions?.query !== 'function') return 'unknown';
  try {
    const result = await Promise.race([
      navigator.permissions.query({ name: 'geolocation' }).then(value => value.state),
      new Promise<'unknown'>(resolve => setTimeout(() => resolve('unknown'), 500)),
    ]);
    return ['granted', 'denied', 'prompt'].includes(result) ? result as MapPermission : 'unknown';
  } catch { return 'unknown'; }
};
