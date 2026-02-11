import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { adminApi, fetchPublicProperties } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getImageUrl } from '../../utils/image';
import { Search, Plus, Filter, MapPin, Bed, Bath, Square, Activity } from 'lucide-react-native';
import { useRouter } from 'expo-router';

export default function PropertiesScreen() {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const data = await fetchPublicProperties();
      setProperties(data);
    } catch (err) {
      console.error('Error loading properties:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadProperties();
  };

  const renderProperty = ({ item }: { item: any }) => (
    <TouchableOpacity 
      className="bg-white rounded-2xl mb-4 overflow-hidden border border-gray-100 shadow-sm"
      activeOpacity={0.8}
      onPress={() => router.push(`/property/${item.id}`)}
    >
      <Image 
        source={{ uri: getImageUrl(item) }} 
        className="w-full h-48 bg-gray-200"
      />
      <View className="p-4">
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900" numberOfLines={1}>{item.title}</Text>
            <Text className="text-gray-500 text-sm">{item.location}</Text>
          </View>
          <Text className="text-blue-600 font-bold text-lg">{item.price}</Text>
        </View>
        
        <View className="flex-row items-center mt-3 pt-3 border-t border-gray-50">
          <View className="flex-row items-center mr-4">
             <Text className="text-gray-600 text-sm font-medium">{item.beds} Beds</Text>
          </View>
          <View className="flex-row items-center mr-4">
             <Text className="text-gray-600 text-sm font-medium">{item.baths} Baths</Text>
          </View>
          <View className="flex-1" />
          <View className={`px-2 py-1 rounded-md ${item.category === 'Sale' ? 'bg-green-100' : 'bg-orange-100'}`}>
            <Text className={`text-xs font-bold ${item.category === 'Sale' ? 'text-green-700' : 'text-orange-700'}`}>
              {(item.category || '').toUpperCase()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-4 py-4 border-b border-gray-200">
        <View className="flex-row items-center bg-gray-100 rounded-xl px-3 py-2">
          <Search size={20} color="#6b7280" />
          <Text className="text-gray-400 ml-2">Search properties...</Text>
        </View>
      </View>

      <FlatList
        data={properties}
        keyExtractor={(item) => (item.id || Math.random()).toString()}
        renderItem={renderProperty}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-gray-500">No properties found</Text>
          </View>
        }
      />

      {/* Management Action: Plus Button (Visible for all logged in users of the portal) */}
      <TouchableOpacity 
        onPress={() => router.push('/property/edit')}
        className="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg shadow-blue-300"
        activeOpacity={0.9}
      >
        <Plus color="white" size={30} />
      </TouchableOpacity>
    </View>
  );
}
