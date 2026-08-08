import type { MapActivity } from './MapModeMap.types';

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
    html,body,#map{height:100%;margin:0;background:#151815;overflow:hidden}
    .maplibregl-ctrl-attrib{font-size:9px!important;color:rgba(255,255,255,.58)!important;background:rgba(10,10,10,.72)!important}
    .maplibregl-ctrl-attrib a{color:#d8b75c!important}
    .activity-card{box-sizing:border-box;width:142px;height:44px;padding:4px 10px 4px 4px;border:1px solid rgba(246,196,69,.25);border-radius:12px;display:flex;align-items:center;background:rgba(10,10,10,.96);box-shadow:0 4px 13px rgba(0,0,0,.48);color:#fff}
    .activity-card.selected{border-color:#f6c445;background:rgba(21,19,12,.98);box-shadow:0 4px 15px rgba(0,0,0,.55),0 0 0 1px rgba(246,196,69,.12)}
    .activity-card img,.activity-image{width:34px;height:34px;flex:0 0 34px;border-radius:8px;object-fit:cover;background:#25251f}
    .activity-title{min-width:0;margin-left:8px;overflow:hidden;color:#fff;font:900 11px/1.2 system-ui,sans-serif;text-overflow:ellipsis;white-space:nowrap}
    .user-location{width:14px;height:14px;border:2px solid #fff;border-radius:50%;background:#4285f4;box-shadow:0 0 0 5px rgba(66,133,244,.2),0 2px 7px rgba(0,0,0,.45)}
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const activities=${safeJson(activities)};
    let selectedActivityId=${safeJson(selectedActivityId)};
    maptilersdk.config.apiKey=${safeJson(apiKey)};
    const map=new maptilersdk.Map({container:'map',style:${safeJson(styleId)},language:maptilersdk.Language.ENGLISH,center:[${longitude},${latitude}],zoom:13,attributionControl:{},navigationControl:false});
    const notifySelection=(activityId)=>{
      selectedActivityId=activityId;
      document.querySelectorAll('.activity-card').forEach((card)=>card.classList.toggle('selected',card.dataset.activityId===activityId));
      const message=JSON.stringify({type:'join-map-activity-select',activityId});
      if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);
    };
    activities.forEach((activity)=>{
      const card=document.createElement('button');
      card.type='button';card.className='activity-card'+(activity.id===selectedActivityId?' selected':'');card.dataset.activityId=activity.id;card.setAttribute('aria-label',activity.title+' activity');
      const image=activity.coverImage?document.createElement('img'):document.createElement('span');
      if(activity.coverImage){image.src=activity.coverImage;image.alt=''}else image.className='activity-image';
      const title=document.createElement('span');title.className='activity-title';title.textContent=activity.title;
      card.appendChild(image);card.appendChild(title);card.addEventListener('click',(event)=>{event.stopPropagation();notifySelection(activity.id)});
      new maptilersdk.Marker({element:card,anchor:'center'}).setLngLat([activity.longitude,activity.latitude]).addTo(map);
    });
    if(${showsUserLocation ? 'true' : 'false'}){
      const user=document.createElement('div');user.className='user-location';
      new maptilersdk.Marker({element:user,anchor:'center'}).setLngLat([${longitude},${latitude}]).addTo(map);
    }
  </script>
</body>
</html>`;
