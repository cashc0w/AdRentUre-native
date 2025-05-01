import { View, Text, Button } from 'react-native'
import React from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useClientWithClientID } from '../../hooks/useClientWithClientID';
import { router, useLocalSearchParams } from 'expo-router';

const Profile = () => {
  const { user, logout } = useAuth();
  const { id } = useLocalSearchParams();
  const { client, loading, error } = useClientWithClientID(id as string);

  console.log("This is the client", client);
  return (
    <View className='flex-1 items-center justify-center bg-red-300'>
      
      {client && (
        <>
          <Text>{client.first_name} {client.last_name}</Text> 
          <Text>{client.id}</Text>
        </>
      )}
      <Button title="Logout" onPress={() => {
        logout();
        router.replace("/auth");
      }} />
    </View>
  )
}

export default Profile