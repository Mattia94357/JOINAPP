import React from 'react';
import { colors } from '../theme';

type Props = {
  coordinate: { latitude: number; longitude: number };
  approximate: boolean;
};

export default function InteractiveLocationMap({ coordinate, approximate }: Props) {
  const zoom = approximate ? 11 : 13;
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#map{height:100%;margin:0;background:#1d1d1a}.leaflet-control-attribution{font-size:9px;background:rgba(10,10,10,.72)!important;color:#aaa}.leaflet-control-attribution a{color:#d8b75c}.join-pin{position:relative;width:28px;height:28px;border-radius:50% 50% 50% 0;background:${colors.primary};border:3px solid #171512;box-shadow:0 2px 10px rgba(0,0,0,.55);transform:rotate(-45deg)}.join-pin:after{content:'';position:absolute;width:8px;height:8px;border-radius:50%;background:#171512;left:7px;top:7px}</style></head><body><div id="map"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>const map=L.map('map',{zoomControl:true,attributionControl:true}).setView([${coordinate.latitude},${coordinate.longitude}],${zoom});L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(map);const icon=L.divIcon({className:'',html:'<div class="join-pin"></div>',iconSize:[30,36],iconAnchor:[15,34]});L.marker([${coordinate.latitude},${coordinate.longitude}],{icon}).addTo(map);</script></body></html>`;

  return React.createElement('iframe', {
    title: 'Interactive activity map',
    srcDoc: html,
    style: { width: '100%', height: '100%', border: 0 },
    sandbox: 'allow-scripts allow-same-origin',
  });
}
