import React, { useEffect, useMemo, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import './MapModeMap.web.css';
import type { MapActivity, MapModeMapProps } from './MapModeMap.types';
import { getMapActivityIconGlyph } from '../utils/mapActivityIcons';

type MapTilerMapProps = MapModeMapProps & { mapTilerApiKey: string };

const markerCard = (activity: MapActivity, selected: boolean, onPress: () => void) => {
  const marker = document.createElement('div');
  marker.className = `join-map-activity-marker${selected ? ' selected' : ''}`;
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'join-map-activity-card';
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

  const shade = document.createElement('span');
  shade.className = 'join-map-activity-shade';
  card.appendChild(shade);

  const icon = document.createElement('span');
  icon.className = 'join-map-activity-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = getMapActivityIconGlyph(activity.category);
  card.appendChild(icon);
  card.addEventListener('click', (event) => {
    event.stopPropagation();
    onPress();
  });
  marker.appendChild(card);
  return marker;
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
        () => {
          onSelectActivity(activity.id);
          map.easeTo({ center: [activity.longitude, activity.latitude], duration: 450 });
        },
      );
      const marker = new maptilersdk.Marker({ element, anchor: 'bottom' })
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
      const icon = escapeHtml(getMapActivityIconGlyph(activity.category));
      const content = JSON.stringify(`<button aria-label="${escapeHtml(activity.title)} activity" class="activity-card${activity.id === selectedActivityId ? ' selected' : ''}">${image}<span class="activity-shade"></span><span class="activity-icon">${icon}</span></button>`).replace(/</g, '\\u003c');
      const id = JSON.stringify(activity.id).replace(/</g, '\\u003c');
      return `(()=>{const marker=L.marker([${activity.latitude},${activity.longitude}],{icon:L.divIcon({className:'join-activity-marker',html:${content},iconSize:[60,84],iconAnchor:[30,84]})}).addTo(map);marker.on('click',()=>{document.querySelectorAll('.activity-card.selected').forEach((card)=>card.classList.remove('selected'));marker.getElement()?.querySelector('.activity-card')?.classList.add('selected');map.panTo([${activity.latitude},${activity.longitude}],{animate:true,duration:.45});window.parent.postMessage({type:'join-map-activity-select',activityId:${id}},'*')})})();`;
    }).join('');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>@font-face{font-family:Ionicons;src:url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@13.0.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')}html,body,#map{height:100%;margin:0;background:#16191b}.leaflet-control-attribution{font:9px sans-serif;background:rgba(10,10,10,.76)!important;color:#aaa}.leaflet-control-attribution a{color:#d8b75c}.leaflet-tile{filter:brightness(.78) saturate(.78) contrast(1.06)}.join-activity-marker{background:transparent;border:0}.activity-card{position:relative;box-sizing:border-box;width:60px;height:84px;padding:0;overflow:hidden;border-radius:11px;border:1px solid rgba(255,255,255,.38);background:#171717;box-shadow:0 7px 18px rgba(0,0,0,.48);transition:transform .18s ease,border-color .18s ease}.activity-card.selected{transform:scale(1.09);border-color:#f6c445;box-shadow:0 8px 22px rgba(0,0,0,.56),0 0 0 1px rgba(246,196,69,.15)}.activity-card img,.activity-image{display:block;width:100%;height:100%;object-fit:cover;background:#25251f}.activity-shade{position:absolute;inset:38% 0 0;background:linear-gradient(180deg,transparent,rgba(4,4,4,.2) 28%,rgba(4,4,4,.86) 100%)}.activity-icon{position:absolute;left:7px;bottom:7px;width:22px;height:22px;border-radius:11px;display:grid;place-items:center;background:rgba(8,8,8,.74);color:#f6c445;font:14px Ionicons}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:false}).setView([${initialRegion.latitude},${initialRegion.longitude}],13);L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri &mdash; Esri, TomTom, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors and the GIS User Community'}).addTo(map);${locationIndicator}${markers}</script></body></html>`;
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
