'use client'

import { useState, useEffect, useRef } from 'react'
import * as React from 'react'
import { useLocalSearchParams, useRouter} from 'expo-router'
import { DirectusUser, DirectusClientUser, DirectusRentalRequest, directus, getGearListings, getReviews, getRentalRequests, DirectusReview } from '../../lib/directus'
import { readItem } from '@directus/sdk'
import { useGearListings } from '../../hooks/useGearListings'
import { useReviews } from '../../hooks/useReviews'
import { useRentalRequests } from '../../hooks/useRentalRequests'
import { useAuth } from '../../contexts/AuthContext'
import { Link } from 'expo-router'
import { useClientWithUserID } from '../../hooks/useClientWithUserID'
import { useUpdateRentalStatus } from '../../hooks/useUpdateRentalStatus'
import { useCreateReview } from '../../hooks/useCreateReview'
import { getAssetURL } from '../../lib/directus'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Pressable,
  Platform
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

// Rental Requests component is now a "dumb" component
function RentalRequestsSection({
  clientId,
  requests,
  loading,
  error,
  refetchRequests,
}: {
  clientId: string,
  requests: DirectusRentalRequest[] | null,
  loading: boolean,
  error: Error | null,
  refetchRequests: () => void
}) {
  const [role, setRole] = useState<'owner' | 'renter'>('owner');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null)

  const requestRef = useRef<ScrollView>(null);

  const [reviewData, setReviewData] = useState<{
    rating: number;
    comment: string;
  }>({
    rating: 5,
    comment: '',
  })

  // Filter requests based on the selected role
  const filteredRequests = requests?.filter(req => {
    if (role === 'owner') return req.owner.id === clientId
    if (role === 'renter') return req.renter.id === clientId
    return false
  }) || []

  const { updateStatus, loading: updateLoading } = useUpdateRentalStatus({
    onSuccess: () => {
      refetchRequests();
    }
  });

  const { submitReview, loading: reviewLoading } = useCreateReview({
    onSuccess: () => {
      if(Platform.OS !== 'web'){
      Alert.alert('Success', 'Review submitted successfully!');
      }
      setReviewData({ rating: 5, comment: '' });
      refetchRequests();
    }
  });

  const handleStatusChange = async (requestId: string, newStatus: 'approved' | 'rejected' | 'completed') => {
    console.log("trying to update status on request #" + requestId)
    
    console.log(`Would show alert: Are you sure you want to mark this request as ${newStatus}?`)
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Are you sure you want to mark this request as ${newStatus}?`)
      if(confirmed){
        try {
          await updateStatus(requestId, newStatus);
        } catch (error) {
          console.error('Error updating status:', error);
        
        }
      }
    } else {
      Alert.alert(
          'Confirm Action',
          `Are you sure you want to mark this request as ${newStatus}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Confirm',
              onPress: async () => {
                try {
                  await updateStatus(requestId, newStatus);
                } catch (error) {
                  console.error('Error updating status:', error);
                  Alert.alert('Error', 'Failed to update request status. Please try again.');
                }
              }
            }
          ]
        );
    }

  };

  const handleReviewSubmit = async (request: DirectusRentalRequest) => {
    if (!reviewData.comment) {
      if(Platform.OS === 'web' ){
        window.alert('Please enter a comment for your review.')
      } else {
      Alert.alert('Error', 'Please enter a comment for your review.');
      }
      return;

    }

    try {
      let reviewed;
      if (role === 'renter') {
        reviewed = request.owner.id;
      } else if (role === 'owner') {
        reviewed = request.renter.id;
      } else {
        throw new Error('Invalid role');
      }

      await submitReview({
        rental_request: request.id,
        reviewer: clientId,
        reviewed: reviewed,
        rating: reviewData.rating,
        comment: reviewData.comment,
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      if(Platform.OS === 'web' ){
        window.alert('Failed to submit review. Please try again.')
      } else {
        Alert.alert('Error', 'Failed to submit review. Please try again.');
      }
      
    }
  };

  if (loading) {
    return <Text className="text-gray-500">Loading rental requests...</Text>
  }

  if (error) {
    return <Text className="text-red-500">Error loading rental requests: {error.message}</Text>
  }

  return (
    <View className="mt-8">
      <View className="bg-white shadow rounded-lg overflow-hidden">
        <View className="px-4 py-5 border-b border-gray-200">
          <View className="flex-row justify-between items-center">
            <Text className="text-lg font-medium text-gray-900">Rental Requests</Text>
            <View className="flex-row space-x-4">
              <TouchableOpacity
                onPress={() => setRole('renter')}
                className={`px-4 py-2 rounded ${role === 'renter'
                  ? 'bg-green-600'
                  : 'bg-gray-200'
                  }`}
              >
                <Text className={`${role === 'renter' ? 'text-white' : 'text-gray-700'}`}>
                  As Renter
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setRole('owner')}
                className={`px-4 py-2 rounded ${role === 'owner'
                  ? 'bg-green-600'
                  : 'bg-gray-200'
                  }`}
              >
                <Text className={`${role === 'owner' ? 'text-white' : 'text-gray-700'}`}>
                  As Owner
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="px-4 py-5">
          {filteredRequests.length > 0 ? (
            <ScrollView ref={requestRef} className="space-y-4">
              {filteredRequests.map((request: DirectusRentalRequest) => (
                <TouchableOpacity
                  key={request.id}
                  className={`border rounded-lg p-4 mb-4 border-gray-200`}
                  onPress={() => setExpandedRequestId(expandedRequestId === request.id ? null : request.id)}
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1">
                      <Text className="text-lg font-medium text-gray-900">
                        {request.gear_listing?.title || 'Untitled Gear'}
                      </Text>
                      <Text className="text-sm text-gray-500">
                        Status: <Text className={`font-medium ${request.status === 'approved' ? 'text-green-600' :
                          request.status === 'rejected' ? 'text-red-600' :
                            'text-yellow-600'
                          }`}>{request.status}</Text>
                      </Text>
                      <View className="flex-row items-center">
                        <Text className="text-sm text-gray-500">
                          {role === 'owner' ? 'Requested by: ' : 'Owner: '}
                        </Text>
                        <Link href={`/profile/${role === 'owner' ? request.renter.id : request.owner.id}`} asChild>
                          <Pressable>
                            <Text className="text-sm font-medium text-gray-900">
                              {role === 'owner'
                                ? `${request.renter.first_name} ${request.renter.last_name}`
                                : `${request.owner.first_name} ${request.owner.last_name}`
                              }
                            </Text>
                          </Pressable>
                        </Link>
                      </View>
                      <Text className="text-sm text-gray-500">
                        Dates: {new Date(request.start_date).toLocaleDateString()} -{' '}
                        {new Date(request.end_date).toLocaleDateString()}
                      </Text>
                    </View>
                    <View className="flex-row items-center space-x-2">
                      <Link href={`/rentals/requests/${request.id}`} asChild>
                        <Pressable>
                          <Text className="text-green-600 text-sm font-medium">
                            View Details
                          </Text>
                        </Pressable>
                      </Link>
                      <Text className={`text-gray-500 ${expandedRequestId === request.id ? 'rotate-180' : ''}`}>
                        ▼
                      </Text>
                    </View>
                  </View>

                  {/* Expanded Content */}
                  {expandedRequestId === request.id && (
                    <View className="mt-4 pt-4 border-t border-gray-200">
                      <View className="flex-row">
                        <View className="flex-1 mr-4">
                          <Text className="text-sm font-medium text-gray-900">Gear Details</Text>
                          <Text className="text-sm text-gray-500">Category: {request.gear_listing?.category}</Text>
                          <Text className="text-sm text-gray-500">Condition: {request.gear_listing?.condition}</Text>
                        </View>
                        <View className="flex-1">
                          <Text className="text-sm font-medium text-gray-900">Rental Details</Text>
                          <Text className="text-sm text-gray-500">
                            Duration: {
                              Math.ceil(
                                (new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) /
                                (1000 * 60 * 60 * 24)
                              )
                            } days
                          </Text>
                          <Text className="text-sm text-gray-500">
                            Total Price: ${
                              Math.ceil(
                                (new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) /
                                (1000 * 60 * 60 * 24)
                              ) * request.gear_listing?.price
                            }
                          </Text>
                        </View>
                      </View>
                      {request.gear_listing?.description && (
                        <View className="mt-4">
                          <Text className="text-sm font-medium text-gray-900">Description</Text>
                          <Text className="text-sm text-gray-500 mt-1">{request.gear_listing.description}</Text>
                        </View>
                      )}

                      {/* Status Update Section for Owners */}
                      {role === 'owner' && request.status === 'pending' && (
                        <View className="mt-4 pt-4 border-t border-gray-200">
                          <Text className="text-sm font-medium text-gray-900 mb-2">Update Request Status</Text>
                          <View className="flex-row gap-2">
                            <TouchableOpacity
                              onPress={() => handleStatusChange(request.id, 'approved')}
                              disabled={updateLoading}
                              className="px-4 py-2 bg-green-600 rounded-md opacity-100 disabled:opacity-50"
                            >
                              <Text className="text-white">Approve</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleStatusChange(request.id, 'rejected')}
                              disabled={updateLoading}
                              className="px-4 py-2 bg-red-600 rounded-md opacity-100 disabled:opacity-50"
                            >
                              <Text className="text-white">Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}

                      {/* Mark as Completed Section for Renters */}
                      {role === 'renter' && request.status === 'approved' && (
                        <View className="mt-4 pt-4 border-t border-gray-200">
                          <Text className="text-sm font-medium text-gray-900 mb-2">Complete Rental</Text>
                          <TouchableOpacity
                            onPress={() => handleStatusChange(request.id, 'completed')}
                            disabled={updateLoading}
                            className="px-4 py-2 bg-green-600 rounded-md opacity-100 disabled:opacity-50"
                          >
                            <Text className="text-white">Mark as Completed</Text>
                          </TouchableOpacity>
                        </View>
                      )}

                      {/* Review Section */}
                      {role === 'renter' && request.status === 'completed' && (
                        <View className="mt-4 pt-4 border-t border-gray-200">
                          <Text className="text-sm font-medium text-gray-900 mb-2">Write a Review</Text>
                          <View className="space-y-4">
                            <View>
                              <Text className="block text-sm font-medium text-gray-700 mb-1">Rating</Text>
                              <Pressable onPress={(e) => e.stopPropagation()}>
                                <StarRating
                                  rating={reviewData.rating}
                                  onRatingChange={(newRating) => setReviewData(prev => ({ ...prev, rating: newRating }))}
                                />
                              </Pressable>
                            </View>
                            <View>
                              <Text className="block text-sm font-medium text-gray-700 mb-1">Comment</Text>
                              <Pressable onPress={(e) => e.stopPropagation()}>
                                <TextInput
                                  value={reviewData.comment}
                                  onChangeText={(text) => setReviewData(prev => ({ ...prev, comment: text }))}
                                  multiline
                                  numberOfLines={3}
                                  className="border border-gray-300 rounded-md p-3 text-gray-900"
                                  placeholder="Write your review here..."
                                  placeholderTextColor="#9CA3AF"
                                />
                              </Pressable>
                            </View>
                            <TouchableOpacity
                              onPress={() => handleReviewSubmit(request)}
                              disabled={reviewLoading}
                              className="w-full px-4 py-2 bg-green-600 rounded-md opacity-100 disabled:opacity-50"
                            >
                              <Text className="text-white text-center">Submit Review</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text className="text-gray-500">No rental requests</Text>
          )}
        </View>
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
  const [rentalRequests, setRentalRequests] = useState<DirectusRentalRequest[] | null>([])
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

      // 4. Fetch Rental Requests (both as owner and renter)
      console.log("ProfilePage: Fetching rental requests...");
      const ownerReqs = await getRentalRequests(clientData.id, 'owner');
      const renterReqs = await getRentalRequests(clientData.id, 'renter');
      setRentalRequests([...ownerReqs, ...renterReqs]);
      console.log("ProfilePage: Rental requests fetched.");
      
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

  const isOwnProfile = user?.id === client?.user.id

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
                {client.user.first_name[0]}
                {client.user.last_name[0]}
              </Text>
            </View>
          </View>
          <View className="flex-1 text-center md:text-left md:ml-6">
            <Text className="text-3xl font-bold text-gray-900">
              {client.user.first_name} {client.user.last_name}
            </Text>
            <Text className="text-gray-600 mt-1">{client.user.email}</Text>
            <Text className="text-gray-500 mt-2">
              Member since {new Date(client.user.created_at).toLocaleDateString()}
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

            {/* Rental Requests - only for own profile */}
            {isOwnProfile && (
              <RentalRequestsSection
                clientId={client.id}
                requests={rentalRequests}
                loading={loading}
                error={error ? new Error(error) : null}
                refetchRequests={fetchProfileData}
              />
            )}

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