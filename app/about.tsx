import { StyleSheet, Text, View, ScrollView, TouchableOpacity, ImageBackground } from 'react-native'
import React from 'react'
import "../globals.css";
import { Link } from 'expo-router';


const About = () => {
  

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Hero Section */}
      <View className="relative h-[600px]">
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1501554728187-ce583db33af7?ixlib=rb-4.0.3' }}
          className="absolute inset-0"
          style={{ opacity: 0.7 }}
        />
        <View className="absolute inset-0 bg-gray-900 opacity-60" />
        <View className="relative h-full px-4 justify-center">
          <Text className="text-4xl font-bold text-white mb-4">
            Share Your Outdoor Gear
          </Text>
          <Text className="text-xl text-gray-200 mb-8 max-w-[90%]">
            Rent high-quality outdoor equipment from local adventurers. From camping gear to climbing equipment, find what you need for your next adventure.
          </Text>
          <TouchableOpacity className="bg-green-600 px-6 py-3 rounded-md self-start">
            <Text className="text-white font-medium">Browse Gear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* How it works section */}
      <View className="bg-gray-50 py-16 px-4">
        <Text className="text-3xl font-bold text-gray-900 text-center mb-12">
          How It Works
        </Text>
        <View className="space-y-4">
          {[
            {
              name: 'Find Gear',
              description: 'Browse through our collection of outdoor equipment from local adventurers.',
              icon: '🔍'
            },
            {
              name: 'Request to Rent',
              description: 'Send a rental request to the owner with your desired dates.',
              icon: '📅'
            },
            {
              name: 'Meet & Rent',
              description: 'Arrange a meetup with the owner to pick up the gear and start your adventure.',
              icon: '🤝'
            }
          ].map((step, index) => (
            <View
              key={step.name}
              className="bg-white p-6 rounded-lg shadow-sm"
            >
              <View className="flex-row items-center mb-2">
                <Text className="text-2xl mr-3">{step.icon}</Text>
                <Text className="text-lg font-medium text-gray-900">{step.name}</Text>
              </View>
              <Text className="text-base text-gray-500">{step.description}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Featured Categories */}
      <View className="py-16 px-4">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-8">
          Popular Categories
        </Text>
        <View className="flex-row flex-wrap justify-between">
          {[
            { name: 'Camping', icon: '⛺️' },
            { name: 'Hiking', icon: '🥾' },
            { name: 'Climbing', icon: '🧗' },
            { name: 'Water Sports', icon: '🏄' }
          ].map((category) => (
            <View key={category.name} className="w-[48%] bg-gray-50 p-4 rounded-lg mb-4">
              <Text className="text-3xl mb-2">{category.icon}</Text>
              <Text className="text-lg font-medium text-gray-900">{category.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* CTA Section */}
      <View className="bg-green-600 py-12 px-4">
        <Text className="text-2xl font-bold text-white text-center mb-4">
          Ready to Start Your Adventure?
        </Text>
        <Text className="text-white text-center mb-6">
          Join our community of outdoor enthusiasts and gear owners today.
        </Text>
        <TouchableOpacity className="bg-white px-6 py-3 rounded-md self-center">
          <Link href="/auth">
            <Text className="text-green-600 font-medium">Get Started</Text>
          </Link>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

export default About
