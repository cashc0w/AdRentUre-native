import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getGearListing, getAssetURL, getOrCreateClient } from '../lib/directus';
import { useAuth } from '../contexts/AuthContext';
import type { DirectusGearListing } from '../lib/directus';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRentalRequest } from '../hooks/useCreateRentalRequest';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

type RootStackParamList = {
  BrowseList: undefined;
  GearDetail: DirectusGearListing;
};

type GearDetailRouteProp = RouteProp<RootStackParamList, 'GearDetail'>;

export default function GearDetail() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const route = useRoute<GearDetailRouteProp>();
  const gear = route.params;
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [message, setMessage] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const { submitRequest, loading: submitting, error: submitError } = useRentalRequest({
    onSuccess: () => {
      Alert.alert('Success', 'Rental request submitted successfully!');
    },
  });

  useEffect(() => {
    async function fetchListing() {
      try {
        setLoading(true);
        await getGearListing(gear.id);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    }

    if (gear.id) {
      fetchListing();
    }
  }, [gear.id]);

  const handleSubmit = async () => {
    if (!startDate || !endDate || !gear) return;

    if (!user) {
      Alert.alert('Error', 'You must be logged in to submit a rental request');
      return;
    }

    const clientRenter = await getOrCreateClient(user.id);
    if (!clientRenter) {
      throw new Error('Failed to get or create client renter');
    }

    if (!gear.owner) {
      throw new Error('Gear listing has no owner');
    }

    const rentalRequest = await submitRequest({
      gear_listing: gear.id,
      renter: clientRenter.id,
      owner: gear.owner.id,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      message: message?.trim(),
    });
  };

  const handleStartDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'web') {
      setShowStartDatePicker(false);
      if (selectedDate) {
        setStartDate(selectedDate);
        if (endDate && selectedDate > endDate) {
          setEndDate(selectedDate);
        }
      }
    } else {
      setShowStartDatePicker(false);
      if (selectedDate) {
        setStartDate(selectedDate);
        if (endDate && selectedDate > endDate) {
          setEndDate(selectedDate);
        }
      }
    }
  };

  const handleEndDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'web') {
      setShowEndDatePicker(false);
      if (selectedDate) {
        setEndDate(selectedDate);
      }
    } else {
      setShowEndDatePicker(false);
      if (selectedDate) {
        setEndDate(selectedDate);
      }
    }
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

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={24} color="#000" />
      </TouchableOpacity>

      <ScrollView className="flex-1">
        {/* Image Section */}
        <View className="w-full h-80">
          {gear.gear_images && gear.gear_images.length > 0 ? (
            <Image
              source={{ uri: getAssetURL(gear.gear_images[0].directus_files_id.id) }}
              className="w-full h-full"
              resizeMode="cover"
            />
          ) : (
            <View className="w-full h-full bg-gray-200 items-center justify-center">
              <Text className="text-gray-500">No Image Available</Text>
            </View>
          )}
        </View>

        {/* Content Section */}
        <View className="p-4">
          <Text className="text-2xl font-bold mb-2">{gear.title}</Text>
          <Text className="text-xl font-semibold text-green-600 mb-4">
            ${gear.price}/day
          </Text>

          {/* Description */}
          <View className="mb-6">
            <Text className="text-lg font-medium mb-2">Description</Text>
            <Text className="text-gray-600">{gear.description}</Text>
          </View>

          {/* Details */}
          <View className="mb-6">
            <Text className="text-lg font-medium mb-2">Details</Text>
            <View className="space-y-2">
              <Text className="text-gray-600">
                <Text className="font-medium">Category:</Text> {gear.category}
              </Text>
              <Text className="text-gray-600">
                <Text className="font-medium">Condition:</Text> {gear.condition}
              </Text>
              {gear.distance !== undefined && (
                <Text className="text-gray-600">
                  <Text className="font-medium">Distance:</Text>{' '}
                  {gear.distance < 1
                    ? `${Math.round(gear.distance * 1000)}m away`
                    : `${gear.distance.toFixed(1)}km away`}
                </Text>
              )}
            </View>
          </View>

          {/* Contact Button */}
          <TouchableOpacity
            className="bg-green-600 py-3 px-4 rounded-md"
            onPress={() => {
              // TODO: Implement contact functionality
            }}
          >
            <Text className="text-white text-center font-medium">
              Contact Owner
            </Text>
          </TouchableOpacity>

          {/* Rental Request Form */}
          <View style={styles.rentalForm}>
            <Text style={styles.sectionTitle}>Request to Rent</Text>

            {submitError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>Error: {submitError.message}</Text>
              </View>
            )}

            <View style={styles.datePickersContainer}>
              <View style={styles.datePickerContainer}>
                <Text style={styles.dateLabel}>Start Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    style={styles.webDateInput}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      setStartDate(date);
                      if (endDate && date > endDate) {
                        setEndDate(date);
                      }
                    }}
                    min={new Date().toISOString().split('T')[0]}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowStartDatePicker(true)}
                    >
                      <Text style={styles.dateText}>
                        {startDate ? startDate.toLocaleDateString() : 'Select start date'}
                      </Text>
                    </TouchableOpacity>
                    {showStartDatePicker && (
                      <DateTimePicker
                        value={startDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={handleStartDateChange}
                        minimumDate={new Date()}
                      />
                    )}
                  </>
                )}
              </View>

              <View style={styles.datePickerContainer}>
                <Text style={styles.dateLabel}>End Date</Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="date"
                    style={styles.webDateInput}
                    onChange={(e) => {
                      const date = new Date(e.target.value);
                      setEndDate(date);
                    }}
                    min={startDate ? startDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}
                  />
                ) : (
                  <>
                    <TouchableOpacity
                      style={styles.dateInput}
                      onPress={() => setShowEndDatePicker(true)}
                    >
                      <Text style={styles.dateText}>
                        {endDate ? endDate.toLocaleDateString() : 'Select end date'}
                      </Text>
                    </TouchableOpacity>
                    {showEndDatePicker && (
                      <DateTimePicker
                        value={endDate || new Date()}
                        mode="date"
                        display="default"
                        onChange={handleEndDateChange}
                        minimumDate={startDate || new Date()}
                      />
                    )}
                  </>
                )}
              </View>
            </View>

            <View style={styles.messageContainer}>
              <Text style={styles.dateLabel}>Message (Optional)</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={3}
                style={styles.messageInput}
                placeholder="Add a message to the owner..."
                placeholderTextColor="#666"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, (!startDate || !endDate || submitting) && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={!startDate || !endDate || submitting}
            >
              <Text style={styles.submitButtonText}>
                {submitting ? 'Submitting...' : 'Submit Request'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  rentalForm: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  datePickersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  datePickerContainer: {
    flex: 1,
    marginRight: 10,
  },
  dateLabel: {
    fontSize: 16,
    marginBottom: 5,
  },
  dateInput: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    height: 40,
    justifyContent: 'center',
  },
  webDateInput: {
    width: '100%',
    height: 40,
    padding: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    fontSize: 16,
  },
  dateText: {
    fontSize: 16,
    color: '#000',
  },
  messageContainer: {
    marginBottom: 15,
  },
  messageInput: {
    backgroundColor: 'white',
    padding: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#28a745',
    padding: 15,
    borderRadius: 5,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#6c757d',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorBox: {
    backgroundColor: '#f8d7da',
    padding: 10,
    borderRadius: 5,
    marginBottom: 15,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    padding: 8,
  },
}); 