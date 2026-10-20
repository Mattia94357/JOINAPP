import InteractiveLocationMap from './InteractiveLocationMap.web';

export type InteractiveLocationMapProps = {
  coordinate: { latitude: number; longitude: number };
  approximate: boolean;
  showMarker?: boolean;
  onSelectCoordinate?: (coordinate: { latitude: number; longitude: number }) => void;
};

export default InteractiveLocationMap;
