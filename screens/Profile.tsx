import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useGearListings } from '../hooks/useGearListings';
import { useReviews } from '../hooks/useReviews';
import { useRentalRequests } from '../hooks/useRentalRequests';
import { useUpdateRentalStatus } from '../hooks/useUpdateRentalStatus';
import { useCreateReview } from '../hooks/useCreateReview';
import { getAssetURL } from '../lib/directus';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import { directus } from '../lib/directus';
import { readItem, readItems, createItem } from '@directus/sdk';

type RootStackParamList = {
  Profile: undefined;
  GearDetail: { id: string };
};

type ProfileNavigationProp = NavigationProp<RootStackParamList, 'Profile'>;

function ReviewsSection({ clientId }: { clientId: string }) {
  const { reviews, loading: reviewsLoading, error: reviewsError } = useReviews({
    clientId: clientId
  });

  if (reviewsLoading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (reviewsError) {
    return <Text style={styles.errorText}>Error loading reviews: {reviewsError.message}</Text>;
  }

  const averageRating = reviews && reviews.length > 0
    ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length
    : 0;

  return (
    <View>
      <View style={styles.ratingContainer}>
        <Ionicons name="star" size={20} color="#FFD700" />
        <Text style={styles.ratingText}>{averageRating.toFixed(1)}</Text>
        <Text style={styles.reviewCount}>({reviews?.length || 0} reviews)</Text>
      </View>

      <View style={styles.reviewsContainer}>
        <Text style={styles.sectionTitle}>Reviews</Text>
        {reviews && reviews.length > 0 ? (
          <View style={styles.reviewsList}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <Text style={styles.reviewerName}>
                    {review.reviewer.first_name} {review.reviewer.last_name}
                  </Text>
                  <View style={styles.starsContainer}>
                    {[...Array(5)].map((_, i) => (
                      <Ionicons
                        key={i}
                        name={i < review.rating ? "star" : "star-outline"}
                        size={16}
                        color="#FFD700"
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.reviewDate}>
                  {new Date(review.date_created || '').toLocaleDateString()}
                </Text>
                <Text style={styles.reviewComment}>{review.comment}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.noReviewsText}>No reviews yet</Text>
        )}
      </View>
    </View>
  );
}

function RentalRequestsSection({ clientId }: { clientId: string }) {
  const [role, setRole] = useState<'owner' | 'renter'>('renter');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState({
    rating: 5,
    comment: '',
  });

  const {
    requests,
    loading: requestsLoading,
    error: requestsError,
    updateRequestStatus,
    refetchRequests
  } = useRentalRequests(clientId, role);

  const { updateStatus, loading: updateLoading } = useUpdateRentalStatus({
    onSuccess: () => {
      refetchRequests();
    }
  });

  const { submitReview, loading: reviewLoading } = useCreateReview({
    onSuccess: () => {
      Alert.alert('Success', 'Review submitted successfully!');
      setReviewData({ rating: 5, comment: '' });
      refetchRequests();
    }
  });

  const handleStatusChange = async (requestId: string, status: "approved" | "rejected" | "completed") => {
    console.log('Profile: handleStatusChange called', { requestId, status });
    try {
      console.log('Profile: Calling updateStatus');
      await updateStatus(requestId, status);
      console.log('Profile: Status update completed');
      // Refresh the requests after status change
      refetchRequests();
    } catch (error) {
      console.error('Profile: Error in handleStatusChange:', error);
      Alert.alert("Error", "Failed to update status. Please try again.");
    }
  };

  const handleReviewSubmit = async (request: any) => {
    console.log('Handling review submit:', { request, reviewData });
    if (!reviewData.comment) {
      Alert.alert('Error', 'Please enter a comment for your review.');
      return;
    }

    try {
      const reviewed = role === 'renter' ? request.owner.id : request.renter.id;
      console.log('Submitting review with data:', {
        rental_request: request.id,
        reviewer: clientId,
        reviewed,
        rating: reviewData.rating,
        comment: reviewData.comment,
      });
      await submitReview({
        rental_request: request.id,
        reviewer: clientId,
        reviewed: reviewed,
        rating: reviewData.rating,
        comment: reviewData.comment,
      });
      console.log('Review submitted successfully');
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Error', 'Failed to submit review. Please try again.');
    }
  };

  if (requestsLoading) {
    return <ActivityIndicator size="large" color="#0000ff" />;
  }

  if (requestsError) {
    return <Text style={styles.errorText}>Error loading rental requests: {requestsError.message}</Text>;
  }

  return (
    <View style={styles.rentalRequestsContainer}>
      <View style={styles.roleSelector}>
        <TouchableOpacity
          style={[styles.roleButton, role === 'renter' && styles.activeRoleButton]}
          onPress={() => setRole('renter')}
        >
          <Text style={[styles.roleButtonText, role === 'renter' && styles.activeRoleButtonText]}>
            As Renter
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, role === 'owner' && styles.activeRoleButton]}
          onPress={() => setRole('owner')}
        >
          <Text style={[styles.roleButtonText, role === 'owner' && styles.activeRoleButtonText]}>
            As Owner
          </Text>
        </TouchableOpacity>
      </View>

      {requests && requests.length > 0 ? (
        <View style={styles.requestsList}>
          {requests.map((request: any) => (
            <TouchableOpacity
              key={request.id}
              style={styles.requestCard}
              onPress={() => setExpandedRequestId(expandedRequestId === request.id ? null : request.id)}
            >
              <View style={styles.requestHeader}>
                <View>
                  <Text style={styles.requestTitle}>{request.gear_listing?.title || 'Untitled Gear'}</Text>
                  <Text style={styles.requestStatus}>
                    Status: <Text style={[
                      styles.statusText,
                      request.status === 'approved' && styles.statusApproved,
                      request.status === 'rejected' && styles.statusRejected,
                      request.status === 'pending' && styles.statusPending,
                    ]}>
                      {request.status}
                    </Text>
                  </Text>
                  <Text style={styles.requestInfo}>
                    {role === 'owner' ? 'Requested by: ' : 'Owner: '}
                    {role === 'owner'
                      ? `${request.renter.first_name} ${request.renter.last_name}`
                      : `${request.owner.first_name} ${request.owner.last_name}`
                    }
                  </Text>
                  <Text style={styles.requestInfo}>
                    Dates: {new Date(request.start_date).toLocaleDateString()} -{' '}
                    {new Date(request.end_date).toLocaleDateString()}
                  </Text>
                </View>
                <Ionicons
                  name={expandedRequestId === request.id ? "chevron-up" : "chevron-down"}
                  size={24}
                  color="#666"
                />
              </View>

              {expandedRequestId === request.id && (
                <View style={styles.expandedContent}>
                  <View style={styles.detailsGrid}>
                    <View>
                      <Text style={styles.detailTitle}>Gear Details</Text>
                      <Text style={styles.detailText}>Category: {request.gear_listing?.category}</Text>
                      <Text style={styles.detailText}>Condition: {request.gear_listing?.condition}</Text>
                    </View>
                    <View>
                      <Text style={styles.detailTitle}>Rental Details</Text>
                      <Text style={styles.detailText}>
                        Duration: {
                          Math.ceil(
                            (new Date(request.end_date).getTime() - new Date(request.start_date).getTime()) /
                            (1000 * 60 * 60 * 24)
                          )
                        } days
                      </Text>
                      <Text style={styles.detailText}>
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
                    <View style={styles.descriptionContainer}>
                      <Text style={styles.detailTitle}>Description</Text>
                      <Text style={styles.descriptionText}>{request.gear_listing.description}</Text>
                    </View>
                  )}

                  {role === 'owner' && request.status === 'pending' && (
                    <View style={styles.statusUpdateContainer}>
                      <Text style={styles.detailTitle}>Update Request Status</Text>
                      <View style={styles.statusButtons}>
                        <TouchableOpacity
                          style={[styles.statusButton, styles.approveButton]}
                          onPress={() => handleStatusChange(request.id, 'approved')}
                          disabled={updateLoading}
                        >
                          <Text style={styles.statusButtonText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.statusButton, styles.rejectButton]}
                          onPress={() => handleStatusChange(request.id, 'rejected')}
                          disabled={updateLoading}
                        >
                          <Text style={styles.statusButtonText}>Reject</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {role === 'renter' && request.status === 'approved' && (
                    <View style={styles.statusUpdateContainer}>
                      <Text style={styles.detailTitle}>Complete Rental</Text>
                      <TouchableOpacity
                        style={[styles.statusButton, styles.completeButton]}
                        onPress={() => handleStatusChange(request.id, 'completed')}
                        disabled={updateLoading}
                      >
                        <Text style={styles.statusButtonText}>Mark as Completed</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {role === 'renter' && request.status === 'completed' && (
                    <View style={styles.reviewForm}>
                      <Text style={styles.detailTitle}>Write a Review</Text>
                      <View style={styles.reviewInputs}>
                        <View style={styles.ratingSelector}>
                          <Text style={styles.inputLabel}>Rating</Text>
                          <View style={styles.starsSelector}>
                            {[1, 2, 3, 4, 5].map((num) => (
                              <TouchableOpacity
                                key={num}
                                onPress={() => setReviewData(prev => ({ ...prev, rating: num }))}
                              >
                                <Ionicons
                                  name={num <= reviewData.rating ? "star" : "star-outline"}
                                  size={24}
                                  color="#FFD700"
                                />
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={styles.commentInput}>
                          <Text style={styles.inputLabel}>Comment</Text>
                          <TextInput
                            value={reviewData.comment}
                            onChangeText={(text) => setReviewData(prev => ({ ...prev, comment: text }))}
                            multiline
                            numberOfLines={3}
                            style={styles.commentTextInput}
                            placeholder="Write your review here..."
                          />
                        </View>
                        <TouchableOpacity
                          style={[styles.submitReviewButton, reviewLoading && styles.disabledButton]}
                          onPress={() => handleReviewSubmit(request)}
                          disabled={reviewLoading}
                        >
                          <Text style={styles.submitReviewButtonText}>
                            {reviewLoading ? 'Submitting...' : 'Submit Review'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.noRequestsText}>No rental requests</Text>
      )}
    </View>
  );
}

export default function Profile() {
  const { user, logout } = useAuth();
  const navigation = useNavigation<ProfileNavigationProp>();
  const { listings: allListings, loading: listingsLoading, error: listingsError } = useGearListings();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchClient = async () => {
    console.log('Starting fetchClient, user:', user);
    if (!user) {
      console.log('No user in auth context');
      setError(new Error('No authenticated user found'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('Fetching client for user ID:', user.id);
      
      // Search for client by user ID
      const clientResponse = await directus.request(
        readItems("clients", {
          filter: { user: user.id },
          fields: ["*", "user.*"],
          limit: 1,
        })
      );

      console.log('Client search response:', clientResponse);

      if (clientResponse && clientResponse.length > 0) {
        console.log('Found existing client:', clientResponse[0]);
        setClient(clientResponse[0]);
      } else {
        // Create new client if none exists
        console.log('Creating new client for user');
        const newClient = await directus.request(
          createItem("clients", {
            user: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
          })
        );
        console.log('New client created:', newClient);
        setClient(newClient);
      }
    } catch (err) {
      console.error('Error in fetchClient:', err);
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Profile mounted, user:', user);
    fetchClient();
  }, [user]);

  if (loading || listingsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error || listingsError || !client) {
    console.log('Error state:', {
      error: error?.message,
      listingsError: listingsError?.message,
      hasClient: !!client,
      user: user
    });
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {error?.message || listingsError?.message || 'User not found'}
          </Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={fetchClient}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const listings = allListings.filter(listing => listing.owner?.id === client.id);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* User Info */}
        <View style={styles.userInfoContainer}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {client.first_name[0]}
              {client.last_name[0]}
            </Text>
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>
              {client.first_name} {client.last_name}
            </Text>
            {client?.id && <ReviewsSection clientId={client.id} />}
          </View>
        </View>

        {/* Listings Section */}
        <View style={styles.listingsContainer}>
          <Text style={styles.sectionTitle}>Gear Listings</Text>
          {listings && listings.length > 0 ? (
            <View style={styles.listingsGrid}>
              {listings.map((listing) => (
                <TouchableOpacity
                  key={listing.id}
                  style={styles.listingCard}
                  onPress={() => navigation.navigate('GearDetail', listing)}
                >
                  {listing.gear_images && listing.gear_images[0] && (
                    <Image
                      source={{ uri: getAssetURL(listing.gear_images[0].directus_files_id.id) }}
                      style={styles.listingImage}
                    />
                  )}
                  <View style={styles.listingInfo}>
                    <Text style={styles.listingTitle}>{listing.title}</Text>
                    <Text style={styles.listingDescription} numberOfLines={2}>
                      {listing.description}
                    </Text>
                    <Text style={styles.listingPrice}>${listing.price}/day</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.noListingsText}>No listings available</Text>
          )}
        </View>

        {/* Rental Requests Section */}
        {client?.id && (
          <View style={styles.rentalRequestsContainer}>
            <RentalRequestsSection clientId={client.id} />
          </View>
        )}

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={logout}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
  },
  userInfoContainer: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 20,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#e2e8f0',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarText: {
    fontSize: 32,
    color: '#4a5568',
  },
  userDetails: {
    marginLeft: 10,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  ratingText: {
    fontSize: 16,
    marginLeft: 5,
    marginRight: 5,
  },
  reviewCount: {
    fontSize: 14,
    color: '#718096',
  },
  reviewsContainer: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  reviewsList: {
    marginTop: 10,
  },
  reviewCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  starsContainer: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 5,
  },
  reviewComment: {
    fontSize: 14,
    color: '#4a5568',
  },
  noReviewsText: {
    color: '#718096',
    fontStyle: 'italic',
  },
  listingsContainer: {
    padding: 20,
  },
  listingsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  listingCard: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  listingImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  listingInfo: {
    padding: 10,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  listingDescription: {
    fontSize: 12,
    color: '#718096',
    marginBottom: 5,
  },
  listingPrice: {
    fontSize: 14,
    color: '#48bb78',
    fontWeight: 'bold',
  },
  noListingsText: {
    color: '#718096',
    fontStyle: 'italic',
  },
  rentalRequestsContainer: {
    padding: 20,
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    padding: 10,
    borderRadius: 5,
    marginHorizontal: 5,
    backgroundColor: '#e2e8f0',
  },
  activeRoleButton: {
    backgroundColor: '#48bb78',
  },
  roleButtonText: {
    textAlign: 'center',
    color: '#4a5568',
  },
  activeRoleButtonText: {
    color: 'white',
  },
  requestsList: {
    marginTop: 10,
  },
  requestCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  requestStatus: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 5,
  },
  statusText: {
    fontWeight: 'bold',
  },
  statusApproved: {
    color: '#48bb78',
  },
  statusRejected: {
    color: '#e53e3e',
  },
  statusPending: {
    color: '#d69e2e',
  },
  requestInfo: {
    fontSize: 14,
    color: '#718096',
  },
  expandedContent: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  detailText: {
    fontSize: 14,
    color: '#718096',
  },
  descriptionContainer: {
    marginBottom: 15,
  },
  descriptionText: {
    fontSize: 14,
    color: '#718096',
  },
  statusUpdateContainer: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  statusButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 10,
  },
  statusButton: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#48bb78',
  },
  rejectButton: {
    backgroundColor: '#e53e3e',
  },
  completeButton: {
    backgroundColor: '#4299e1',
  },
  statusButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  reviewForm: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  reviewInputs: {
    marginTop: 10,
  },
  ratingSelector: {
    marginBottom: 15,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  starsSelector: {
    flexDirection: 'row',
  },
  commentInput: {
    marginBottom: 15,
  },
  commentTextInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 5,
    padding: 10,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  submitReviewButton: {
    backgroundColor: '#48bb78',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  submitReviewButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  noRequestsText: {
    color: '#718096',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#e53e3e',
    padding: 15,
    borderRadius: 5,
    margin: 20,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  retryButton: {
    marginTop: 20,
    backgroundColor: '#007AFF',
    padding: 10,
    borderRadius: 5,
  },
  retryButtonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.5,
  },
}); 