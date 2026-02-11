import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Shield, Mail, Building } from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white p-6 items-center border-b border-gray-200">
        <View className="w-24 h-24 bg-blue-100 rounded-full items-center justify-center mb-4">
          <User size={48} color="#2563eb" />
        </View>
        <Text className="text-2xl font-bold text-gray-900">{user?.name}</Text>
        <View className="flex-row items-center bg-blue-50 px-3 py-1 rounded-full mt-2">
          <Shield size={14} color="#2563eb" />
          <Text className="text-blue-700 text-xs font-bold ml-1">{(user?.role || 'Agent').toUpperCase()}</Text>
        </View>
      </View>

      <View className="p-6">
        <Text className="text-sm font-bold text-gray-400 uppercase mb-4">Account Details</Text>
        
        <View className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-4">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-gray-50 rounded-lg items-center justify-center mr-4">
              <Mail size={20} color="#6b7280" />
            </View>
            <View>
              <Text className="text-xs text-gray-400">Email Address</Text>
              <Text className="text-gray-900 font-medium">{user?.email || 'agent@albadri.com'}</Text>
            </View>
          </View>

          <View className="flex-row items-center mt-4">
            <View className="w-10 h-10 bg-gray-50 rounded-lg items-center justify-center mr-4">
              <Building size={20} color="#6b7280" />
            </View>
            <View>
              <Text className="text-xs text-gray-400">Company</Text>
              <Text className="text-gray-900 font-medium">Al Badri Real Estate</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          onPress={logout}
          className="bg-red-50 border border-red-100 rounded-2xl p-4 flex-row items-center justify-center mt-8"
          activeOpacity={0.7}
        >
          <LogOut size={20} color="#dc2626" />
          <Text className="text-red-600 font-bold ml-2">Sign Out</Text>
        </TouchableOpacity>
      </View>

      <View className="items-center mt-10 p-6">
        <Text className="text-gray-300 text-xs text-center">
          Al Badri Real Estate v1.0.0{'\n'}
          Property Management System
        </Text>
      </View>
    </ScrollView>
  );
}
