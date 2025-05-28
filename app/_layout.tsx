import { View, Text } from 'react-native'
import React, { useEffect } from 'react'
import "../globals.css"
import { Tabs } from 'expo-router'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import TabNavigation from '../components/tabs'
import { initializeMapbox, MAPBOX_TOKEN, resetMapboxInitialization } from '../lib/mapbox'
import { AppState, AppStateStatus } from 'react-native'

const Layout = () => {
  useEffect(() => {
    // Initialize Mapbox when the app starts
    initializeMapbox(MAPBOX_TOKEN);

    // Handle app state changes
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        // Reinitialize Mapbox when app comes to foreground
        resetMapboxInitialization();
        initializeMapbox(MAPBOX_TOKEN);
      }
    });

    // Cleanup
    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <AuthProvider>
      <TabNavigation />
    </AuthProvider>
  )
}

export default Layout