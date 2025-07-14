import { View, Text, ScrollView, Image, TouchableOpacity, Dimensions, ActivityIndicator, Platform, TextInput, Modal, Pressable, Alert } from 'react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useEffect, useState, useMemo } from 'react'
import { Router, useLocalSearchParams, useRouter } from 'expo-router'
import { directus, DirectusGearListing, getGearListing, getCurrentClient, getGearListings, checkAvailability } from '../../lib/directus'
import { useAuth } from '../../contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { initializeMapbox, MAPBOX_TOKEN, isExpoGo } from '../../lib/mapbox'
import { useBundles } from '../../hooks/usebundles';
import { Checkbox } from 'expo-checkbox';
import WebMap from '../../components/WebMap';

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
  
  const { createBundleWithItems } = useBundles();
  
  const [otherListings, setOtherListings] = useState<DirectusGearListing[]>([]);
  
  // State for the modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalStartDate, setModalStartDate] = useState<Date>(new Date());
  const [modalEndDate, setModalEndDate] = useState<Date | null>(null);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, 'available' | 'unavailable' | 'checking'>>({});
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [bundleCreationLoading, setBundleCreationLoading] = useState(false);

  const allOwnerListings = useMemo(() => {
    if (!gear) return [];
    // Ensure the current gear is first in the list
    return [gear, ...otherListings.filter(l => l.id !== gear.id)];
  }, [gear, otherListings]);

  // Handler for date changes inside the modal (corrected type)
  const handleDateCheck = async (start: Date, end: Date | null) => {
    setModalStartDate(start);
    setModalEndDate(end);

    if (!end) {
      // Don't run check if end date isn't set
      setAvailabilityMap({});
      return;
    }

    setCheckedItems(new Set());
    
    const availabilityPromises = allOwnerListings.map(async (listing) => {
      setAvailabilityMap(prev => ({ ...prev, [listing.id]: 'checking' }));
      const isAvailable = await checkAvailability(listing.id, start.toISOString(), end.toISOString());
      return { id: listing.id, status: isAvailable ? 'available' : 'unavailable' };
    });

    const results = await Promise.all(availabilityPromises);
    const newAvailabilityMap = results.reduce((acc, result) => {
      acc[result.id] = result.status as 'available' | 'unavailable' | 'checking';
      return acc;
    }, {} as Record<string, 'available' | 'unavailable' | 'checking'>);
    setAvailabilityMap(newAvailabilityMap);
  };

  // Handler for checkbox changes
  const handleToggleChecked = (itemId: string) => {
    setCheckedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  // Handler for submitting the bundle
  const handleCreateBundle = async () => {
    if (!modalStartDate || !modalEndDate || !gear?.owner?.id || checkedItems.size === 0) return;
    setBundleCreationLoading(true);
    try {
      await createBundleWithItems({
        ownerId: gear.owner.id,
        gearIds: Array.from(checkedItems),
        startDate: modalStartDate,
        endDate: modalEndDate,
      });
      Alert.alert('Success!', 'Bundle created and added to your cart.');
      setIsModalVisible(false);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not create bundle.');
    } finally {
      setBundleCreationLoading(false);
    }
  };


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

  const fetchAllData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch the main gear listing
      const gearData = await getGearListing(id as string);
      setGear(gearData);
      setListing(gearData); // Keep both states in sync for now

      if (!gearData || !gearData.owner?.id) {
        throw new Error('Gear or owner not found.');
      }

      // 2. Fetch other listings from the same owner
      const allOwnerListings = await getGearListings({ filters: { owner: gearData.owner.id } });
      
      // 3. Filter out the current listing to get only the "other" ones
      const filteredOtherListings = allOwnerListings.filter((item: DirectusGearListing) => item.id !== id);
      setOtherListings(filteredOtherListings);

    } catch (err) {
      setError(err as Error);
      console.error("Failed to fetch page data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [id]);

  // Clear availability error when dates change
  useEffect(() => {
    // setAvailabilityError(null); // This state variable was removed
  }, [startDate, endDate]);

  const formatDate = (date: Date | null) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString();
  };

  const openDatePicker = (target: 'start' | 'end') => {
    // setDatePickerTarget(target); // This state variable was removed
    const dateToEdit = target === 'start' ? startDate : endDate;
    const initialDate = dateToEdit || (target === 'end' ? startDate : new Date()) || new Date();
    // setTempDate(initialDate); // This state variable was removed

    if (Platform.OS === 'ios') {
      // setDatePickerModalVisible(true); // This state variable was removed
    } else {
      // For Android, we use the default picker which is already a modal
      // setShowStartDatePicker(target === 'start'); // This state variable was removed
      // setShowEndDatePicker(target === 'end'); // This state variable was removed
    }
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    const isAndroid = Platform.OS === 'android';
    if (isAndroid) {
      // setShowStartDatePicker(false); // This state variable was removed
      // setShowEndDatePicker(false); // This state variable was removed
    }

    if ((isAndroid && event.type === 'set') || !isAndroid) {
      if (selectedDate) {
        if (isAndroid) {
          // if (datePickerTarget === 'start') { // This state variable was removed
          //   setStartDate(selectedDate);
          //   if (endDate && selectedDate > endDate) setEndDate(null);
          // } else {
          //   setEndDate(selectedDate);
          // }
          // setDatePickerTarget(null); // This state variable was removed
        } else {
          // setTempDate(selectedDate); // This state variable was removed
        }
      }
    } else {
      // if (isAndroid) setDatePickerTarget(null); // This state variable was removed
    }
  };

  const confirmDate = () => {
    // if (datePickerTarget === 'start') { // This state variable was removed
    //   setStartDate(tempDate);
    //   if (endDate && tempDate > endDate) {
    //     setEndDate(null);
    //   }
    // } else {
    //   setEndDate(tempDate);
    // }
    // setDatePickerModalVisible(false); // This state variable was removed
    // setDatePickerTarget(null); // This state variable was removed
  };

  // This section is no longer needed as requests are made from the cart.
  // const handleSubmit = async () => {
  //   if (!startDate || !endDate || !listing) return

  //   if (!user) {
  //     alert('You must be logged in to submit a rental request')
  //     return
  //   }

  //   const clientRenter = await getClientWithUserID(user.id)
  //   if (!clientRenter) {
  //     throw new Error('Failed to get or create client renter')
  //   }

  //   if (!listing.owner) {
  //     throw new Error('Gear listing has no owner')
  //   }

  //   const rentalRequest = await submitRequest({
  //     gear_listing: listing.id,
  //     renter: clientRenter.id,
  //     owner: listing.owner.id,
  //     start_date: startDate.toISOString(),
  //     end_date: endDate.toISOString(),
  //     message: message?.trim(),
  //   })
  // }

  // const bundleForOwnerExists = bundles.some(b => b.owner?.id === gear?.owner.id); // This state variable was removed
  // const datesRequired = !bundleForOwnerExists; // This state variable was removed

  // const isAlreadyInBundle = bundles.some(b => b.gear_listings?.some(item => String((item as any).gear_listings_id?.id) === id)); // This state variable was removed

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
            {Platform.OS === 'web' ? (
              <WebMap gear={gear} />
            ) : !isExpoGo && mapboxInitialized && MapView ? (
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
                    : 'Loading map...'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Availability Badge */}
       

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

              {/* Conditional Date Pickers */}
              {/* datesRequired && !isAlreadyInBundle && ( // This state variable was removed */}
                <View>
                  
                  {/* availabilityError && ( // This state variable was removed */}
                    
                  {/* ) */}
                </View>
              {/* ) */}
              {/* Submit and Add to Cart Buttons */}
              {user && (
                <TouchableOpacity
                  onPress={() => setIsModalVisible(true)}
                  className="w-full py-3 px-6 rounded-lg mt-4 bg-blue-600"
                >
                  <Text className="text-white text-center font-bold text-lg">
                    Check Availability & Build Bundle
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* BUNDLE BUILDER MODAL */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={isModalVisible}
          onRequestClose={() => setIsModalVisible(false)}
        >
          <View className="flex-1 justify-center items-center bg-black/50 p-4">
            <View className="bg-white rounded-xl w-full max-w-2xl max-h-[90%] p-6">
              <Text className="text-2xl font-bold mb-4">Build Your Bundle</Text>
              
              {/* Date Pickers */}
              <View className="flex-row gap-4 mb-4">
                <View className="flex-1">
                  <Text className="font-semibold mb-1">Start Date</Text>
                  <DateTimePicker value={modalStartDate} onChange={(e,d) => d && handleDateCheck(d, modalEndDate)} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold mb-1">End Date</Text>
                  <DateTimePicker value={modalEndDate || modalStartDate} onChange={(e,d) => d && handleDateCheck(modalStartDate, d)} minimumDate={modalStartDate} />
                </View>
              </View>

              {/* Gear List */}
              <ScrollView className="border-t border-b border-gray-200">
                {allOwnerListings.map(listing => {
                  const status = availabilityMap[listing.id];
                  const isChecked = checkedItems.has(listing.id);
                  return (
                    <View key={listing.id} className="flex-row items-center p-2 border-b border-gray-100">
                      <Checkbox value={isChecked} onValueChange={() => handleToggleChecked(listing.id)} disabled={status !== 'available'} />
                      <Image source={{uri: `https://creative-blini-b15912.netlify.app/assets/${listing.gear_images?.[0]?.directus_files_id?.id}`}} className="w-12 h-12 rounded-md mx-3" />
                      <Text className="flex-1 font-semibold">{listing.title}</Text>
                      {status === 'checking' && <ActivityIndicator size="small" />}
                      {status === 'available' && <View className="px-2 py-1 rounded-full bg-green-100"><Text className="text-green-800 text-xs">Available</Text></View>}
                      {status === 'unavailable' && <View className="px-2 py-1 rounded-full bg-red-100"><Text className="text-red-800 text-xs">Unavailable</Text></View>}
                    </View>
                  )
                })}
              </ScrollView>

              {/* Action Buttons */}
              <View className="mt-4 flex-row gap-4">
                <TouchableOpacity onPress={() => setIsModalVisible(false)} className="flex-1 p-3 rounded-lg bg-gray-200">
                  <Text className="text-center font-bold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleCreateBundle} disabled={bundleCreationLoading || checkedItems.size === 0} className="flex-1 p-3 rounded-lg bg-blue-600 disabled:bg-gray-400">
                  <Text className="text-white text-center font-bold">
                    {bundleCreationLoading ? 'Creating...' : `Add ${checkedItems.size} Items`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* More from this owner */}
        {otherListings.length > 0 && (
          <View className="mt-8">
            <Text className="text-xl font-bold mb-4 text-gray-800">More from {gear.owner.first_name}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
              {otherListings.map((listing) => (
                <TouchableOpacity key={listing.id} onPress={() => router.push(`/gear/${listing.id}`)} className="mr-4">
                  <View className="w-48">
                    <Image
                      source={{ uri: `https://creative-blini-b15912.netlify.app/assets/${listing.gear_images?.[0]?.directus_files_id?.id}?width=200&height=150&fit=cover` }}
                      className="w-full h-32 rounded-lg bg-gray-200"
                    />
                    <Text className="mt-2 font-semibold text-gray-700" numberOfLines={1}>{listing.title}</Text>
                    <Text className="text-green-600 font-bold">${listing.price}/day</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

      </View>
    </ScrollView>
  )
}