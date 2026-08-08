import React, { useEffect, useMemo, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import './MapModeMap.web.css';
import type { MapActivity, MapModeMapProps } from './MapModeMap.types';

type MapTilerMapProps = MapModeMapProps & { mapTilerApiKey: string };

const markerCard = (activity: MapActivity, selected: boolean, onPress: () => void) => {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `join-map-activity-card${selected ? ' selected' : ''}`;
  card.setAttribute('aria-label', `${activity.title} activity`);

  if (activity.coverImage) {
    const image = document.createElement('img');
    image.src = activity.coverImage;
    image.alt = '';
    card.appendChild(image);
  } else {
    const imageFallback = document.createElement('span');
    imageFallback.className = 'join-map-activity-image';
    card.appendChild(imageFallback);
  }

  const title = document.createElement('span');
  title.className = 'join-map-activity-title';
  title.textContent = activity.title;
  card.appendChild(title);
  card.addEventListener('click', (event) => {
    event.stopPropagation();
    onPress();
  });
  return card;
};

function MapTilerMap({
  initialRegion,
  showsUserLocation,
  activities,
  selectedActivityId,
  onSelectActivity,
  mapTilerApiKey,
  mapStyleId,
}: MapTilerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maptilersdk.Map | null>(null);
  const activityMarkersRef = useRef<Array<{ id: string; marker: maptilersdk.Marker; element: HTMLElement }>>([]);
  const userMarkerRef = useRef<maptilersdk.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;

    mapRef.current = new maptilersdk.Map({
      container: containerRef.current,
      apiKey: mapTilerApiKey,
      style: mapStyleId,
      language: maptilersdk.Language.ENGLISH,
      center: [initialRegion.longitude, initialRegion.latitude],
      zoom: 13,
      attributionControl: {},
      navigationControl: false,
    });

    return () => {
      activityMarkersRef.current.forEach(({ marker }) => marker.remove());
      activityMarkersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [initialRegion.latitude, initialRegion.longitude, mapStyleId, mapTilerApiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    activityMarkersRef.current.forEach(({ marker }) => marker.remove());
    activityMarkersRef.current = activities.map((activity) => {
      const element = markerCard(
        activity,
        activity.id === selectedActivityId,
        () => onSelectActivity(activity.id),
      );
      const marker = new maptilersdk.Marker({ element, anchor: 'center' })
        .setLngLat([activity.longitude, activity.latitude])
        .addTo(map);
      return { id: activity.id, marker, element };
    });
  }, [activities, onSelectActivity]);

  useEffect(() => {
    activityMarkersRef.current.forEach(({ id, element }) => {
      element.classList.toggle('selected', id === selectedActivityId);
    });
  }, [selectedActivityId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!showsUserLocation) return;

    const element = document.createElement('div');
    element.className = 'join-map-user-location';
    userMarkerRef.current = new maptilersdk.Marker({ element, anchor: 'center' })
      .setLngLat([initialRegion.longitude, initialRegion.latitude])
      .addTo(map);
  }, [initialRegion.latitude, initialRegion.longitude, showsUserLocation]);

  return React.createElement('div', {
    ref: containerRef,
    className: 'join-maptiler-map',
    style: { position: 'absolute', inset: 0, backgroundColor: '#151815' },
  });
}

function OpenStreetMapFallback(props: MapModeMapProps) {
  const { initialRegion, showsUserLocation, activities, selectedActivityId, onSelectActivity } = props;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activityIds = useMemo(() => new Set(activities.map((activity) => activity.id)), [activities]);
  const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  const html = useMemo(() => {
    const locationIndicator = showsUserLocation ? `L.circleMarker([${initialRegion.latitude},${initialRegion.longitude}],{radius:7,color:'#fff',weight:2,fillColor:'#4285f4',fillOpacity:1}).addTo(map);` : '';
    const markers = activities.map((activity) => {
      const image = activity.coverImage ? `<img src="${escapeHtml(activity.coverImage)}" alt="">` : '<span class="activity-image"></span>';
      const content = JSON.stringify(`<button class="activity-card${activity.id === selectedActivityId ? ' selected' : ''}">${image}<span>${escapeHtml(activity.title)}</span></button>`).replace(/</g, '\\u003c');
      const id = JSON.stringify(activity.id).replace(/</g, '\\u003c');
      return `(()=>{const marker=L.marker([${activity.latitude},${activity.longitude}],{icon:L.divIcon({className:'join-activity-marker',html:${content},iconSize:[142,44],iconAnchor:[71,22]})}).addTo(map);marker.on('click',()=>{document.querySelectorAll('.activity-card.selected').forEach((card)=>card.classList.remove('selected'));marker.getElement()?.querySelector('.activity-card')?.classList.add('selected');window.parent.postMessage({type:'join-map-activity-select',activityId:${id}},'*')})})();`;
    }).join('');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#1b1d1a}.leaflet-control-attribution{font:9px sans-serif;background:rgba(10,10,10,.76)!important;color:#aaa}.leaflet-tile{filter:brightness(.62) saturate(.52)}.join-activity-marker{background:transparent;border:0}.activity-card{box-sizing:border-box;width:142px;height:44px;padding:4px 10px 4px 4px;border-radius:12px;border:1px solid rgba(246,196,69,.25);background:rgba(10,10,10,.96);display:flex;align-items:center;color:#fff;font:900 11px system-ui;box-shadow:0 3px 10px rgba(0,0,0,.45)}.activity-card.selected{border-color:#f6c445}.activity-card img,.activity-image{width:34px;height:34px;flex:0 0 34px;border-radius:8px;object-fit:cover;background:#25251f}.activity-card span:last-child{min-width:0;margin-left:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:false}).setView([${initialRegion.latitude},${initialRegion.longitude}],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);${locationIndicator}${markers}</script></body></html>`;
  }, [activities, initialRegion, showsUserLocation]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const id = event.data?.type === 'join-map-activity-select' ? event.data.activityId : undefined;
      if (typeof id === 'string' && activityIds.has(id)) onSelectActivity(id);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [activityIds, onSelectActivity]);

  return React.createElement('iframe', { ref: iframeRef, title: 'Interactive map', srcDoc: html, style: { width: '100%', height: '100%', border: 0 }, sandbox: 'allow-scripts allow-same-origin' });
}

export default function MapModeMap(props: MapModeMapProps) {
  return props.mapTilerApiKey
    ? <MapTilerMap {...props} mapTilerApiKey={props.mapTilerApiKey} />
    : <OpenStreetMapFallback {...props} />;
}
