import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface StarRatingProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  maxStars?: number;
  starSize?: number;
  selectedColor?: string;
  unselectedColor?: string;
}

const StarRating: React.FC<StarRatingProps> = ({
  rating,
  onRatingChange,
  maxStars = 5,
  starSize = 32,
  selectedColor = '#ffb300',
  unselectedColor = '#c7c7c7',
}) => {
  const starRatingOptions = Array.from({ length: maxStars }, (_, i) => i + 1);

  return (
    <View style={{ flexDirection: 'row' }}>
      {starRatingOptions.map((option) => (
        <TouchableOpacity
          key={option}
          onPress={() => onRatingChange(option)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={rating >= option ? 'star' : 'star-outline'}
            size={starSize}
            color={rating >= option ? selectedColor : unselectedColor}
            style={{ marginRight: 5 }}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default StarRating; 