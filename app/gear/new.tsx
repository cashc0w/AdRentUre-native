import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Platform } from 'react-native'
import React, { useState } from 'react'
import "../../globals.css";
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { createGearListing, getClientWithUserID, DirectusClientUser } from '../../lib/directus';
import * as ImageManipulator from 'expo-image-manipulator';

const categories = [
  { id: 'camping', name: 'Camping' },
  { id: 'hiking', name: 'Hiking' },
  { id: 'climbing', name: 'Climbing' },
  { id: 'skiing', name: 'Skiing' },
  { id: 'water', name: 'Water Sports' },
]

const conditions = [
  { id: 'new', name: 'New' },
  { id: 'like_new', name: 'Like New' },
  { id: 'good', name: 'Good' },
  { id: 'fair', name: 'Fair' },
]

type FormData = {
  title: string
  description: string
  category: string
  price: string
  condition: string
  images: ProcessedImage[]
}

type FormErrors = {
  title?: string
  description?: string
  category?: string
  price?: string
  condition?: string
  location?: string
  images?: string
}

interface ProcessedImage {
  uri: string;
  type: string;
  name: string;
}

export default function NewGearPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    price: '',
    condition: '',
    images: []
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [images, setImages] = useState<ProcessedImage[]>([])

  const validateForm = () => {
    const newErrors: FormErrors = {}
    if (!formData.title) newErrors.title = 'Title is required'
    if (!formData.description) newErrors.description = 'Description is required'
    if (!formData.category) newErrors.category = 'Category is required'
    if (!formData.price) newErrors.price = 'Price is required'
    if (!formData.condition) newErrors.condition = 'Condition is required'
    if (formData.images.length === 0) newErrors.images = 'At least one image is required'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.5, // Initial quality reduction
        base64: false,
      });

      if (!result.canceled) {
        const processedImages = await Promise.all(
          result.assets.map(async (asset) => {
            // Compress and resize the image
            const manipResult = await ImageManipulator.manipulateAsync(
              asset.uri,
              [{ resize: { width: 800 } }], // Resize to max width of 800px
              { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG } // Compress to 70% quality
            );

            return {
              uri: manipResult.uri,
              type: 'image/jpeg',
              name: `image-${Date.now()}.jpg`,
            } as ProcessedImage;
          })
        );

        setImages(processedImages);
        setFormData(prev => ({
          ...prev,
          images: processedImages
        }));
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert('Error', 'Failed to pick images. Please try again.');
    }
  };

  const onSubmit = async () => {
    if (!user) {
      Alert.alert('Error', 'You must be logged in to create a gear listing')
      return
    }

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      // Add a timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Operation timed out')), 30000); // 30 second timeout
      });

      const client = await Promise.race([
        getClientWithUserID(user.id),
        timeoutPromise
      ]) as DirectusClientUser;

      if (!client) {
        throw new Error('Failed to get or create client')
      }

      // Process images with progress tracking
      const totalImages = images.length;
      let processedImages = 0;

      const imageFiles = await Promise.all(
        images.map(async (asset, index) => {
          try {
            console.log(`Processing image ${index + 1}/${totalImages}:`, asset.uri);
            
            let processedImage;
            // Handle web platform
            if (Platform.OS === 'web') {
              const response = await fetch(asset.uri);
              if (!response.ok) {
                throw new Error(`Failed to fetch image: ${response.status}`);
              }
              const blob = await response.blob();
              processedImage = new File([blob], `image-${index}.jpg`, { type: 'image/jpeg' });
            } else {
              // Handle mobile platforms - no need for additional processing since we already compressed
              processedImage = {
                uri: asset.uri,
                type: 'image/jpeg',
                name: `image-${index}.jpg`
              };
            }

            processedImages++;
            console.log(`Progress: ${processedImages}/${totalImages} images processed`);
            
            return processedImage;
          } catch (error) {
            console.error(`Error processing image ${index + 1}:`, error);
            throw new Error(`Failed to process image ${index + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        })
      );

      console.log('Successfully processed all images');

      // Create the listing with a timeout
      const listingPromise = createGearListing({
        ...formData,
        price: parseFloat(formData.price),
        ownerID: client.id,
        images: imageFiles,
      });

      const listing = await Promise.race([
        listingPromise,
        timeoutPromise
      ]);

      router.push('/gear');
    } catch (error) {
      console.error('Error creating gear listing:', error);
      let errorMessage = 'An error occurred while creating the gear listing. Please try again.';
      
      if (error instanceof Error) {
        if (error.message === 'Operation timed out') {
          errorMessage = 'The operation took too long. Please try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="p-4">
        <Text className="text-3xl font-bold text-gray-900 mb-8">List Your Gear</Text>
        
        <View className="space-y-6">
          {/* Title */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Title</Text>
            <TextInput
              value={formData.title}
              onChangeText={(text) => setFormData(prev => ({ ...prev, title: text }))}
              className="bg-white border border-gray-200 rounded-lg p-3"
              placeholder="Enter a title for your gear"
            />
            {errors.title && (
              <Text className="mt-1 text-sm text-red-600">{errors.title}</Text>
            )}
          </View>

          {/* Description */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Description</Text>
            <TextInput
              value={formData.description}
              onChangeText={(text) => setFormData(prev => ({ ...prev, description: text }))}
              className="bg-white border border-gray-200 rounded-lg p-3"
              placeholder="Describe your gear"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {errors.description && (
              <Text className="mt-1 text-sm text-red-600">{errors.description}</Text>
            )}
          </View>

          {/* Category */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Category</Text>
            <View className="flex-row flex-wrap gap-2">
              {categories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  onPress={() => setFormData(prev => ({ ...prev, category: category.id }))}
                  className={`px-4 py-2 rounded-full ${
                    formData.category === category.id ? 'bg-green-600' : 'bg-white'
                  }`}
                >
                  <Text className={formData.category === category.id ? 'text-white' : 'text-gray-700'}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.category && (
              <Text className="mt-1 text-sm text-red-600">{errors.category}</Text>
            )}
          </View>

          {/* Price */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Price per day ($)</Text>
            <TextInput
              value={formData.price}
              onChangeText={(text) => setFormData(prev => ({ ...prev, price: text }))}
              className="bg-white border border-gray-200 rounded-lg p-3"
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            {errors.price && (
              <Text className="mt-1 text-sm text-red-600">{errors.price}</Text>
            )}
          </View>

          {/* Condition */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Condition</Text>
            <View className="flex-row flex-wrap gap-2">
              {conditions.map((condition) => (
                <TouchableOpacity
                  key={condition.id}
                  onPress={() => setFormData(prev => ({ ...prev, condition: condition.id }))}
                  className={`px-4 py-2 rounded-full ${
                    formData.condition === condition.id ? 'bg-green-600' : 'bg-white'
                  }`}
                >
                  <Text className={formData.condition === condition.id ? 'text-white' : 'text-gray-700'}>
                    {condition.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.condition && (
              <Text className="mt-1 text-sm text-red-600">{errors.condition}</Text>
            )}
          </View>

         

          {/* Images */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Images</Text>
            <TouchableOpacity
              onPress={pickImages}
              className="bg-white border border-gray-200 rounded-lg p-3 items-center"
            >
              <Text className="text-green-600 font-medium">Select Images</Text>
            </TouchableOpacity>
            {images.length > 0 && (
              <Text className="mt-2 text-sm text-gray-500">
                {images.length} image{images.length !== 1 ? 's' : ''} selected
              </Text>
            )}
            {errors.images && (
              <Text className="mt-1 text-sm text-red-600">{errors.images}</Text>
            )}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={onSubmit}
            disabled={isSubmitting}
            className="bg-green-600 py-3 rounded-lg mt-4"
          >
            {isSubmitting ? (
              <View className="flex-row justify-center items-center">
                <ActivityIndicator color="white" />
                <Text className="text-white font-medium ml-2">Creating Listing...</Text>
              </View>
            ) : (
              <Text className="text-white font-medium text-center">Create Listing</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  )
}