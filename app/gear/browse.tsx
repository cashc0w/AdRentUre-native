import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Pressable } from 'react-native'
import React, { useState } from 'react'
import "../../globals.css";
import { useGearListings, type SortOption } from '../../hooks/useGearListings';
import { useAuth } from '../../contexts/AuthContext';
import { getAssetURL } from '../../lib/directus';
import { useRouter } from 'expo-router';

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

export default function Browse() {
  const [maxRadius, setMaxRadius] = useState<number | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('')
  const [filters, setFilters] = useState({
    category: '',
    condition: '',
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    search: ''
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [sort, setSort] = useState<SortOption>('date_created_desc')
  const { user } = useAuth()
  const router = useRouter()

  const { listings = [], loading, error, totalPages } = useGearListings({
    filters,
    page: currentPage,
    sort,
    maxRadius,
  })

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value
    }))
    setCurrentPage(1)
  }

  const handleSearchSubmit = () => {
    handleFilterChange('search', searchInput)
  }

  const clearSearch = () => {
    setSearchInput('')
    handleFilterChange('search', '')
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

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
    <ScrollView className="flex-1 bg-white">
      {/* Search Bar */}
      <View className="p-4">
        <View className="flex-row items-center border border-gray-300 rounded-lg p-2">
          <TextInput
            placeholder="Search for gear..."
            className="flex-1 text-black"
            value={searchInput}
            onChangeText={setSearchInput}
          />
          {searchInput ? (
            <TouchableOpacity onPress={clearSearch} className="p-2">
              <Text>✕</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity 
            onPress={handleSearchSubmit}
            className="bg-green-600 px-4 py-2 rounded-lg ml-2"
          >
            <Text className="text-white">Search</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filters */}
      <View className="p-4 bg-gray-50">
        <Text className="text-lg font-semibold mb-4">Filter & Sort</Text>
        <View className="flex-row flex-wrap gap-2">
          <View className="w-[48%]">
            <TextInput
              placeholder="Min Price"
              className="border border-gray-300 rounded-lg p-2"
              keyboardType="numeric"
              value={filters.minPrice?.toString() || ''}
              onChangeText={(value) => handleFilterChange('minPrice', value ? Number(value) : '')}
            />
          </View>
          <View className="w-[48%]">
            <TextInput
              placeholder="Max Price"
              className="border border-gray-300 rounded-lg p-2"
              keyboardType="numeric"
              value={filters.maxPrice?.toString() || ''}
              onChangeText={(value) => handleFilterChange('maxPrice', value ? Number(value) : '')}
            />
          </View>
          <View className="w-[48%]">
            <TextInput
              placeholder="Max Distance (km)"
              className="border border-gray-300 rounded-lg p-2"
              keyboardType="numeric"
              value={maxRadius?.toString() || ''}
              onChangeText={(value) => setMaxRadius(value ? Number(value) : undefined)}
            />
          </View>
        </View>
      </View>

      {/* Listings Grid */}
      <View className="p-4">
        {listings.length > 0 ? (
          <View className="flex-row flex-wrap gap-4">
            {listings.map((listing) => (
              <Pressable
                key={listing.id}
                onPress={() => router.push(`/gear/${listing.id}`)}
                className="w-[48%] rounded-xl overflow-hidden shadow-lg"
              >
                {listing.gear_images && listing.gear_images.length > 0 ? (
                  <Image
                    source={{ uri: getAssetURL(listing.gear_images[0].directus_files_id.id) }}
                    className="w-full h-48"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-full h-48 bg-gray-200 items-center justify-center">
                    <Text className="text-gray-400">No image</Text>
                  </View>
                )}
                <View className="p-2">
                  <Text className="font-semibold" numberOfLines={1}>{listing.title}</Text>
                  <Text className="text-green-600">${listing.price}/day</Text>
                  {listing.distance !== undefined && (
                    <Text className="text-gray-500 text-xs">
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
            <Text className="text-lg font-medium">No listings found</Text>
            <Text className="text-gray-500">Try adjusting your filters</Text>
          </View>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <View className="flex-row justify-center gap-2 mt-8">
            <TouchableOpacity
              onPress={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <Text>Previous</Text>
            </TouchableOpacity>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <TouchableOpacity
                key={page}
                onPress={() => handlePageChange(page)}
                className={`px-4 py-2 rounded-lg ${
                  currentPage === page ? 'bg-green-600' : 'border border-gray-300'
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
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <Text>Next</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  )
}