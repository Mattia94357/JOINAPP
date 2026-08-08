import React from 'react';
import type { Region } from 'react-native-maps';

type Props = {
  region: Region;
  showsUserLocation: boolean;
};

export default function MapModeMap({ region, showsUserLocation }: Props) {
  const locationIndicator = showsUserLocation
    ? `L.circleMarker([${region.latitude},${region.longitude}],{radius:7,color:'#fff',weight:2,fillColor:'#4285f4',fillOpacity:1}).addTo(map);`
    : '';
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#1b1d1a}.leaflet-control-attribution{font:9px sans-serif;background:rgba(10,10,10,.76)!important;color:#aaa}.leaflet-control-attribution a{color:#d8b75c}.leaflet-tile{filter:brightness(.62) saturate(.52) contrast(1.08)}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:false,attributionControl:true}).setView([${region.latitude},${region.longitude}],13);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);${locationIndicator}</script></body></html>`;

  return React.createElement('iframe', {
    key: `${region.latitude}-${region.longitude}-${showsUserLocation}`,
    title: 'Interactive map',
    srcDoc: html,
    style: { width: '100%', height: '100%', border: 0 },
    sandbox: 'allow-scripts allow-same-origin',
  });
}
