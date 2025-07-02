'use client'

import { useState, useEffect, useRef } from 'react'
import * as React from 'react'
import { useLocalSearchParams, useRouter} from 'expo-router'
import { DirectusUser, DirectusClientUser, directus, getGearListings, getReviews, DirectusReview } from '../../lib/directus'
import { readItem } from '@directus/sdk'
import { useGearListings } from '../../hooks/useGearListings'
import { useReviews } from '../../hooks/useReviews'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'expo-router'
import { useClientWithUserID } from '../../hooks/useClientWithUserID'
import { getAssetURL } from '../../lib/directus'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Pressable,
} from 'react-native'
import StarRating from '../../components/StarRating'

// Reviews component is now a "dumb" component
function ReviewsSection({
  reviews,
  loading,
  error
}: {
  reviews: DirectusReview[] | null,
  loading: boolean,
  error: Error | null
}) {
  if (loading) {
    return <Text className="text-gray-500">Loading reviews...</Text>
  }

  if (error) {
    return <Text className="text-red-500">Error loading reviews: {error.message}</Text>
  }

  // Calculate average rating
  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
    : 0

  return (
    <View>
      <View>
        <Text className="text-xl font-bold mb-1 text-gray-900">Reviews</Text>
        <View className="flex-row items-center mb-4">
        <Text className="text-yellow-400 mr-1">★</Text>
        <Text className="text-gray-900">{averageRating.toFixed(1)}</Text>
        <Text className="text-gray-500 ml-1">({reviews?.length || 0} reviews)</Text>
      </View>
        {reviews && reviews.length > 0 ? (
          <View className="space-y-4">
            {reviews.map((review) => (
              <View key={review.id} className="bg-white rounded-lg shadow-md p-6 mb-2">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center space-x-2">
                    <Link href={`/profile/${review.reviewer.id}`} asChild>
                      <Pressable>
                        <Text className="font-medium text-gray-900">
                          {review.reviewer.first_name} {review.reviewer.last_name}
                        </Text>
                      </Pressable>
                    </Link>
                    <View className="flex-row items-center ml-2">
                      <Text className="text-yellow-400">{'★'.repeat(review.rating)}</Text>
                      <Text className="text-gray-300">{'★'.repeat(5 - review.rating)}</Text>
                    </View>
                  </View>
                  <Text className="text-gray-500 text-sm">
                    {review.date_created.split("T")[0]}
                  </Text>
                </View>
                <Text className="text-gray-600">{review.comment}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-gray-500">No reviews yet</Text>
        )}
      </View>
    </View>
  )
}

export default function ProfilePage() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { user, logout, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [client, setClient] = useState<DirectusClientUser | null>(null)
  const [listings, setListings] = useState<any[]>([])
  const [reviews, setReviews] = useState<DirectusReview[] | null>([])
  const [error, setError] = useState<string | null>(null)

  const fetchProfileData = async () => {
    if (!id || typeof id !== 'string') {
      setError("Invalid profile ID.")
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // --- SEQUENTIAL FETCHING ---

      // 1. Fetch Client Data. This also handles auth refresh if the token is expired.
      console.log("ProfilePage: Fetching client data...");
      const clientData = await directus.request(
        readItem('clients', id, { fields: ['*', 'user.*'] })
      ) as DirectusClientUser;
      setClient(clientData);
      console.log("ProfilePage: Client data fetched.");

      // 2. Fetch Listings for this client
      // We pass the client's user object to prevent another `readMe` call.
      console.log("ProfilePage: Fetching listings...");
      const listingsData = await getGearListings({ filters: { owner: clientData.id } }, clientData.user);
      setListings(listingsData);
      console.log("ProfilePage: Listings fetched.");
      
      // 3. Fetch Reviews for this client
      console.log("ProfilePage: Fetching reviews...");
      const reviewsData = await getReviews(clientData.id);
      setReviews(reviewsData.response);
      console.log("ProfilePage: Reviews fetched.");
      
      setError(null);
    } catch (err: any) {
      console.error("Failed to fetch profile data:", err);
      setError(err.message || "Could not load profile.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading) {
      fetchProfileData()
    }
  }, [id, authLoading])

  const handleLogout = async () => {
    await logout()
    router.replace('/auth')
  }

  console.log("id of all sort")
  console.log(id)
  console.log(user?.id)
  console.log(client)
  const isOwnProfile = user?.id === client?.user?.id

  // Add a guard to prevent rendering with an invalid ID
  if (!id && !loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 p-4">
        <Text className="text-red-500 text-lg text-center">Profile ID is missing.</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 bg-indigo-600 rounded-md">
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    )
  }

  if (error || !client) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50 p-4">
        <Text className="text-red-500 text-lg text-center">{error || 'Profile not found.'}</Text>
        <TouchableOpacity onPress={() => router.back()} className="mt-4 px-4 py-2 bg-indigo-600 rounded-md">
          <Text className="text-white">Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView className="bg-gray-100">
      <View className="p-4 md:p-8">
        {/* Profile Header */}
        <View className="flex-col md:flex-row items-center bg-white rounded-xl shadow-lg p-6">
          <View className="items-center md:items-start md:w-1/4">
            <View className="w-24 h-24 rounded-full bg-indigo-100 items-center justify-center mb-4">
              <Text className="text-4xl font-bold text-indigo-600">
              {client?.first_name?.[0] || '?'}
              {client?.last_name?.[0] || '?'}
              </Text>
            </View>
          </View>
          <View className="flex-1 text-center md:text-left md:ml-6">
            <Text className="text-3xl font-bold text-gray-900">
            {client?.first_name || ''} {client?.last_name || ''}
            </Text>
            
            
            {isOwnProfile && (
              <TouchableOpacity
                onPress={handleLogout}
                className="mt-4 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg inline-block w-auto"
              >
                <Text className="text-white text-center">Logout</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Conditional Sections: Only render if client is available */}
        {client && (
          <>
            {/* Reviews */}
            <View className="mt-8">
              <ReviewsSection
                reviews={reviews}
                loading={loading}
                error={error ? new Error(error) : null}
              />
            </View>

            {/* My Listings */}
            <View className="mt-8">
              <Text className="text-2xl font-bold mb-4 text-gray-800">My Listings</Text>
              {listings.length > 0 ? (
                <View className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {listings.map((listing) => (
                    <Link href={`/gear/${listing.id}`} key={listing.id} asChild>
                      <Pressable>
                        <View className="bg-white rounded-lg shadow-md overflow-hidden transform hover:scale-105 transition-transform duration-300">
                          {listing.gear_images && listing.gear_images.length > 0 ? (
                            <Image
                              source={{ uri: getAssetURL(listing.gear_images[0].directus_files_id.id) }}
                              className="w-full h-48 object-cover"
                            />
                          ) : (
                            <View className="w-full h-48 bg-gray-200 flex items-center justify-center">
                              <Text className="text-gray-500">No Image</Text>
                            </View>
                          )}
                          <View className="p-4">
                            <Text className="text-lg font-semibold text-gray-900">{listing.title}</Text>
                            <Text className="text-green-600 font-bold mt-1">${listing.price} / day</Text>
                          </View>
                        </View>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              ) : (
                <Text className="text-gray-500">No listings yet.</Text>
              )}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  )
}