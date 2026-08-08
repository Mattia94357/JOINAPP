import React, { useEffect, useMemo, useRef } from 'react';
import type { MapModeMapProps } from './MapModeMap.types';

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

export default function MapModeMap({
  initialRegion,
  showsUserLocation,
  activities,
  selectedActivityId,
  onSelectActivity,
}: MapModeMapProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activityIds = useMemo(() => new Set(activities.map((activity) => activity.id)), [activities]);

  const html = useMemo(() => {
    const locationIndicator = showsUserLocation
      ? `L.circleMarker([${initialRegion.latitude},${initialRegion.longitude}],{radius:7,color:'#fff',weight:2,fillColor:'#4285f4',fillOpacity:1}).addTo(map);`
      : '';
    const markerScript = activities.map((activity) => {
      const image = activity.coverImage
        ? `<img src="${escapeHtml(activity.coverImage)}" alt="">`
        : '<span class="activity-image"></span>';
      const markerHtml = `<button class="activity-card${activity.id === selectedActivityId ? ' selected' : ''}" data-activity-id="${escapeHtml(activity.id)}">${image}<span>${escapeHtml(activity.title)}</span></button>`;
      const safeMarkerHtml = JSON.stringify(markerHtml).replace(/</g, '\\u003c');
      const safeId = JSON.stringify(activity.id).replace(/</g, '\\u003c');

      return `(() => { const icon=L.divIcon({className:'join-activity-marker',html:${safeMarkerHtml},iconSize:[142,44],iconAnchor:[71,22]});const marker=L.marker([${activity.latitude},${activity.longitude}],{icon}).addTo(map);marker.on('click',()=>{document.querySelectorAll('.activity-card.selected').forEach((card)=>card.classList.remove('selected'));marker.getElement()?.querySelector('.activity-card')?.classList.add('selected');window.parent.postMessage({type:'join-map-activity-select',activityId:${safeId}},'*');});})();`;
    }).join('');

    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#1b1d1a}.leaflet-control-attribution{font:9px sans-serif;background:rgba(10,10,10,.76)!important;color:#aaa}.leaflet-control-attribution a{color:#d8b75c}.leaflet-tile{filter:brightness(.62) saturate(.52) contrast(1.08)}.join-activity-marker{background:transparent;border:0}.activity-card{box-sizing:border-box;width:142px;height:44px;padding:4px 10px 4px 4px;border-radius:12px;border:1px solid rgba(246,196,69,.2);background:rgba(10,10,10,.94);box-shadow:0 3px 10px rgba(0,0,0,.4);display:flex;align-items:center;color:#fff;font:900 11px system-ui,sans-serif;cursor:pointer}.activity-card.selected{border-color:#f6c445;background:rgba(18,17,12,.97)}.activity-card img,.activity-image{width:34px;height:34px;flex:0 0 34px;border-radius:8px;object-fit:cover;background:#25251f}.activity-card span:last-child{min-width:0;margin-left:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${initialRegion.latitude},${initialRegion.longitude}],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);${locationIndicator}${markerScript}</script></body></html>`;
  // Selection is handled inside the iframe so tapping a card never resets a panned map.
  // The source only changes when the resolved location or visible activity set changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, initialRegion, showsUserLocation]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const activityId = event.data?.type === 'join-map-activity-select'
        ? event.data.activityId
        : undefined;
      if (typeof activityId === 'string' && activityIds.has(activityId)) {
        onSelectActivity(activityId);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activityIds, onSelectActivity]);

  return React.createElement('iframe', {
    ref: iframeRef,
    title: 'Interactive map',
    srcDoc: html,
    style: { width: '100%', height: '100%', border: 0 },
    sandbox: 'allow-scripts allow-same-origin',
  });
}
