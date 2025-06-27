import React from 'react';
import { View } from 'react-native';
import { DirectusGearListing } from '../lib/directus';

// This is a dummy component for native platforms.
// The actual web implementation is in WebMap.web.tsx

interface WebMapProps {
  gear: DirectusGearListing;
}

const WebMap: React.FC<WebMapProps> = ({ gear }) => {
  return <View />;
};

export default WebMap; 