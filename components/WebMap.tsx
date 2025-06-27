import React from 'react';
import { MapContainer, TileLayer, Marker, Polygon } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DirectusGearListing } from '../../lib/directus';
import L from 'leaflet';

// Fix for default icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

interface WebMapProps {
  gear: DirectusGearListing;
}

const WebMap: React.FC<WebMapProps> = ({ gear }) => {
  const position: [number, number] = [
    gear.polygon.coordinates[0][0][1],
    gear.polygon.coordinates[0][0][0],
  ];
  
  const polygonPositions: [number, number][] = gear.polygon.coordinates[0].map((p: [number, number]) => [p[1], p[0]]);

  return (
    <MapContainer center={position} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Polygon positions={polygonPositions} color="blue" />
    </MapContainer>
  );
};

export default WebMap; 