import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGearListings, type SortOption } from '../hooks/useGearListings';
import { useAuth } from '../contexts/AuthContext';
import { getAssetURL } from '../lib/directus';
import type { DirectusGearListing } from '../lib/directus';

type RootStackParamList = {
  BrowseList: undefined;
  GearDetail: DirectusGearListing;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const categories = [
  'Camping',
  'Hiking',
  'Climbing',
  'Skiing',
  'Snowboarding',
  'Water Sports',
  'Other'
];

const conditions = ['New', 'Like New', 'Good', 'Fair', 'Poor'];

const sortOptions = [
  { value: 'date_created_desc', label: 'Newest First' },
  { value: 'date_created_asc', label: 'Oldest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function BrowseScreen() {
  const [maxRadius, setMaxRadius] = useState<number | undefined>(undefined);
  const [searchInput, setSearchInput] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    condition: '',
    minPrice: undefined as number | undefined,
    maxPrice: undefined as number | undefined,
    search: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('date_created_desc');
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const { listings = [], loading, error, totalPages } = useGearListings({
    filters,
    page: currentPage,
    sort,
    maxRadius,
  });

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value
    }));
    setCurrentPage(1);
  };

  const handleSearchSubmit = () => {
    handleFilterChange('search', searchInput);
  };

  const clearSearch = () => {
    setSearchInput('');
    handleFilterChange('search', '');
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error.message}</Text>
      </View>
    );
  }

  const renderItem = ({ item: listing }: { item: DirectusGearListing }) => (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => navigation.navigate('GearDetail', listing)}
    >
      {listing.gear_images && listing.gear_images.length > 0 ? (
        <Image
          source={{ uri: getAssetURL(listing.gear_images[0].directus_files_id.id) }}
          style={styles.listingImage}
        />
      ) : (
        <View style={styles.noImageContainer}>
          <Text style={styles.noImageText}>No image available</Text>
        </View>
      )}
      <View style={styles.listingInfo}>
        <Text style={styles.listingTitle}>{listing.title}</Text>
        <Text style={styles.listingPrice}>${listing.price}/day</Text>
        {listing.distance !== undefined && (
          <Text style={styles.listingDistance}>
            {listing.distance < 1
              ? `${Math.round(listing.distance * 1000)}m away`
              : `${listing.distance.toFixed(1)}km away`}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for gear by title or description..."
          value={searchInput}
          onChangeText={setSearchInput}
        />
        <TouchableOpacity
          style={styles.searchButton}
          onPress={handleSearchSubmit}
        >
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filtersTitle}>Filter & Sort</Text>
        <View style={styles.filtersGrid}>
          <TextInput
            style={styles.filterInput}
            placeholder="Category"
            value={filters.category}
            onChangeText={(value) => handleFilterChange('category', value)}
          />
          <TextInput
            style={styles.filterInput}
            placeholder="Condition"
            value={filters.condition}
            onChangeText={(value) => handleFilterChange('condition', value)}
          />
          <TextInput
            style={styles.filterInput}
            placeholder="Min Price"
            keyboardType="numeric"
            value={filters.minPrice?.toString()}
            onChangeText={(value) => handleFilterChange('minPrice', value ? Number(value) : '')}
          />
          <TextInput
            style={styles.filterInput}
            placeholder="Max Price"
            keyboardType="numeric"
            value={filters.maxPrice?.toString()}
            onChangeText={(value) => handleFilterChange('maxPrice', value ? Number(value) : '')}
          />
          <TextInput
            style={styles.filterInput}
            placeholder="Max Distance (km)"
            keyboardType="numeric"
            value={maxRadius?.toString()}
            onChangeText={(value) => setMaxRadius(value ? Number(value) : undefined)}
          />
        </View>
      </View>

      {/* Listings */}
      <FlatList
        data={listings}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listingsContainer}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity
            style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
            onPress={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <Text style={styles.pageButtonText}>Previous</Text>
          </TouchableOpacity>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <TouchableOpacity
              key={page}
              style={[styles.pageButton, currentPage === page && styles.activePageButton]}
              onPress={() => handlePageChange(page)}
            >
              <Text style={[styles.pageButtonText, currentPage === page && styles.activePageButtonText]}>
                {page}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.pageButton, currentPage === totalPages && styles.disabledButton]}
            onPress={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            <Text style={styles.pageButtonText}>Next</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
    fontSize: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  searchButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  filtersContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  filtersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  filtersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterInput: {
    flex: 1,
    minWidth: '45%',
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  listingsContainer: {
    padding: 16,
  },
  listingCard: {
    flex: 1,
    margin: 8,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listingImage: {
    width: '100%',
    height: 200,
  },
  noImageContainer: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#666',
  },
  listingInfo: {
    padding: 12,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  listingPrice: {
    fontSize: 14,
    color: '#4CAF50',
  },
  listingDistance: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  pageButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  activePageButton: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  pageButtonText: {
    color: '#333',
  },
  activePageButtonText: {
    color: '#fff',
  },
}); 