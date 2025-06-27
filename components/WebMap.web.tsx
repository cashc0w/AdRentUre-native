import React from 'react';
import { MapContainer, TileLayer, Circle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DirectusGearListing } from '../lib/directus';
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

// Haversine distance formula to calculate distance in meters
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const WebMap: React.FC<WebMapProps> = ({ gear }) => {
  const points: [number, number][] = gear.polygon.coordinates[0];

  // Calculate the center (centroid) of the polygon
  const centerLat = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  const centerLng = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const center: [number, number] = [centerLat, centerLng];

  // Calculate the radius as the maximum distance from the center to any vertex
  let radius = 0;
  points.forEach(point => {
    const distance = getDistanceFromLatLonInM(centerLat, centerLng, point[1], point[0]);
    if (distance > radius) {
      radius = distance;
    }
  });

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      <Circle center={center} radius={radius} pathOptions={{ color: 'blue', fillColor: 'blue' }} />
    </MapContainer>
  );
};

export default WebMap; 