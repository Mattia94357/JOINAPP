import type { Region } from 'react-native-maps';

// A viewing position only: never a user's location or allowed hosting region.
export const WORLD_MAP_VIEWPORT: Region = { latitude: 0, longitude: 0, latitudeDelta: 170, longitudeDelta: 360 };
export const viewportZoom = (region: Region) => Math.max(1, Math.min(15, Math.log2(360 / Math.max(region.latitudeDelta, region.longitudeDelta))));
export const resolveWebMapConfig = (key?: string, style = 'streets-v4-dark') => {
  const apiKey = key?.trim();
  const keyIssue = !apiKey ? 'missing-key' : !/^[a-z\d_-]{8,}$/i.test(apiKey) || /your_|placeholder|replace_me/i.test(apiKey) ? 'invalid-key' : undefined;
  let styleId = style.trim();
  const validStyle = /^[a-z\d_-]+$/i.test(styleId) || (() => {
    try { return new URL(styleId).protocol === 'https:'; } catch { return false; }
  })();
  if (!validStyle) styleId = 'streets-v4-dark';
  return { apiKey: keyIssue ? undefined : apiKey, styleId,
    styleUrl: /^https:\/\//i.test(styleId) ? styleId : `https://api.maptiler.com/maps/${styleId}/style.json`,
    keyIssue, styleIssue: validStyle ? undefined : 'invalid-style' };
};

// Deliberately whitelist fields: SDK errors can contain URLs, keys and positions.
export const mapDiagnostic = (event: string, details: { width?: number; height?: number; status?: number; provider?: 'maptiler' | 'raster'; reason?: string } = {}) => {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return;
  console.info(`[JOIN map] ${event}`, {
    ...(details.width !== undefined ? { width: Math.round(details.width), height: Math.round(details.height || 0) } : {}),
    ...(details.status !== undefined ? { status: details.status } : {}),
    ...(details.provider ? { provider: details.provider } : {}),
    ...(details.reason && /^[a-z-]{1,40}$/.test(details.reason) ? { reason: details.reason } : {}),
  });
};
