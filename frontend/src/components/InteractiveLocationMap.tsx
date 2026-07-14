import InteractiveLocationMap from './InteractiveLocationMap.web';

export type InteractiveLocationMapProps = {
  coordinate: { latitude: number; longitude: number };
  approximate: boolean;
};

export default InteractiveLocationMap;
