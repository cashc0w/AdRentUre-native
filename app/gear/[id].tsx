import { View, Text } from 'react-native'
import React from 'react'
import { useLocalSearchParams } from 'expo-router';

const GearDetail = () => {
    const { id } = useLocalSearchParams();

    
  return (
    <View>
      <Text>GearDetail</Text>
    </View>
  )
}

export default GearDetail