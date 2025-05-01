import { View, Text } from 'react-native'
import React from 'react'
import "../globals.css"
import { Tabs } from 'expo-router'
import { AuthProvider, useAuth } from '../contexts/AuthContext'
import TabNavigation from '../components/tabs'


const Layout = () => {

  return (
    <AuthProvider>
      <TabNavigation />
    </AuthProvider>
  )
}

export default Layout