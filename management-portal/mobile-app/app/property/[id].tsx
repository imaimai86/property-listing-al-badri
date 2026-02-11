import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { fetchPublicProperties } from '../../services/api';
import { getImageUrl } from '../../utils/image';
import { useAuth } from '../../context/AuthContext';
import { ChevronLeft, Edit2, Share2, Heart, MapPin, Bed, Bath, Maximize, Square, Info, Shield, Phone, Mail } from 'lucide-react-native';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams();
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    loadProperty();
  }, [id]);

  const loadProperty = async () => {
    try {
      const data = await fetchPublicProperties();
      const item = data.find((p: any) => String(p.id) === String(id));
      
      if (item) {
        // Parse gallery images (comma-separated string or JSON array)
        let galleryImages = [];
        if (Array.isArray(item.images)) {
          galleryImages = item.images;
        } else if (typeof item.images === 'string' && item.images.trim()) {
          if (item.images.trim().startsWith('[')) {
            // JSON array format (legacy)
            try {
              galleryImages = JSON.parse(item.images);
            } catch (e) {
              console.warn('Failed to parse images JSON:', e);
            }
          } else {
            // Comma-separated format (new)
            galleryImages = item.images.split(',').map((img: string) => img.trim()).filter((img: string) => img.length > 0);
          }
        }
        
        // Use thumbnail as main image, fallback to first gallery image or legacy image field
        const mainImage = item.thumbnail || item.image || (galleryImages.length > 0 ? galleryImages[0] : null);
        
        item.mainImage = mainImage ? getImageUrl({ image: mainImage }) : null;
        item.galleryImages = galleryImages.map((img: string) => getImageUrl({ image: img }));
      }
      
      setProperty(item);
    } catch (err) {
      console.error('Error fetching property detail:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View className="flex-1 justify-center items-center bg-white"><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!property) return <View className="flex-1 justify-center items-center bg-white"><Text className="text-gray-500">Property not found</Text></View>;

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" bounces={false}>
          
          {/* Main Image (Thumbnail) */}
          <View className="h-80 relative bg-gray-200">
            {property.mainImage ? (
              <Image 
                source={{ uri: property.mainImage }} 
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="w-full h-full items-center justify-center bg-gray-200">
                <Text className="text-gray-400">No image available</Text>
              </View>
            )}

            <TouchableOpacity 
              onPress={() => router.back()}
              className="absolute top-12 left-6 w-10 h-10 bg-white/80 rounded-full items-center justify-center z-10"
            >
              <ChevronLeft color="black" size={24} />
            </TouchableOpacity>

            {/* Management Action: Edit Button */}
            <TouchableOpacity 
              onPress={() => router.push({ pathname: '/property/edit', params: { id: property.id } })}
              className="absolute top-12 right-6 w-10 h-10 bg-blue-600 rounded-full items-center justify-center shadow-lg z-10"
            >
              <Edit2 color="white" size={20} />
            </TouchableOpacity>
          </View>

          {/* Gallery Images Thumbnails */}
          {property.galleryImages && property.galleryImages.length > 0 && (
            <View className="px-6 pt-4">
              <Text className="text-sm font-bold text-gray-700 mb-2">Gallery</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {property.galleryImages.map((img: string, index: number) => (
                    <Image 
                      key={index}
                      source={{ uri: img }} 
                      className="w-20 h-20 rounded-lg bg-gray-200"
                      resizeMode="cover"
                    />
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
          
          <View className="p-6">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-4">
              <View className="flex-row gap-2 mb-2">
                 {property.status && (
                   <View className={`px-2 py-1 rounded ${property.status === 'Active' ? 'bg-green-100' : 'bg-orange-100'}`}>
                     <Text className={`text-xs font-bold ${property.status === 'Active' ? 'text-green-700' : 'text-orange-700'}`}>{property.status}</Text>
                   </View>
                 )}
                 {(property.featured === true || property.featured === "TRUE" || property.featured === "true") && (
                   <View className="px-2 py-1 rounded bg-yellow-100">
                     <Text className="text-xs font-bold text-yellow-700">Featured</Text>
                   </View>
                 )}
              </View>
              <Text className="text-2xl font-bold text-gray-900">{property.title}</Text>
              <View className="flex-row items-center mt-2">
                <MapPin size={16} color="#6b7280" />
                <Text className="text-gray-500 ml-1">{property.location}</Text>
              </View>
            </View>
            <Text className="text-blue-600 font-bold text-2xl">{property.price}</Text>
          </View>

          <View className="flex-row justify-between bg-gray-50 rounded-2xl p-4 mt-6">
            <View className="items-center flex-1 border-r border-gray-200">
              <Bed size={20} color="#3b82f6" />
              <Text className="text-gray-900 font-bold mt-1">{property.beds || '0'}</Text>
              <Text className="text-gray-400 text-xs">Beds</Text>
            </View>
            <View className="items-center flex-1 border-r border-gray-200">
              <Bath size={20} color="#3b82f6" />
              <Text className="text-gray-900 font-bold mt-1">{property.baths || '0'}</Text>
              <Text className="text-gray-400 text-xs">Baths</Text>
            </View>
            <View className="items-center flex-1">
              <Maximize size={20} color="#3b82f6" />
              <Text className="text-gray-900 font-bold mt-1">{property.area || 'N/A'}</Text>
              <Text className="text-gray-400 text-xs">Sqft</Text>
            </View>
          </View>

          {property.short_desc ? (
            <Text className="text-gray-500 italic mt-6 text-base">{property.short_desc}</Text>
          ) : null}

          <Text className="text-lg font-bold text-gray-900 mt-8">Description</Text>
          <Text className="text-gray-600 leading-6 mt-2">
            {property.description || 'This property features modern architecture and premium finishes...'}
          </Text>

          <View className="mt-8 pt-6 border-t border-gray-100">
             <Text className="text-sm font-bold text-gray-400 uppercase">Listing Agent</Text>
             <Text className="text-lg font-bold text-gray-900 mt-1">{property.agent_name || 'System'}</Text>
             {property.agent_phone && (
               <View className="flex-row items-center mt-2">
                 <Phone size={16} color="#4b5563" />
                 <Text className="text-gray-600 ml-2">{property.agent_phone}</Text>
               </View>
             )}
          </View>

          {property.amenities && (
            <View>
              <Text className="text-lg font-bold text-gray-900 mt-8">Amenities</Text>
              <View className="flex-row flex-wrap mt-2">
                {String(property.amenities).split(',').map((am: string, i: number) => (
                  <View key={i} className="bg-gray-100 rounded-lg px-3 py-1.5 mr-2 mb-2">
                    <Text className="text-gray-700 text-sm">{am.trim()}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
