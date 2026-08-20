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
    .activity-pin{box-sizing:border-box;width:38px;height:45px;padding:0;overflow:hidden;border:2px solid #f6c445;border-radius:19px 19px 19px 7px;background:#171713;box-shadow:0 6px 16px rgba(0,0,0,.55);transform:rotate(-45deg);transition:opacity .14s ease,transform .18s ease}
    .activity-pin img{width:100%;height:100%;object-fit:cover;transform:rotate(45deg) scale(1.32);clip-path:circle(42% at 50% 50%)}
    .activity-pin.selected{box-shadow:0 0 0 3px #fff,0 7px 20px rgba(0,0,0,.65);transform:rotate(-45deg) scale(1.12)}
    .activity-pin.zoom-hidden{opacity:0;pointer-events:none}
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
    const map=new maptilersdk.Map({container:'map',style:${safeJson(styleId)},language:maptilersdk.Language.ENGLISH,center:[${longitude},${latitude}],zoom:12.5,attributionControl:{},navigationControl:false});
    const notifySelection=(activityId)=>{
      selectedActivityId=activityId;
      document.querySelectorAll('.activity-pin').forEach((card)=>card.classList.toggle('selected',card.dataset.activityId===activityId));
      const message=JSON.stringify({type:'join-map-activity-select',activityId});
      if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(message);
    };
    map.on('load',()=>{
      map.addSource('activities',{type:'geojson',data:{type:'FeatureCollection',features:activities.map((activity)=>({type:'Feature',geometry:{type:'Point',coordinates:[activity.longitude,activity.latitude]},properties:{activityId:activity.id}}))},cluster:true,clusterMaxZoom:14,clusterRadius:58});
      map.addLayer({id:'activity-clusters',type:'circle',source:'activities',filter:['has','point_count'],paint:{'circle-color':'#171713','circle-radius':['step',['get','point_count'],20,10,24,30,29,100,34],'circle-stroke-width':2,'circle-stroke-color':'#f6c445','circle-opacity':.96}});
      map.addLayer({id:'activity-cluster-count',type:'symbol',source:'activities',filter:['has','point_count'],layout:{'text-field':['get','point_count_abbreviated'],'text-size':14},paint:{'text-color':'#f6c445'}});
      map.addLayer({id:'activity-points',type:'circle',source:'activities',filter:['!', ['has','point_count']],maxzoom:15,paint:{'circle-color':'#171713','circle-radius':7,'circle-stroke-width':2,'circle-stroke-color':'#f6c445'}});
      map.on('click','activity-clusters',(event)=>{const feature=event.features&&event.features[0];if(!feature)return;const count=Number(feature.properties.point_count||0);window.ReactNativeWebView?.postMessage(JSON.stringify({type:'join-map-cluster-select',activityCount:count}));map.getSource('activities').getClusterExpansionZoom(feature.properties.cluster_id).then((zoom)=>map.easeTo({center:feature.geometry.coordinates,zoom,duration:500})).catch(()=>{})});
      const pins=[];
      activities.forEach((activity)=>{
        const card=document.createElement('button');card.type='button';card.className='activity-pin'+(activity.id===selectedActivityId?' selected':'');card.dataset.activityId=activity.id;card.setAttribute('aria-label',activity.title+' activity');
        if(activity.coverImage){const image=document.createElement('img');image.src=activity.coverImage;image.alt='';card.appendChild(image)}
        card.addEventListener('click',(event)=>{event.stopPropagation();notifySelection(activity.id)});
        new maptilersdk.Marker({element:card,anchor:'bottom'}).setLngLat([activity.longitude,activity.latitude]).addTo(map);pins.push(card);
      });
      const syncPins=()=>pins.forEach((pin)=>pin.classList.toggle('zoom-hidden',map.getZoom()<15));map.on('zoom',syncPins);syncPins();
    });
    if(${showsUserLocation ? 'true' : 'false'}){
      const user=document.createElement('div');user.className='user-location';
      new maptilersdk.Marker({element:user,anchor:'center'}).setLngLat([${longitude},${latitude}]).addTo(map);
    }
  </script>
</body>
</html>`;
