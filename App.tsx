import './global.css';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './screens/Home';
import Profile from './screens/Profile';
import Settings from './screens/Settings';
import AuthScreen from './screens/AuthScreen';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator();

function Navigation() {
  const { user } = useAuth();

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      }}
    >
      {!user && (
        <Tab.Screen 
          name="Auth" 
          component={AuthScreen}
          options={{
            tabBarIcon: ({ color }) => (
              <Text style={{ color }}>🔐</Text>
            ),
          }}
        />
      )}
      <Tab.Screen 
        name="Home" 
        component={Home}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={Profile}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color }}>👤</Text>
          ),
        }}
      />
      <Tab.Screen 
        name="Settings" 
        component={Settings}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color }}>⚙️</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <Navigation />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
