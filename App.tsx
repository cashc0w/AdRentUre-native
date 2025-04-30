import './global.css';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './screens/Home';
import Profile from './screens/Profile';
import Browse from './screens/Browse';
import GearDetail from './screens/GearDetail';
import AuthScreen from './screens/AuthScreen';
import { Text } from 'react-native';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function BrowseStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="BrowseList" 
        component={Browse}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="GearDetail" 
        component={GearDetail}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

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
        name="Browse" 
        component={BrowseStack}
        options={{
          tabBarIcon: ({ color }) => (
            <Text style={{ color }}>🔍</Text>
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
