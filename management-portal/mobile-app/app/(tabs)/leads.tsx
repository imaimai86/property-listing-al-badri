import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { adminApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { User, Calendar, Phone, Mail, Lock, Unlock } from 'lucide-react-native';

export default function LeadsScreen() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    try {
      const data = await adminApi.post('getLeads');
      setLeads(data);
    } catch (err: any) {
      console.error('Error loading leads:', err);
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadLeads();
  };

  const handlePickLead = async (leadId: string) => {
    try {
      await adminApi.post('lockLead', { leadId });
      Alert.alert('Success', 'Lead assigned to you for 24 hours');
      loadLeads(); // Refresh to see updated state
    } catch (err: any) {
      Alert.alert('Failed to Pick Lead', err.message);
    }
  };

  const renderLead = ({ item }: { item: any }) => {
    const isLockedByMe = String(item.locked_by) === String(user?.id);
    const isLockedByOthers = item.locked_by && item.locked_by !== '' && !isLockedByMe;
    
    // Simple 24h check on frontend as well
    const lockTime = item.locked_at ? new Date(item.locked_at).getTime() : 0;
    const isLockExpired = (new Date().getTime() - lockTime) / (1000 * 60 * 60) >= 24;
    const activeLock = !isLockExpired && isLockedByOthers;

    return (
      <View className="bg-white rounded-2xl mb-4 p-4 border border-gray-100 shadow-sm">
        <View className="flex-row justify-between items-start mb-3">
          <View className="flex-1">
            <Text className="text-lg font-bold text-gray-900">{item.name || 'Anonymous Lead'}</Text>
            <View className="flex-row items-center mt-1">
              <Mail size={14} color="#6b7280" />
              <Text className="text-gray-500 text-xs ml-1" numberOfLines={1}>{item.email}</Text>
            </View>
          </View>
          <View className={`px-2 py-1 rounded-md ${item.status === 'In Progress' ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Text className={`text-xs font-bold ${item.status === 'In Progress' ? 'text-blue-700' : 'text-gray-700'}`}>
              {(item.status || 'NEW').toUpperCase()}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center mb-4">
          <Phone size={14} color="#6b7280" />
          <Text className="text-gray-600 text-sm ml-2">{item.phone}</Text>
        </View>

        <View className="flex-row justify-between items-center pt-3 border-t border-gray-50">
          <View className="flex-row items-center">
            <Calendar size={14} color="#9ca3af" />
            <Text className="text-gray-400 text-xs ml-1">
              {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
            </Text>
          </View>
          
          {activeLock ? (
            <View className="flex-row items-center bg-red-50 px-3 py-1.5 rounded-lg">
              <Lock size={14} color="#b91c1c" />
              <Text className="text-red-700 text-xs font-bold ml-1">Locked by {item.agent_assigned || 'Agent'}</Text>
            </View>
          ) : isLockedByMe ? (
            <View className="flex-row items-center bg-green-50 px-3 py-1.5 rounded-lg">
              <User size={14} color="#15803d" />
              <Text className="text-green-700 text-xs font-bold ml-1">Assigned to Me</Text>
            </View>
          ) : (
            <TouchableOpacity 
              onPress={() => handlePickLead(item.id)}
              className="bg-blue-600 px-4 py-2 rounded-lg flex-row items-center"
              activeOpacity={0.7}
            >
              <Unlock size={14} color="white" />
              <Text className="text-white text-xs font-bold ml-1">Pick Lead</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <FlatList
        data={leads}
        keyExtractor={(item) => (item.id || Math.random()).toString()}
        renderItem={renderLead}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#2563eb" />
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-gray-500">No leads found</Text>
          </View>
        }
      />
    </View>
  );
}
