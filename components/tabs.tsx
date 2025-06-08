import { Tabs } from "expo-router";
import "../globals.css";
import { useAuth } from "../contexts/AuthContext";
import { useClientWithUserID } from "../hooks/useClientWithUserID";
import { Ionicons } from '@expo/vector-icons';
import { View, Text } from 'react-native';
import { useState, useEffect } from 'react';
import { getMessageNotifications } from '../lib/directus'; // Adjust the import path

// Custom component for the mail icon with badge
const MailIconWithBadge = ({ color, size, badgeCount }: { color: string; size: number; badgeCount: number }) => {
  console.log('Badge count:', badgeCount);
  console.log('Color:', color);
  return (
    <View className="relative w-15 h-6 items-center justify-center">
      <Ionicons name="mail-outline" size={size} color={color} />
      {badgeCount > 0 && color=='gray' && (
        // <View className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4  bg-red-500 rounded-full"></View>
        <View className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-xs font-bold text-white bg-red-500 rounded-full">
          {badgeCount > 99 ? '99+' : badgeCount.toString()}
        </View>
      )}
    </View>
  );
};

function TabNavigation() {
    const { user } = useAuth();
    const { client } = useClientWithUserID(user?.id || "");
    const [messageNotificationCount, setMessageNotificationCount] = useState(0);
    
    // Fetch message notifications count
    useEffect(() => {
      const fetchNotificationCount = async () => {
        if (client?.id) {
          try {
            const messageNotifications = await getMessageNotifications(client.id);
            setMessageNotificationCount(messageNotifications.length);
          } catch (error) {
            console.error('Error fetching notification count:', error);
            setMessageNotificationCount(0);
          }
        } else {
          setMessageNotificationCount(0);
        }
      };

      fetchNotificationCount();
      
      // // Optional: Set up an interval to periodically check for new notifications
      // const interval = setInterval(fetchNotificationCount, 30000); // Check every 30 seconds
      
      // return () => clearInterval(interval);
    }, [client?.id]);
    
    return (
      <Tabs 
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#16a34a', 
          tabBarInactiveTintColor: 'gray',
        }}
      >
        <Tabs.Screen 
          name="about" 
          options={{ 
            title: '',//'About', 
            href: !user ? `/about` : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" size={size} color={color} />
            ),
            tabBarStyle: user ? { display: 'none' } : undefined,
          }} 
        />
        <Tabs.Screen 
          name="gear" 
          options={{ 
            title: '',//'Browse',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="search-outline" size={size} color={color} />
            ),
          }} 
        />
        <Tabs.Screen 
          name="messages" 
          options={{ 
            title: '',//'Messages',  
            href: user ? `/messages` : null,
            tabBarIcon: ({ color, size }) => (
              <MailIconWithBadge 
                color={color} 
                size={size} 
                badgeCount={messageNotificationCount} 
              />
            ),
            tabBarStyle: !user ? { display: 'none' } : undefined,
          }} 
        />
        <Tabs.Screen 
          name="profile" 
          options={{ 
            title: '',//'Profile', 
            href: user ? `/profile/${client?.id}` : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
            //tabBarStyle: !user ? { display: 'none' } : undefined,
          }} 
        />
        <Tabs.Screen 
          name="auth" 
          options={{ 
            title: '',//'Login', 
            href: !user ? `/auth` : null,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="person-outline" size={size} color={color} />
            ),
            //tabBarStyle: user ? { display: 'none' } : undefined,
          }} 
        />
      </Tabs>
    );
  }

export default TabNavigation;