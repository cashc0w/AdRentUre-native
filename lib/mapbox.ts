import Mapbox from '@rnmapbox/maps';
import { Platform } from 'react-native';
import { directus } from './directus';
import Constants from 'expo-constants';

// Initialize Mapbox
export const initializeMapbox = (accessToken: string) => {
  Mapbox.setAccessToken(accessToken);
  
  // Set up platform-specific configurations
  if (Platform.OS === 'android') {
    Mapbox.setTelemetryEnabled(false);
  }
};

export const MAPBOX_TOKEN =
  Constants.expoConfig?.extra?.mapboxToken ||
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;



  export async function autocompleteAddress(query: string) {
    console.log("Mapbox  token:")
    console.log(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN);
    console.log(Constants.expoConfig?.extra?.mapboxToken);
    if (!query) return [];
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      query
    )}.json?autocomplete=true&access_token=${MAPBOX_TOKEN}`;
    try {
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();
      return data.features || [];
    } catch (error) {
      console.error("Error in autocompleteAddress:", error);
      return [];
    }
  }

// Geocoding functions using Directus
export const geocode = async (address: string) => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    address
  )}.json?access_token=${MAPBOX_TOKEN}`;
  console.log('url', url);
  const response = await fetch(url);
  if (!response.ok) throw new Error('Geocoding failed');
  return response.json();
};

export const reverseGeocode = async (latitude: number, longitude: number) => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${MAPBOX_TOKEN}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error('Reverse geocoding failed');
  return response.json();
};

// Location utilities
export interface Location {
  latitude: number;
  longitude: number;
  radius: number;
}

export function isLocationWithinRadius(
  userLocation: Location,
  listingLocation: Location
): boolean {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(listingLocation.latitude - userLocation.latitude);
  const dLon = toRad(listingLocation.longitude - userLocation.longitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(userLocation.latitude)) *
      Math.cos(toRad(listingLocation.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= listingLocation.radius;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Map style options
export const mapStyles = {
  default: 'mapbox://styles/mapbox/streets-v12',
  satellite: 'mapbox://styles/mapbox/satellite-v9',
  satelliteStreets: 'mapbox://styles/mapbox/satellite-streets-v12',
  navigation: 'mapbox://styles/mapbox/navigation-day-v1',
  navigationNight: 'mapbox://styles/mapbox/navigation-night-v1',
}; 