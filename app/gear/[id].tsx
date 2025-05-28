import { View, Text, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Platform } from 'react-native'
import React, { useEffect, useState } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { directus, DirectusGearListing, getGearListing } from '../../lib/directus'
import { useAuth } from '../../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { initializeMapbox, MAPBOX_TOKEN, isExpoGo } from '../../lib/mapbox'

const { width } = Dimensions.get('window')

export default function GearDetail() {
  const params = useLocalSearchParams()
  const id = params.id as string
  const router = useRouter()
  const { user } = useAuth()
  const [gear, setGear] = useState<DirectusGearListing | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [mapboxInitialized, setMapboxInitialized] = useState(false)
  // Dynamically import Mapbox components only if not in Expo Go and not on web
  let MapView, Camera, ShapeSource, FillLayer
  if (!isExpoGo && Platform.OS !== 'web') {
    const mapbox = require('@rnmapbox/maps')
    MapView = mapbox.MapView
    Camera = mapbox.Camera
    ShapeSource = mapbox.ShapeSource
    FillLayer = mapbox.FillLayer
  }

  useEffect(() => {
    if (!isExpoGo && Platform.OS !== 'web') {
      try {
        initializeMapbox(MAPBOX_TOKEN)
        setMapboxInitialized(true)
      } catch (error) {
        console.error('Error initializing Mapbox:', error)
      }
    }
  }, [])

  useEffect(() => {
    if (id) {
      fetchGearItem()
    }
  }, [id])

  const fetchGearItem = async () => {
    try {
      const response = await getGearListing(id)
      setGear(response)
    } catch (error) {
      console.error('Error fetching gear item:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    )
  }

  if (!gear) {
    return (
      <View className="flex-1 justify-center items-center">
        <Text className="text-gray-500">Item not found</Text>
      </View>
    )
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Back Button */}
      <View className="p-4 pt-6 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.push('/gear')}
          className="flex-row items-center"
          accessibilityLabel="Go back to browse"
        >
          <Text style={{ fontSize: 22, marginRight: 4 }}>←</Text>
          <Text className="text-green-600 font-medium text-lg">Back</Text>
        </TouchableOpacity>
      </View>
      {/* Image Carousel */}
      <View className="relative">
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / width)
            setCurrentImageIndex(newIndex)
          }}
        >
          {gear.gear_images.map((image, index) => (
            <Image
              key={image.id}
              source={{ uri: `https://creative-blini-b15912.netlify.app/assets/${image.directus_files_id.id}` }}
              className="w-screen h-96"
              resizeMode="cover"
            />
          ))}
        </ScrollView>
        {/* Image Pagination */}
        <View className="absolute bottom-4 flex-row justify-center w-full">
          {gear.gear_images.map((_, index) => (
            <View
              key={index}
              className={`h-2 w-2 rounded-full mx-1 ${
                index === currentImageIndex ? 'bg-white' : 'bg-white/50'
              }`}
            />
          ))}
        </View>
      </View>

      <View className="p-4">
        {/* Title and Price */}
        <Text className="text-2xl font-bold text-gray-900">{gear.title}</Text>
        <Text className="text-2xl font-bold text-green-600 mt-2">
          ${gear.price}/day
        </Text>

        {/* Condition and Category */}
        <View className="flex-row mt-4 space-x-4">
          <View className="bg-gray-100 px-3 py-1 rounded-full">
            <Text className="text-gray-600 capitalize">{gear.condition.replace('_', ' ')}</Text>
          </View>
          <View className="bg-gray-100 px-3 py-1 rounded-full">
            <Text className="text-gray-600 capitalize">{gear.category}</Text>
          </View>
        </View>

        {/* Description */}
        <View className="mt-6">
          <Text className="text-lg font-semibold text-gray-900">Description</Text>
          <Text className="text-gray-600 mt-2">{gear.description}</Text>
        </View>

        {/* Location Map */}
        <View className="mt-6">
          <Text className="text-lg font-semibold text-gray-900 mb-2">Location</Text>
          <View className="h-48 rounded-lg overflow-hidden">
            {!isExpoGo && Platform.OS !== 'web' && mapboxInitialized && MapView ? (
              <MapView
                style={{ flex: 1 }}
                styleURL={require('@rnmapbox/maps').StyleURL.Street}
              >
                <Camera
                  zoomLevel={14}
                  centerCoordinate={[gear.polygon.coordinates[0][0][0], gear.polygon.coordinates[0][0][1]]}
                />
                <ShapeSource
                  id="polygon"
                  shape={gear.polygon}
                >
                  <FillLayer
                    id="polygonFill"
                    style={{
                      fillColor: '#22c55e',
                      fillOpacity: 0.3,
                    }}
                  />
                </ShapeSource>
              </MapView>
            ) : (
              <View className="flex-1 bg-gray-100 items-center justify-center">
                <Text className="text-gray-500">
                  {isExpoGo
                    ? 'Map not available in Expo Go'
                    : Platform.OS === 'web'
                    ? 'Map not available on web'
                    : 'Loading map...'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Owner Information */}
        <View className="mt-6 flex-row items-center">
          <View className="w-12 h-12 rounded-full bg-gray-200 items-center justify-center">
            <Text className="text-xl text-gray-600">
              {gear.owner.first_name[0]}{gear.owner.last_name[0]}
            </Text>
          </View>
          <View className="ml-3">
            <Text className="font-semibold text-gray-900">
              {gear.owner.first_name} {gear.owner.last_name}
            </Text>
            <Text className="text-gray-500">
              Listed {formatDistanceToNow(new Date(gear.date_created))} ago
            </Text>
          </View>
        </View>

        {/* Rental Request Button */}
        <TouchableOpacity
          onPress={() => {
            if (!user) {
              router.push('/auth/login')
              return
            }
            // TODO: Implement rental request logic
          }}
          className="bg-green-600 py-4 rounded-lg mt-6"
        >
          <Text className="text-white font-semibold text-center text-lg">
            Request to Rent
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}