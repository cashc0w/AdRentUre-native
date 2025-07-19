import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Pressable, RefreshControl, Platform } from 'react-native'
import React, { useEffect, useState } from 'react'
import "../../globals.css";
import { useGearListings, type SortOption } from '../../hooks/useGearListings';
import { useAuth } from '../../contexts/AuthContext';
import { getAssetURL } from '../../lib/directus';
import { useRouter } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';

const categories = [
  'Camping',
  'Hiking',
  'Climbing',
  'Skiing',
  'Snowboarding',
  'Water Sports',
  'Other'
]

const conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor']

const sortOptions = [
  { value: 'date_created_desc', label: 'Newest First' },
  { value: 'date_created_asc', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
]

const WebDateInput = ({ value, onChange, placeholder, disabled = false, min }: {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder: string;
  disabled?: boolean;
  min?: string;
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
      min={min}
      style={{
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #D1D5DB',
        borderRadius: '6px',
        backgroundColor: 'white',
        fontSize: '16px',
      }}
    />
  );
};

export default function Browse() {
  
  const [searchInput, setSearchInput] = useState('')
  const [tempFilters, setTempFilters] = useState({
    category: '',
    condition: '',
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    maxDistance: undefined as number | undefined,
    search: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
  })
  const [filters, setFilters] = useState({
    category: '',
    condition: '',
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    maxDistance: undefined as number | undefined,
    search: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState<SortOption>('date_created_desc')
  const { user } = useAuth()
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false);

  const { listings = [], loading, error, totalPages } = useGearListings({
    filters,
    page: currentPage,
    sort,
    maxRadius: filters.maxDistance,
    userLocation: user?.location,
  })



  const handleTempFilterChange = (key: string, value: string | number | Date | null) => {
    setTempFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value
    }))
  }

  const handleSearchSubmit = () => {
    handleTempFilterChange('search', searchInput)
    console.log("user address", user?.location);
    console.log("search input", searchInput);
  }

  const clearSearch = () => {
    setSearchInput('')
    handleTempFilterChange('search', '')
  }

  const applyFilters = () => {
    setFilters(tempFilters)
    setCurrentPage(1)
  }

  const clearAllFilters = () => {
    const clearedFilters = {
      category: '',
      condition: '',
      minPrice: undefined,
      maxPrice: undefined,
      maxDistance: undefined,
      search: '',
      startDate: null,
      endDate: null,
    }
    setTempFilters(clearedFilters)
    setFilters(clearedFilters)
    setSearchInput('')
    setCurrentPage(1)
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const onRefresh = async () => {
    setRefreshing(true);
    applyFilters(); // This will refetch listings
    setRefreshing(false);
  };

  useEffect(() => {
    if (user && user.location) {
      applyFilters();
    }
  }, [user]);

  if (loading) return (
    <View className="flex-1 justify-center items-center">
      <ActivityIndicator size="large" color="#0000ff" />
    </View>
  )

  if (error) return (
    <View className="flex-1 justify-center items-center">
      <View className="bg-red-100 border border-red-400 p-4 rounded">
        <Text className="font-bold text-red-700">Error: </Text>
        <Text className="text-red-700">{error.message}</Text>
      </View>
    </View>
  )

  return (
    <ScrollView
      className="flex-1 bg-white"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header with Search and List Button */}
      <View className="p-4 bg-white shadow-sm  mt-16">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl font-bold text-gray-900">Browse Gear</Text>
          {user && (
            <TouchableOpacity
              onPress={() => router.push('/gear/new')}
              className="bg-green-600 px-4 py-2 rounded-lg"
            >
              <Text className="text-white font-medium">List Your Gear</Text>
            </TouchableOpacity>
          )}
        </View>
        <View className="flex-row items-center bg-gray-50 rounded-xl p-2">
          <TextInput
            placeholder="Search for gear..."
            className="flex-1 text-black px-2"
            value={searchInput}
            onChangeText={setSearchInput}
          />
          {searchInput ? (
            <TouchableOpacity onPress={clearSearch} className="p-2">
              <Text className="text-gray-500">✕</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity 
            onPress={handleSearchSubmit}
            className="bg-green-600 px-4 py-2 rounded-lg ml-2"
          >
            <Text className="text-white font-medium">Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <View className="p-4 bg-gray-50">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-lg font-semibold">Filters</Text>
          <TouchableOpacity 
            onPress={clearAllFilters}
            className="bg-gray-200 px-3 py-1 rounded-full"
          >
            <Text className="text-gray-600 text-sm">Clear All</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                onPress={() => handleTempFilterChange('category', category)}
                className={`mr-2 px-4 py-2 rounded-full ${
                  tempFilters.category === category ? 'bg-green-600' : 'bg-white'
                }`}
              >
                <Text className={tempFilters.category === category ? 'text-white' : 'text-gray-700'}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Condition Filter */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Condition</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {conditions.map((condition) => (
              <TouchableOpacity
                key={condition}
                onPress={() => handleTempFilterChange('condition', condition)}
                className={`mr-2 px-4 py-2 rounded-full ${
                  tempFilters.condition === condition ? 'bg-green-600' : 'bg-white'
                }`}
              >
                <Text className={tempFilters.condition === condition ? 'text-white' : 'text-gray-700'}>
                  {condition}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Price Range */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Price Range</Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <TextInput
                placeholder="Min Price"
                className="bg-white border border-gray-200 rounded-lg p-2"
                keyboardType="numeric"
                value={tempFilters.minPrice?.toString() || ''}
                onChangeText={(value) => handleTempFilterChange('minPrice', value ? Number(value) : '')}
              />
            </View>
            <View className="flex-1">
              <TextInput
                placeholder="Max Price"
                className="bg-white border border-gray-200 rounded-lg p-2"
                keyboardType="numeric"
                value={tempFilters.maxPrice?.toString() || ''}
                onChangeText={(value) => handleTempFilterChange('maxPrice', value ? Number(value) : '')}
              />
            </View>
          </View>
        </View>

        {/* Distance Filter */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Max Distance (km)</Text>
          <TextInput
            placeholder="Distance in km"
            className="bg-white border border-gray-200 rounded-lg p-2"
            keyboardType="numeric"
            value={tempFilters.maxDistance?.toString() || ''}
            onChangeText={(value) => handleTempFilterChange('maxDistance', value ? Number(value) : '')}
          />
        </View>

        {/* Availability Date Filter */}
        <View className="mb-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Availability</Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              {Platform.OS === 'web' ? (
                <WebDateInput
                  placeholder="Start Date"
                  value={tempFilters.startDate}
                  onChange={(date) => handleTempFilterChange('startDate', date)}
                />
              ) : (
                <DateTimePicker
                  value={tempFilters.startDate || new Date()}
                  onChange={(e, date) => handleTempFilterChange('startDate', date || null)}
                />
              )}
            </View>
            <View className="flex-1">
             {Platform.OS === 'web' ? (
                <WebDateInput
                  placeholder="End Date"
                  value={tempFilters.endDate}
                  onChange={(date) => handleTempFilterChange('endDate', date)}
                  disabled={!tempFilters.startDate}
                  min={tempFilters.startDate?.toISOString().split('T')[0]}
                />
              ) : (
                <DateTimePicker
                  value={tempFilters.endDate || tempFilters.startDate || new Date()}
                  onChange={(e, date) => handleTempFilterChange('endDate', date || null)}
                  minimumDate={tempFilters.startDate || new Date()}
                  disabled={!tempFilters.startDate}
                />
              )}
            </View>
          </View>
        </View>

        

        {/* Submit Filters Button */}
        <TouchableOpacity
          onPress={applyFilters}
          className="bg-green-600 py-3 rounded-lg"
        >
          <Text className="text-white font-medium text-center">Apply Filters</Text>
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
        <View className="mb-6 p-4">
          <Text className="text-sm font-medium text-gray-700 mb-2">Sort By</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
            {sortOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                onPress={() => setSort(option.value as SortOption)}
                className={`mr-2 px-4 py-2 rounded-full ${
                  sort === option.value ? 'bg-green-600' : 'bg-white'
                }`}
              >
                <Text className={sort === option.value ? 'text-white' : 'text-gray-700'}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

      {/* Listings Grid */}
      <View className="p-4">
        {listings.length > 0 ? (
          <View className="flex-row flex-wrap gap-4">
            {listings.map((listing) => (
              <Pressable
                key={listing.id}
                onPress={() => router.push({
                  pathname: `/gear/${listing.id}`,
                  params: {
                    startDate: filters.startDate?.toISOString(),
                    endDate: filters.endDate?.toISOString()
                  }
                })}
                className="w-[48%] rounded-xl overflow-hidden shadow-sm bg-white"
              >
                {listing.gear_images && listing.gear_images.length > 0 ? (
                  <Image
                    source={{ uri: getAssetURL(listing.gear_images[0].directus_files_id.id) }}
                    className="w-full h-48"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-48 bg-gray-100 items-center justify-center">
                    <Text className="text-gray-400">No image</Text>
                  </View>
                )}
                <View className="p-3">
                  <Text className="font-semibold text-gray-800" numberOfLines={1}>{listing.title}</Text>
                  <Text className="text-green-600 font-medium mt-1">${listing.price}/day</Text>
                  {listing.distance !== undefined && (
                    <Text className="text-gray-500 text-xs mt-1">
                      {listing.distance < 1
                        ? `${Math.round(listing.distance * 1000)}m away`
                        : `${listing.distance.toFixed(1)}km away`}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="items-center py-12">
            <Text className="text-lg font-medium text-gray-800">No listings found</Text>
            <Text className="text-gray-500 mt-1">Try adjusting your filters</Text>
          </View>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <View className="flex-row justify-center gap-2 mt-8">
            <TouchableOpacity
              onPress={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg ${
                currentPage === 1 ? 'bg-gray-100' : 'bg-white border border-gray-200'
              }`}
            >
              <Text className={currentPage === 1 ? 'text-gray-400' : 'text-gray-700'}>Previous</Text>
            </TouchableOpacity>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <TouchableOpacity
                key={page}
                onPress={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-lg ${
                  currentPage === page ? 'bg-green-600' : 'bg-white border border-gray-200'
                }`}
              >
                <Text className={currentPage === page ? 'text-white' : 'text-gray-700'}>
                  {page}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`px-4 py-2 rounded-lg ${
                currentPage === totalPages ? 'bg-gray-100' : 'bg-white border border-gray-200'
              }`}
            >
              <Text className={currentPage === totalPages ? 'text-gray-400' : 'text-gray-700'}>Next</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  )
}