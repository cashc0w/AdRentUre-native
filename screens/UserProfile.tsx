import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, RouteProp, useNavigation, NavigationProp } from '@react-navigation/native';
import { useGearListings } from '../hooks/useGearListings';
import { useReviews } from '../hooks/useReviews';
import { getAssetURL } from '../lib/directus';
import { Ionicons } from '@expo/vector-icons';
import { directus } from '../lib/directus';
import { readItem } from '@directus/sdk';
import { DirectusGearListing } from '../lib/directus';

type RootStackParamList = {
  UserProfile: { userId: string };
  GearDetail: { id: string };
};

type UserProfileRouteProp = RouteProp<RootStackParamList, 'UserProfile'>;
type UserProfileNavigationProp = NavigationProp<RootStackParamList, 'UserProfile'>;

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

export default function UserProfile() {
  const route = useRoute<UserProfileRouteProp>();
  const navigation = useNavigation<UserProfileNavigationProp>();
  const { userId } = route.params;
  const { listings: allListings, loading: listingsLoading, error: listingsError } = useGearListings();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      try {
        setLoading(true);
        const response = await directus.request(
          readItem("clients", userId, {
            fields: ["*", "user.*"],
          })
        );
        setClient(response);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      fetchClient();
    }
  }, [userId]);

  if (loading || listingsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error || listingsError || !client) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Error loading profile: {error?.message || listingsError?.message || 'User not found'}
          </Text>
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
              {listings.map((listing: DirectusGearListing) => (
                <TouchableOpacity
                  key={listing.id}
                  style={styles.listingCard}
                  onPress={() => navigation.navigate('GearDetail', { id: listing.id })}
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
}); 