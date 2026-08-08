import type { MapActivity } from './MapModeMap.types';
import { getMapActivityIconGlyph } from '../utils/mapActivityIcons';

type MapHtmlOptions = {
  latitude: number;
  longitude: number;
  activities: MapActivity[];
  selectedActivityId: string;
  showsUserLocation: boolean;
  apiKey: string;
  styleId: string;
};

const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');

export const buildMapTilerHtml = ({
  latitude,
  longitude,
  activities,
  selectedActivityId,
  showsUserLocation,
  apiKey,
  styleId,
}: MapHtmlOptions) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link href="https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.css" rel="stylesheet">
  <script src="https://cdn.maptiler.com/maptiler-sdk-js/v4.0.2/maptiler-sdk.umd.min.js"></script>
  <style>
    @font-face{font-family:Ionicons;src:url('https://cdn.jsdelivr.net/npm/@expo/vector-icons@13.0.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf')}
    html,body,#map{height:100%;margin:0;background:#151815;overflow:hidden}
    .maplibregl-ctrl-attrib{font-size:9px!important;color:rgba(255,255,255,.58)!important;background:rgba(10,10,10,.72)!important}
    .maplibregl-ctrl-attrib a{color:#d8b75c!important}
    .activity-card{position:relative;box-sizing:border-box;width:60px;height:84px;padding:0;overflow:hidden;border:1px solid rgba(255,255,255,.38);border-radius:11px;background:#171717;box-shadow:0 7px 18px rgba(0,0,0,.48);transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
    .activity-card.selected{transform:scale(1.09);border-color:#f6c445;box-shadow:0 8px 22px rgba(0,0,0,.56),0 0 0 1px rgba(246,196,69,.15)}
    .activity-card img,.activity-image{display:block;width:100%;height:100%;object-fit:cover;background:#25251f}
    .activity-shade{position:absolute;inset:38% 0 0;background:linear-gradient(180deg,transparent,rgba(4,4,4,.2) 28%,rgba(4,4,4,.86) 100%)}
    .activity-icon{position:absolute;left:7px;bottom:7px;width:22px;height:22px;border-radius:11px;display:grid;place-items:center;background:rgba(8,8,8,.74);color:#f6c445;font:14px Ionicons}
    .user-location{width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:#4285f4;box-shadow:0 0 0 5px rgba(66,133,244,.2),0 2px 7px rgba(0,0,0,.45)}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const activities=${safeJson(activities.map((activity) => ({
      ...activity,
      iconGlyph: getMapActivityIconGlyph(activity.category),
    })))};
    let selectedActivityId=${safeJson(selectedActivityId)};
    maptilersdk.config.apiKey=${safeJson(apiKey)};
    const map=new maptilersdk.Map({container:'map',style:${safeJson(styleId)},language:maptilersdk.Language.ENGLISH,center:[${longitude},${latitude}],zoom:13,attributionControl:{},navigationControl:false});
    const notifySelection=(activityId)=>{
      selectedActivityId=activityId;
      document.querySelectorAll('.activity-card').forEach((card)=>card.classList.toggle('selected',card.dataset.activityId===activityId));
      const activity=activities.find((candidate)=>candidate.id===activityId);
      if(activity)map.easeTo({center:[activity.longitude,activity.latitude],duration:450});
      const message=JSON.stringify({type:'join-map-activity-select',activityId});
      if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);
    };
    activities.forEach((activity)=>{
      const card=document.createElement('button');
      card.type='button';card.className='activity-card'+(activity.id===selectedActivityId?' selected':'');card.dataset.activityId=activity.id;card.setAttribute('aria-label',activity.title+' activity');
      const image=activity.coverImage?document.createElement('img'):document.createElement('span');
      if(activity.coverImage){image.src=activity.coverImage;image.alt=''}else image.className='activity-image';
      const shade=document.createElement('span');shade.className='activity-shade';
      const icon=document.createElement('span');icon.className='activity-icon';icon.textContent=activity.iconGlyph;icon.setAttribute('aria-hidden','true');
      card.appendChild(image);card.appendChild(shade);card.appendChild(icon);card.addEventListener('click',(event)=>{event.stopPropagation();notifySelection(activity.id)});
      new maptilersdk.Marker({element:card,anchor:'bottom'}).setLngLat([activity.longitude,activity.latitude]).addTo(map);
    });
    if(${showsUserLocation ? 'true' : 'false'}){
      const user=document.createElement('div');user.className='user-location';
      new maptilersdk.Marker({element:user,anchor:'center'}).setLngLat([${longitude},${latitude}]).addTo(map);
    }
  </script>
</body>
</html>`;
