import { View, Text, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Platform, TextInput } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useEffect, useState } from 'react'
import { Router, useLocalSearchParams, useRouter } from 'expo-router'
import { directus, DirectusGearListing, getGearListing, getClientWithUserID } from '../../lib/directus'
import { useAuth } from '../../contexts/AuthContext'
import { formatDistanceToNow, set } from 'date-fns'
import { initializeMapbox, MAPBOX_TOKEN, isExpoGo } from '../../lib/mapbox'
import { DirectusUser } from '@directus/sdk'
import { useRentalRequest } from '../../hooks/useCreateRentalRequest'

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

  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [message, setMessage] = useState('')
  const [listing, setListing] = useState<DirectusGearListing | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [showStartDatePicker, setShowStartDatePicker] = React.useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = React.useState(false);

  const { submitRequest, loading: submitting, error: submitError } = useRentalRequest({
    onSuccess: () => {
      alert('Rental request submitted successfully!')
    },
  })

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

  useEffect(() => {
    async function fetchListing() {
      try {
        setLoading(true)
        const data = await getGearListing(id as string)
        setListing(data)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchListing()
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

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString();
  };

  // Handle date picker changes with proper event handling
  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartDatePicker(false);
    }
    if (selectedDate) {
      setStartDate(selectedDate);
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndDatePicker(false);
    }
    if (selectedDate) {
      setEndDate(selectedDate);
    }
  };

  // For iOS, we need to handle the confirm/cancel actions
  const confirmStartDate = () => {
    setShowStartDatePicker(false);
  };

  const confirmEndDate = () => {
    setShowEndDatePicker(false);
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate || !listing) return

    if (!user) {
      alert('You must be logged in to submit a rental request')
      return
    }

    const clientRenter = await getClientWithUserID(user.id)
    if (!clientRenter) {
      throw new Error('Failed to get or create client renter')
    }

    if (!listing.owner) {
      throw new Error('Gear listing has no owner')
    }

    const rentalRequest = await submitRequest({
      gear_listing: listing.id,
      renter: clientRenter.id,
      owner: listing.owner.id,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      message: message?.trim(),
    })
  }

  // Web-specific date input component
  const WebDateInput = ({ value, onChange, placeholder, disabled = false }: {
    value: Date | null;
    onChange: (date: Date | null) => void;
    placeholder: string;
    disabled?: boolean;
  }) => {
    if (Platform.OS !== 'web') return null;
    
    return (
      <input
        type="date"
        value={value ? value.toISOString().split('T')[0] : ''}
        onChange={(e) => {
          const date = e.target.value ? new Date(e.target.value) : null;
          onChange(date);
        }}
        disabled={disabled}
        min={new Date().toISOString().split('T')[0]}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: '1px solid #D1D5DB',
          borderRadius: '6px',
          backgroundColor: 'white',
          fontSize: '16px',
          color: value ? '#3B82F6' : '#9CA3AF'
        }}
      />
    );
  };

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

  // Dynamically import Mapbox components only if not in Expo Go and not on web
  let MapView, Camera, ShapeSource, FillLayer
  if (!isExpoGo && Platform.OS !== 'web') {
    const mapbox = require('@rnmapbox/maps')
    MapView = mapbox.MapView
    Camera = mapbox.Camera
    ShapeSource = mapbox.ShapeSource
    FillLayer = mapbox.FillLayer
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Back Button */}
      <View className="p-4 pt-6 flex-row items-center">
        <TouchableOpacity
          onPress={() => router.push('/gear/browse')}
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
              className={`h-2 w-2 rounded-full mx-1 ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'
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

        {/* Rental Request Form */}
        <View>
          {!user ? (
            <TouchableOpacity
              onPress={() => router.push('/auth')}
              className="bg-green-600 py-4 rounded-lg mt-6"
            >
              <Text className="text-white font-semibold text-center text-lg">
                Login to Request
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="bg-gray-50 p-6 rounded-lg mt-6">
              <Text className="text-xl font-semibold mb-4 text-gray-900">Request to Rent</Text>

              {submitError && (
                <View className="mb-4 bg-red-100 border border-red-400 px-4 py-3 rounded">
                  <Text className="text-red-700 font-bold">Error: </Text>
                  <Text className="text-red-700">{submitError.message}</Text>
                </View>
              )}

              <View className="flex-row gap-4 mb-4">
                {/* Start Date */}
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </Text>
                  {Platform.OS === 'web' ? (
                    <WebDateInput
                      value={startDate}
                      onChange={setStartDate}
                      placeholder="Select start date"
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowStartDatePicker(true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                    >
                      <Text className={`${startDate ? 'text-blue-500' : 'text-gray-400'}`}>
                        {formatDate(startDate)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* End Date */}
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </Text>
                  {Platform.OS === 'web' ? (
                    <WebDateInput
                      value={endDate}
                      onChange={setEndDate}
                      placeholder="Select end date"
                      disabled={!startDate}
                    />
                  ) : (
                    <TouchableOpacity
                      onPress={() => setShowEndDatePicker(true)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                      disabled={!startDate}
                    >
                      <Text className={`${endDate ? 'text-blue-500' : 'text-gray-400'}`}>
                        {formatDate(endDate)}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Native Date Pickers for Mobile */}
              {Platform.OS !== 'web' && showStartDatePicker && (
                <View>
                  <DateTimePicker
                    value={startDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleStartDateChange}
                    minimumDate={new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      onPress={confirmStartDate}
                      className="bg-blue-500 py-2 px-4 rounded mt-2"
                    >
                      <Text className="text-white text-center">Confirm</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {Platform.OS !== 'web' && showEndDatePicker && (
                <View>
                  <DateTimePicker
                    value={endDate || startDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleEndDateChange}
                    minimumDate={startDate || new Date()}
                  />
                  {Platform.OS === 'ios' && (
                    <TouchableOpacity
                      onPress={confirmEndDate}
                      className="bg-blue-500 py-2 px-4 rounded mt-2"
                    >
                      <Text className="text-white text-center">Confirm</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {/* Message Input */}
              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Message (Optional)
                </Text>
                <TextInput
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={3}
                  className="text-blue-500 w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
                  placeholder="Add a message to the owner..."
                  placeholderTextColor="#9CA3AF"
                  textAlignVertical="top"
                />
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                className={`w-full py-3 px-6 rounded-lg ${!startDate || !endDate || submitting
                  ? 'bg-gray-400'
                  : 'bg-green-500'
                  }`}
                onPress={handleSubmit}
                disabled={!startDate || !endDate || submitting}
              >
                <Text className="text-white text-center font-medium">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </ScrollView>
  )
}