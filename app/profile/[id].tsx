'use client'

import { useState, useEffect, useRef } from 'react'
import { useLocalSearchParams, useRouter} from 'expo-router'
import { DirectusUser, DirectusClientUser, DirectusRentalRequest, directus } from '../../lib/directus'
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
import { Picker } from '@react-native-picker/picker'

// Reviews component that only renders when we have a clientId
function ReviewsSection({ clientId }: { clientId: string }) {
  const {
    reviews,
    loading: reviewsLoading,
    error: reviewsError
  } = useReviews({
    clientId: clientId
  })

  if (reviewsLoading) {
    return <Text className="text-gray-500">Loading reviews...</Text>
  }

  if (reviewsError) {
    return <Text className="text-red-500">Error loading reviews: {reviewsError.message}</Text>
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
                    {new Date().toLocaleDateString()}
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

// Rental Requests component that only shows for the logged-in user's own profile
function RentalRequestsSection({ clientId }: { clientId: string }) {
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

  const {
    requests,
    loading: requestsLoading,
    error: requestsError,
    updateRequestStatus,
    refetchRequests
  } = useRentalRequests(clientId, role)

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
          updateRequestStatus(requestId, newStatus);
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
                  updateRequestStatus(requestId, newStatus);
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

  if (requestsLoading) {
    return <Text className="text-gray-500">Loading rental requests...</Text>
  }

  if (requestsError) {
    return <Text className="text-red-500">Error loading rental requests: {requestsError.message}</Text>
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
          {requests && requests.length > 0 ? (
            <ScrollView ref={requestRef} className="space-y-4">
              {requests.map((request: DirectusRentalRequest) => (
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
                              <View className="border border-gray-300 rounded-md">
                                <Picker
                                  selectedValue={reviewData.rating}
                                  onValueChange={(value) => setReviewData(prev => ({ ...prev, rating: value }))}
                                  style={{ height: 50 }}
                                >
                                  {[1, 2, 3, 4, 5].map((num) => (
                                    <Picker.Item key={num} label={`${num} Star${num !== 1 ? 's' : ''}`} value={num} />
                                  ))}
                                </Picker>
                              </View>
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
  const router = useRouter()
  const params = useLocalSearchParams()
  const id = params?.id as string
  const { user, logout } = useAuth()
  const [client, setClient] = useState<DirectusClientUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [showAllListings, setShowAllListings] = useState(false)
  
  // Fetch user's gear listings
  const {
    listings: allListings,
    loading: listingsLoading,
    error: listingsError
  } = useGearListings()

  // Filter listings client-side for the specific user
  const listings = allListings?.filter(listing => listing.owner?.id == id) || []

  // Determine which listings to show
  const displayedListings = showAllListings ? listings : listings.slice(0, 2)
  const hasMoreListings = listings.length > 2

  console.log(`listings: ${listings}`)

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true)
        // Get client by ID directly
        console.log(`id: ${id}`)
        const response = await directus.request(
          readItem("clients", id as string, {
            fields: ["*", "user.*"],
          })
        );
        console.log(`gougou`)
        setClient(response as DirectusClientUser)
      } catch (err) {
        console.error("Error fetching client:", err)
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchClient()
    }
  }, [id])

  if (loading || listingsLoading) {
    return (
      <View className="flex-1 bg-gray-50 justify-center items-center">
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    )
  }

  if (error || listingsError || !client) {
    return (
      <View className="flex-1 bg-gray-50">
        <View className="flex-1 px-4 py-8">
          <Text className="text-red-500">
            Error loading profile: {error?.message || listingsError?.message || 'User not found'}
          </Text>
        </View>
      </View>
    )
  }

  const isOwnProfile = user?.id && client?.user?.id && (user.id === client.user.id)

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="px-4 py-8">
        {/* User Info */}
        <View className="bg-white rounded-lg shadow-md p-6 mb-2">
          <View className="flex-row items-center space-x-4">
            <View className="w-24 h-24 bg-gray-200 rounded-full justify-center items-center">
              <Text className="text-2xl text-gray-500">
                {client?.first_name?.[0] || '?'}
                {client?.last_name?.[0] || '?'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-2xl font-bold text-gray-900">
                {client?.first_name || ''} {client?.last_name || ''}
              </Text>
            </View>
            {isOwnProfile && (
              <TouchableOpacity
                onPress={handleLogout}
                className="bg-red-600 px-4 py-2 rounded-lg"
              >
                <Text className="text-white font-medium">Logout</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* Reviews */}
        <View className="p-6">
          <View className="flex-row items-center space-x-4">
            <View className="flex-1">
              {client?.id && <ReviewsSection clientId={client.id} />}
            </View>
          </View>
        </View>

        {/* Listings Section */}
        <View className="bg-gray-100 border-green-600 border-2 rounded-lg shadow-md shadow-green-600 p-6 mb-8">
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-xl font-bold text-gray-900">Gear Listings</Text>
            {isOwnProfile && (
              <TouchableOpacity
                            onPress={() => router.push('/gear/new')}
                            className="bg-green-600 px-4 py-2 rounded-lg"
                          >
                            <Text className="text-white font-medium">List Your Gear</Text>
                          </TouchableOpacity>
            )}
          </View>
          {listings && listings.length > 0 ? (
            <View>
              {displayedListings.map((listing) => (
                <Link href={`/gear/${listing.id}`} key={listing.id} asChild>
                  <Pressable className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
                    {listing.gear_images && listing.gear_images[0] && (
                      <Image
                        source={{ uri: getAssetURL(listing.gear_images[0].directus_files_id.id) }}
                        className="w-full h-48"
                        resizeMode="cover"
                      />
                    )}
                    <View className="p-4">
                      <Text className="font-semibold text-lg mb-2 text-gray-900">{listing.title}</Text>
                      <Text className="text-gray-600 text-sm mb-2">{listing.description}</Text>
                      <Text className="text-green-600 font-semibold">${listing.price}/day</Text>
                    </View>
                  </Pressable>
                </Link>
              ))}
              
              {/* Show More/Show Less Button */}
              {hasMoreListings && (
                <TouchableOpacity
                  onPress={() => setShowAllListings(!showAllListings)}
                  className="bg-white border-2 border-green-600 rounded-lg p-4 items-center"
                >
                  <Text className="text-green-600 font-medium">
                    {showAllListings 
                      ? 'Show Less' 
                      : `Show All Listings (${listings.length})`
                    }
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text className="text-gray-500">No listings available</Text>
          )}
        </View>

        {/* Rental Requests Section - Only show for own profile */}
        {isOwnProfile && client?.id && (
          <RentalRequestsSection clientId={client.id} />
        )}
      </View>
    </ScrollView>
  )
}