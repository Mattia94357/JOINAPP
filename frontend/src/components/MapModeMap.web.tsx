import React, { useEffect, useMemo, useRef } from 'react';
import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import './MapModeMap.web.css';
import type { MapActivity, MapModeMapProps } from './MapModeMap.types';

type MapTilerMapProps = MapModeMapProps & { mapTilerApiKey: string };

const CLUSTER_SOURCE = 'join-activities';
const CLUSTER_LAYER = 'join-activity-clusters';
const CLUSTER_COUNT_LAYER = 'join-activity-cluster-count';
const POINT_LAYER = 'join-activity-points';
const PHOTO_PIN_ZOOM = 15;

const activityGeoJson = (activities: MapActivity[]) => ({
  type: 'FeatureCollection' as const,
  features: activities.map((activity) => ({
    type: 'Feature' as const,
    geometry: { type: 'Point' as const, coordinates: [activity.longitude, activity.latitude] },
    properties: { activityId: activity.id },
  })),
});

const activityPin = (activity: MapActivity, selected: boolean, onPress: () => void) => {
  const marker = document.createElement('button');
  marker.type = 'button';
  marker.className = `join-map-activity-pin${selected ? ' selected' : ''}`;
  marker.setAttribute('aria-label', `${activity.title} activity`);
  if (activity.coverImage) {
    const image = document.createElement('img');
    image.src = activity.coverImage;
    image.alt = '';
    marker.appendChild(image);
  }
  const tip = document.createElement('span');
  tip.className = 'join-map-activity-pin-tip';
  marker.appendChild(tip);
  marker.addEventListener('click', (event) => {
    event.stopPropagation();
    onPress();
  });
  return marker;
};

function MapTilerMap({
  initialRegion, showsUserLocation, userCoordinate, recenterRequest, activities, selectedActivityId, onSelectActivity,
  onSelectCluster, onViewportChange, mapTilerApiKey, mapStyleId,
}: MapTilerMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maptilersdk.Map | null>(null);
  const activityMarkersRef = useRef<Array<{ id: string; marker: maptilersdk.Marker; element: HTMLElement }>>([]);
  const userMarkerRef = useRef<maptilersdk.Marker | null>(null);
  const activitiesRef = useRef(activities);
  const onSelectActivityRef = useRef(onSelectActivity);
  const onSelectClusterRef = useRef(onSelectCluster);
  const onViewportChangeRef = useRef(onViewportChange);

  activitiesRef.current = activities;
  onSelectActivityRef.current = onSelectActivity;
  onSelectClusterRef.current = onSelectCluster;
  onViewportChangeRef.current = onViewportChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return undefined;
    const map = new maptilersdk.Map({
      container: containerRef.current,
      apiKey: mapTilerApiKey,
      style: mapStyleId,
      language: maptilersdk.Language.ENGLISH,
      center: [initialRegion.longitude, initialRegion.latitude],
      zoom: 12.5,
      attributionControl: {},
      navigationControl: false,
    });
    mapRef.current = map;

    const syncPhotoPins = () => {
      const visible = map.getZoom() >= PHOTO_PIN_ZOOM;
      activityMarkersRef.current.forEach(({ element }) => element.classList.toggle('zoom-hidden', !visible));
    };
    const handleLoad = () => {
      map.addSource(CLUSTER_SOURCE, {
        type: 'geojson', data: activityGeoJson(activitiesRef.current), cluster: true,
        clusterMaxZoom: 14, clusterRadius: 58,
      } as any);
      map.addLayer({
        id: CLUSTER_LAYER, type: 'circle', source: CLUSTER_SOURCE, filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#171713',
          'circle-radius': ['step', ['get', 'point_count'], 20, 10, 24, 30, 29, 100, 34],
          'circle-stroke-width': 2, 'circle-stroke-color': '#F6C445', 'circle-opacity': 0.96,
        },
      } as any);
      map.addLayer({
        id: CLUSTER_COUNT_LAYER, type: 'symbol', source: CLUSTER_SOURCE, filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 14, 'text-font': ['Open Sans Bold'] },
        paint: { 'text-color': '#F6C445' },
      } as any);
      map.addLayer({
        id: POINT_LAYER, type: 'circle', source: CLUSTER_SOURCE, filter: ['!', ['has', 'point_count']],
        maxzoom: PHOTO_PIN_ZOOM,
        paint: { 'circle-color': '#171713', 'circle-radius': 7, 'circle-stroke-width': 2, 'circle-stroke-color': '#F6C445' },
      } as any);
      map.on('click', CLUSTER_LAYER, (event: any) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id;
        const count = Number(feature?.properties?.point_count || 0);
        if (clusterId === undefined) return;
        onSelectClusterRef.current?.(count);
        const source = map.getSource(CLUSTER_SOURCE) as any;
        source.getClusterExpansionZoom(clusterId)
          .then((zoom: number) => map.easeTo({ center: feature.geometry.coordinates, zoom, duration: 500 }))
          .catch(() => undefined);
      });
      map.on('mouseenter', CLUSTER_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', CLUSTER_LAYER, () => { map.getCanvas().style.cursor = ''; });
      map.on('zoom', syncPhotoPins);
      syncPhotoPins();
    };
    map.on('load', handleLoad);
    map.on('moveend', () => {
      const center = map.getCenter();
      const bounds = map.getBounds();
      onViewportChangeRef.current?.({
        latitude: center.lat,
        longitude: center.lng,
        latitudeDelta: Math.abs(bounds.getNorth() - bounds.getSouth()),
        longitudeDelta: Math.abs(bounds.getEast() - bounds.getWest()),
      });
    });

    return () => {
      activityMarkersRef.current.forEach(({ marker }) => marker.remove());
      activityMarkersRef.current = [];
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [initialRegion.latitude, initialRegion.longitude, mapStyleId, mapTilerApiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource(CLUSTER_SOURCE) as any)?.setData(activityGeoJson(activities));
    activityMarkersRef.current.forEach(({ marker }) => marker.remove());
    activityMarkersRef.current = activities.map((activity) => {
      const element = activityPin(activity, activity.id === selectedActivityId, () => {
        onSelectClusterRef.current?.(null);
        onSelectActivityRef.current(activity.id);
      });
      element.classList.toggle('zoom-hidden', map.getZoom() < PHOTO_PIN_ZOOM);
      const marker = new maptilersdk.Marker({ element, anchor: 'bottom' })
        .setLngLat([activity.longitude, activity.latitude]).addTo(map);
      return { id: activity.id, marker, element };
    });
  }, [activities]);

  useEffect(() => {
    activityMarkersRef.current.forEach(({ id, element }) => element.classList.toggle('selected', id === selectedActivityId));
  }, [selectedActivityId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;
    if (!showsUserLocation || !userCoordinate) return;
    const element = document.createElement('div');
    element.className = 'join-map-user-location';
    userMarkerRef.current = new maptilersdk.Marker({ element, anchor: 'center' })
      .setLngLat([userCoordinate.longitude, userCoordinate.latitude]).addTo(map);
  }, [showsUserLocation, userCoordinate?.latitude, userCoordinate?.longitude]);

  useEffect(() => {
    if (!recenterRequest) return;
    mapRef.current?.easeTo({
      center: [recenterRequest.longitude, recenterRequest.latitude],
      zoom: 12.5,
      duration: 500,
    });
  }, [recenterRequest?.requestId]);

  return <div ref={containerRef} className="join-maptiler-map" />;
}

function OpenStreetMapFallback(props: MapModeMapProps) {
  const { initialRegion, showsUserLocation, userCoordinate, recenterRequest, activities, selectedActivityId, onSelectActivity, onSelectCluster } = props;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const activityIds = useMemo(() => new Set(activities.map((activity) => activity.id)), [activities]);
  const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
  const html = useMemo(() => `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css"><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script><style>html,body,#map{height:100%;margin:0;background:#16191b}.leaflet-control-attribution{font:9px sans-serif;background:rgba(10,10,10,.76)!important;color:#aaa}.leaflet-control-attribution a{color:#d8b75c}.leaflet-tile{filter:brightness(.78) saturate(.78) contrast(1.06)}.marker-cluster{display:grid!important;place-items:center;border:2px solid #f6c445;border-radius:50%;background:#171713;color:#f6c445;font:800 14px sans-serif;box-shadow:0 5px 16px #0008}.activity-pin{box-sizing:border-box;width:34px;height:42px;padding:0;border:2px solid #f6c445;border-radius:17px 17px 17px 5px;overflow:hidden;background:#171713;box-shadow:0 5px 14px #0009;transform:rotate(-45deg)}.activity-pin img{width:100%;height:100%;object-fit:cover;transform:rotate(45deg) scale(1.35)}.activity-pin.selected{box-shadow:0 0 0 3px #fff,0 6px 18px #000b}.join-pin{background:transparent;border:0}</style></head><body><div id="map"></div><script>let activities=${safeJson(activities)};let selected=${safeJson(selectedActivityId)};const selectPin=(activityId)=>{selected=activityId;document.querySelectorAll('.activity-pin').forEach((pin)=>pin.classList.toggle('selected',pin.dataset.activityId===activityId))};const map=L.map('map',{zoomControl:false}).setView([${initialRegion.latitude},${initialRegion.longitude}],12.5);let userMarker=null;const setUserLocation=(latitude,longitude)=>{if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return;if(!userMarker)userMarker=L.circleMarker([latitude,longitude],{radius:7,color:'#fff',weight:2,fillColor:'#4285f4',fillOpacity:1}).addTo(map);else userMarker.setLatLng([latitude,longitude])};L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles &copy; Esri &mdash; &copy; OpenStreetMap contributors'}).addTo(map);const group=L.markerClusterGroup({maxClusterRadius:58,disableClusteringAtZoom:15,showCoverageOnHover:false,iconCreateFunction:(cluster)=>L.divIcon({className:'marker-cluster',html:String(cluster.getChildCount()),iconSize:[46,46]})});const renderActivities=()=>{group.clearLayers();activities.forEach((a)=>{const photo=a.coverImage?'<img src="'+a.coverImage.replace(/"/g,'&quot;')+'" alt="">':'';const icon=L.divIcon({className:'join-pin',html:'<button data-activity-id="'+a.id+'" aria-label="'+a.title.replace(/"/g,'&quot;')+' activity" class="activity-pin'+(a.id===selected?' selected':'')+'">'+photo+'</button>',iconSize:[34,42],iconAnchor:[17,42]});const marker=L.marker([a.latitude,a.longitude],{icon});marker.on('click',()=>parent.postMessage({type:'join-map-activity-select',activityId:a.id},'*'));group.addLayer(marker)})};addEventListener('message',(event)=>{const message=event.data;if(message?.type==='join-map-activity-highlight')selectPin(message.activityId);if(message?.type==='join-map-recenter')map.flyTo([message.latitude,message.longitude],12.5,{duration:.5});if(message?.type==='join-map-user-location')setUserLocation(Number(message.latitude),Number(message.longitude));if(message?.type==='join-map-activities-update'&&Array.isArray(message.activities)){activities=message.activities;renderActivities()}});group.on('clusterclick',(event)=>parent.postMessage({type:'join-map-cluster-select',activityCount:event.layer.getChildCount()},'*'));map.addLayer(group);renderActivities();${showsUserLocation && userCoordinate ? `setUserLocation(${userCoordinate.latitude},${userCoordinate.longitude});` : ''}map.on('moveend',()=>{const center=map.getCenter();const bounds=map.getBounds();parent.postMessage({type:'join-map-viewport-change',latitude:center.lat,longitude:center.lng,latitudeDelta:Math.abs(bounds.getNorth()-bounds.getSouth()),longitudeDelta:Math.abs(bounds.getEast()-bounds.getWest())},'*')});</script></body></html>`, [initialRegion.latitude, initialRegion.longitude]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'join-map-activity-highlight', activityId: selectedActivityId }, '*');
  }, [selectedActivityId]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'join-map-activities-update', activities }, '*');
  }, [activities]);

  useEffect(() => {
    if (!userCoordinate) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'join-map-user-location', ...userCoordinate }, '*');
  }, [userCoordinate?.latitude, userCoordinate?.longitude]);

  useEffect(() => {
    if (!recenterRequest) return;
    iframeRef.current?.contentWindow?.postMessage({ type: 'join-map-recenter', ...recenterRequest }, '*');
  }, [recenterRequest?.requestId]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === 'join-map-cluster-select') {
        onSelectCluster?.(Number(event.data.activityCount) || null);
        return;
      }
      if (event.data?.type === 'join-map-viewport-change') {
        props.onViewportChange?.({
          latitude: Number(event.data.latitude),
          longitude: Number(event.data.longitude),
          latitudeDelta: Number(event.data.latitudeDelta) || 0.045,
          longitudeDelta: Number(event.data.longitudeDelta) || 0.045,
        });
        return;
      }
      const id = event.data?.type === 'join-map-activity-select' ? event.data.activityId : undefined;
      if (typeof id === 'string' && activityIds.has(id)) onSelectActivity(id);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [activityIds, onSelectActivity, onSelectCluster, props.onViewportChange]);

  return <iframe ref={iframeRef} title="Interactive map" srcDoc={html} className="join-map-fallback" sandbox="allow-scripts allow-same-origin" />;
}

export default function MapModeMap(props: MapModeMapProps) {
  return props.mapTilerApiKey
    ? <MapTilerMap {...props} mapTilerApiKey={props.mapTilerApiKey} />
    : <OpenStreetMapFallback {...props} />;
}
