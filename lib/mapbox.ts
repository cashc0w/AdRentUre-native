import Mapbox from '@rnmapbox/maps';
import { Platform } from 'react-native';
import { directus } from './directus';
import Constants from 'expo-constants';

let isInitialized = false;
let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 3;

export const isExpoGo = Constants.appOwnership === 'expo';

// Initialize Mapbox
export const initializeMapbox = (accessToken: string) => {
  if (isExpoGo) {
    console.warn('Mapbox is not available in Expo Go.');
    return;
  }

  try {
    if (!accessToken) {
      console.error('Mapbox access token is missing');
      return;
    }

    if (isInitialized) {
      console.log('Mapbox is already initialized');
      return;
    }

    console.log('Initializing Mapbox with token:', accessToken.substring(0, 5) + '...');
    Mapbox.setAccessToken(accessToken);
    
    // Set up platform-specific configurations
    if (Platform.OS === 'android') {
      Mapbox.setTelemetryEnabled(false);
    }

    isInitialized = true;
    initializationAttempts = 0;
  } catch (error) {
    console.error('Error initializing Mapbox:', error);
    if (!isInitialized && initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
      initializationAttempts++;
      console.log(`Retrying Mapbox initialization (attempt ${initializationAttempts}/${MAX_INITIALIZATION_ATTEMPTS})`);
      setTimeout(() => initializeMapbox(accessToken), 1000 * initializationAttempts);
    }
  }
};

// Reset initialization state (useful for testing or when token changes)
export const resetMapboxInitialization = () => {
  isInitialized = false;
  initializationAttempts = 0;
};

export const MAPBOX_TOKEN =
  Constants.expoConfig?.extra?.mapboxToken ||
  process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

export async function autocompleteAddress(query: string) {
  if (isExpoGo) {
    console.warn('Mapbox is not available in Expo Go.');
    return [];
  }

  if (!isInitialized) {
    console.error('Mapbox is not initialized');
    return [];
  }

  if (!query) return [];
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
    query
  )}.json?autocomplete=true&access_token=${MAPBOX_TOKEN}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Mapbox API error:', response.status, response.statusText);
      return [];
    }
    const data = await response.json();
    return data.features || [];
  } catch (error) {
    console.error("Error in autocompleteAddress:", error);
    return [];
  }
}

// Geocoding functions using Directus
export const geocode = async (address: string) => {
  if (isExpoGo) {
    console.warn('Mapbox is not available in Expo Go.');
    return;
  }

  if (!isInitialized) {
    throw new Error('Mapbox is not initialized');
  }

  try {
    console.log("Geocoding address:", address);
    const encodedAddress = encodeURIComponent(address);
    console.log("Encoded address:", encodedAddress);
    
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodedAddress}.json?access_token=${MAPBOX_TOKEN}`;
    console.log('Request URL:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Geocoding API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`Geocoding failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Geocoding error details:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      address,
      token: MAPBOX_TOKEN ? 'Token present' : 'Token missing'
    });
    throw error;
  }
};

export const reverseGeocode = async (latitude: number, longitude: number) => {
  if (isExpoGo) {
    console.warn('Mapbox is not available in Expo Go.');
    return;
  }

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