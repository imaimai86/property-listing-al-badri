import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { adminApi, fetchPublicProperties } from '../../services/api';
import { getImageUrl } from '../../utils/image';
import * as ImagePicker from 'expo-image-picker';
import { ChevronLeft, Camera, Save, X, Info, LogIn } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';

export default function EditPropertyScreen() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    location: '',
    beds: '',
    baths: '',
    area: '',
    category: 'Sale',
    status: 'Active',
    description: '',
    thumbnail: '',
    images: [] as string[],
    amenities: '',
    featured: false,
    short_desc: '',
    agent_phone: ''
  });
  
  const router = useRouter();
  const isEditing = !!id;

  const { user, token } = useAuth();

  useEffect(() => {
    if (!loading && !token) {
      Alert.alert('Authentication Required', 'You must be signed in to edit properties.', [
        { text: 'Log In', onPress: () => router.replace('/login') }
      ]);
    }
  }, [token]);

  useEffect(() => {
    if (isEditing) {
      loadProperty();
    }
  }, [id]);

  const loadProperty = async () => {
    setLoading(true);
    console.log('Loading property ID:', id);
    try {
      // Try public fetch first as it doesn't require auth token
      let data = await fetchPublicProperties();
      let item = data.find((p: any) => String(p.id) === String(id));
      
      // If not found in public, try admin API if we might have a token
      if (!item) {
        console.log('Not found in public list, trying admin API...');
        const adminData = await adminApi.post('getProperties');
        item = adminData.find((p: any) => String(p.id) === String(id));
      }

      if (item) {
        console.log('Successfully found property details:', item);
        setFormData({
          title: item.title || '',
          price: String(item.price || ''),
          location: item.location || '',
          beds: String(item.beds || ''),
          baths: String(item.baths || ''),
          area: String(item.area_sqm || item.area || ''),
          category: (item.type || '').toLowerCase() === 'rent' || (item.category || '').toLowerCase() === 'rent' ? 'Rent' : 'Sale',
          status: item.status || 'Active',
          description: item.long_desc || item.description || '',
          thumbnail: item.thumbnail || getImageUrl({ image: item.image }), // Fallback to old image logic
          featured: item.featured === true || item.featured === "TRUE" || item.featured === "true",
          short_desc: item.short_desc || '',
          agent_phone: item.agent_phone || (item.agent ? item.agent.phone : '') || '',
          images: (() => {
            if (Array.isArray(item.images)) return item.images;
            if (typeof item.images === 'string') {
              try {
                if (item.images.trim().startsWith('[')) return JSON.parse(item.images);
              } catch (e) {
                console.warn('Failed to parse images JSON:', e);
              }
              return [item.images]; // Treat as single image string
            }
            return [];
          })(),
          amenities: Array.isArray(item.amenities) ? item.amenities.join(', ') : (item.amenities || '')
        });
      } else {
        console.warn('Property not found in any list for ID:', id);
      }
    } catch (err: any) {
      console.error('Failed to load property:', err);
      // Optional: don't alert for every error here to avoid blocking UI if token is just missing
    } finally {
      setLoading(false);
    }
  };

  const pickThumbnail = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      handleUpload(result.assets[0], 'thumbnail');
    }
  };

  const pickGalleryImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true, // Enable multiple selection
      quality: 0.8,
    });

    if (!result.canceled) {
      // Upload all selected images
      for (const asset of result.assets) {
        await handleUpload(asset, 'gallery');
      }
    }
  };

  const handleUpload = async (asset: any, type: 'thumbnail' | 'gallery') => {
    console.log(`Starting ${type} upload process...`);
    console.log('Asset details:', { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType });

    if (!token) {
      Alert.alert('Error', 'You must be logged in to upload images.');
      return;
    }

    setUploading(true);
    try {
      // 1. Get Presigned URL
      console.log('Requesting presigned URL from backend...');
      
      // Generate unique filename with microsecond precision to avoid collisions
      const timestamp = Date.now();
      const microtime = Math.floor(performance.now() * 1000); // Microseconds
      const extension = asset.fileName ? asset.fileName.split('.').pop() : 'jpg';
      const uniqueFilename = `prop_${timestamp}_${microtime}.${extension}`;
      
      const { uploadUrl, publicUrl } = await adminApi.post('getUploadUrl', {
        filename: asset.fileName || uniqueFilename,
        mimeType: asset.mimeType || 'image/jpeg',
        propertyId: id || 'new' // Note: For new properties, images are uploaded to 'prop-id-new' folder temporarily or we need a temp ID. 
        // Ideally backend handles 'new' by generating a temp ID or we generate one here.
        // For now, let's stick with 'new' or current behavior.
      });
      console.log('Received presigned URL:', { uploadUrl, publicUrl });

      // 2. Upload to S3
      console.log('Fetching image blob from asset URI...');
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      console.log('Blob created, size:', blob.size, 'bytes');
      
      console.log('Uploading to S3...');
      const s3Response = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: {
          'Content-Type': asset.mimeType || 'image/jpeg',
        },
      });

      if (!s3Response.ok) {
        throw new Error(`S3 upload failed with status ${s3Response.status}: ${s3Response.statusText}`);
      }

      console.log('S3 upload successful!');
      
      if (type === 'thumbnail') {
        setFormData(prev => ({ ...prev, thumbnail: publicUrl }));
      } else {
        setFormData(prev => ({ ...prev, images: [...prev.images, publicUrl] }));
      }
      
      Alert.alert('Success', `${type === 'thumbnail' ? 'Thumbnail' : 'Image'} uploaded successfully`);
    } catch (err: any) {
      console.error('Upload failed:', err);
      Alert.alert('Error', `Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteImage = async (path: string) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this image?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            // 1. Call API to soft-delete
            await adminApi.post('deleteImage', {
              propertyId: id || 'new',
              imagePath: path
            });
            
            // 2. Remove from state
            setFormData(prev => ({
              ...prev,
              images: prev.images.filter(img => img !== path)
            }));
            
            Alert.alert('Success', 'Image deleted');
          } catch (err: any) {
            console.error('Delete failed:', err);
            Alert.alert('Error', 'Failed to delete image');
          } finally {
            setLoading(false);
          }
        }
      }
    ]);
  };

  const handleSave = async () => {
    console.log('Attempting to save property...');
    if (!token) {
      Alert.alert('Error', 'You are not logged in. Please sign in to save changes.');
      router.push('/login');
      return;
    }

    if (!formData.title || !formData.price) {
      Alert.alert('Validation Error', 'Title and Price are required');
      return;
    }
    
    setLoading(true);
    const payload = { ...formData, id: id || 'new' };
    console.log('Save payload:', JSON.stringify(payload, null, 2));

    try {
      const result = await adminApi.post('saveProperty', payload);
      console.log('Save result:', result);
      Alert.alert('Success', 'Property saved successfully');
      router.back();
    } catch (err: any) {
      console.error('Save failed:', err);
      Alert.alert('Save Error', err.message || 'Failed to save property. Please check your connection and login status.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <View className="flex-1 justify-center items-center bg-white"><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View className="flex-1 bg-white">
      <View className="pt-12 px-6 flex-row items-center justify-between border-b border-gray-100 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center">
          <ChevronLeft color="black" size={24} />
        </TouchableOpacity>
        <Text className="text-lg font-bold">{isEditing ? 'Edit Property' : 'New Property'}</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} className="px-4 py-2 bg-blue-600 rounded-lg">
          <Text className="text-white font-bold">Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
          <View className="mb-6">
            <Text className="text-sm font-bold text-gray-700 mb-2">Thumbnail Image</Text>
            <TouchableOpacity 
              onPress={pickThumbnail}
              className="w-full h-48 bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl items-center justify-center overflow-hidden"
            >
              {formData.thumbnail ? (
                <View className="relative w-full h-full">
                  <Image source={{ uri: getImageUrl({ image: formData.thumbnail }) }} className="w-full h-full" resizeMode="cover" />
                  <View className="absolute inset-0 bg-black/30 items-center justify-center opacity-0 hover:opacity-100">
                    <Camera color="white" size={30} />
                  </View>
                </View>
              ) : (
                <View className="items-center">
                  <Camera color="#9ca3af" size={40} />
                  <Text className="text-gray-400 mt-2">Tap to upload thumbnail</Text>
                  {uploading && <ActivityIndicator color="#2563eb" className="mt-2" />}
                </View>
              )}
            </TouchableOpacity>
          </View>

          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-2">
              <Text className="text-sm font-bold text-gray-700">Gallery Images</Text>
              <TouchableOpacity onPress={pickGalleryImages} className="flex-row items-center">
                <Text className="text-blue-600 font-bold text-xs mr-1">Add Photos</Text>
                <Camera size={14} color="#2563eb" />
              </TouchableOpacity>
            </View>
            
            <View className="flex-row flex-wrap">
              {formData.images.map((img, index) => (
                <View key={index} className="w-1/3 p-1 relative h-28">
                  <Image source={{ uri: getImageUrl({ image: img }) }} className="w-full h-full rounded-lg bg-gray-100" resizeMode="cover" />
                  <TouchableOpacity 
                    onPress={() => handleDeleteImage(img)}
                    className="absolute top-2 right-2 bg-red-500 rounded-full p-1 shadow-sm"
                  >
                    <X size={12} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              
              <TouchableOpacity 
                onPress={pickGalleryImages}
                className="w-1/3 p-1 h-28"
              >
                <View className="w-full h-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg items-center justify-center">
                  <Camera color="#9ca3af" size={24} />
                  <Text className="text-gray-400 text-xs mt-1">Add</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <View>
              <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Title</Text>
              <TextInput 
                placeholder="Property Title"
                className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                value={formData.title}
                onChangeText={(t) => setFormData({...formData, title: t})}
              />
            </View>

            <View className="flex-row space-x-4 mt-4">
              <View className="flex-1">
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Price</Text>
                <TextInput 
                  placeholder="$350k"
                  className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                  value={formData.price}
                  onChangeText={(t) => setFormData({...formData, price: t})}
                />
              </View>
              <View className="flex-1 ml-4">
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Category</Text>
                <View className="bg-gray-50 rounded-xl border border-gray-100 flex-row">
                  <TouchableOpacity 
                    onPress={() => setFormData({...formData, category: 'Sale'})}
                    className={`flex-1 py-4 items-center rounded-l-xl ${formData.category === 'Sale' ? 'bg-blue-600' : ''}`}
                  >
                    <Text className={formData.category === 'Sale' ? 'text-white font-bold' : 'text-gray-500'}>Sale</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={() => setFormData({...formData, category: 'Rent'})}
                    className={`flex-1 py-4 items-center rounded-r-xl ${formData.category === 'Rent' ? 'bg-blue-600' : ''}`}
                  >
                    <Text className={formData.category === 'Rent' ? 'text-white font-bold' : 'text-gray-500'}>Rent</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View className="flex-row items-center justify-between mt-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
               <View>
                 <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Status</Text>
                 <View className="flex-row">
                    <TouchableOpacity 
                      onPress={() => setFormData({...formData, status: 'Active'})}
                      className={`px-4 py-2 rounded-l-lg ${formData.status === 'Active' ? 'bg-green-500' : 'bg-gray-200'}`}
                    >
                      <Text className={formData.status === 'Active' ? 'text-white font-bold' : 'text-gray-600'}>Active</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => setFormData({...formData, status: 'Occupied'})}
                      className={`px-4 py-2 rounded-r-lg ${formData.status === 'Occupied' ? 'bg-orange-500' : 'bg-gray-200'}`}
                    >
                      <Text className={formData.status === 'Occupied' ? 'text-white font-bold' : 'text-gray-600'}>Occupied</Text>
                    </TouchableOpacity>
                 </View>
               </View>

               <View className="items-end">
                 <Text className="text-xs font-bold text-gray-400 uppercase mb-1">Featured</Text>
                 <TouchableOpacity 
                    onPress={() => setFormData({...formData, featured: !formData.featured})}
                    className={`px-4 py-2 rounded-lg ${formData.featured ? 'bg-yellow-500' : 'bg-gray-200'}`}
                 >
                    <Text className={formData.featured ? 'text-white font-bold' : 'text-gray-600'}>
                      {formData.featured ? '★ Featured' : 'Standard'}
                    </Text>
                 </TouchableOpacity>
               </View>
            </View>

            <View className="mt-4">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Location</Text>
              <TextInput 
                placeholder="Address or Neighborhood"
                className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                value={formData.location}
                onChangeText={(t) => setFormData({...formData, location: t})}
              />
            </View>

            <View className="flex-row space-x-3 mt-4">
              <View className="flex-1">
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Beds</Text>
                <TextInput 
                  placeholder="3"
                  className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                  keyboardType="numeric"
                  value={formData.beds}
                  onChangeText={(t) => setFormData({...formData, beds: t})}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Baths</Text>
                <TextInput 
                  placeholder="2"
                  className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                  keyboardType="numeric"
                  value={formData.baths}
                  onChangeText={(t) => setFormData({...formData, baths: t})}
                />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Sqft</Text>
                <TextInput 
                  placeholder="1200"
                  className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                  keyboardType="numeric"
                  value={formData.area}
                  onChangeText={(t) => setFormData({...formData, area: t})}
                />
              </View>
            </View>

            <View className="mt-4">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Short Description</Text>
              <TextInput 
                placeholder="Brief summary used in cards"
                className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                value={formData.short_desc}
                onChangeText={(t) => setFormData({...formData, short_desc: t})}
              />
            </View>

            <View className="mt-4">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Agent Phone</Text>
              <TextInput 
                placeholder="+1 234 567 8900"
                className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                keyboardType="phone-pad"
                value={formData.agent_phone}
                onChangeText={(t) => setFormData({...formData, agent_phone: t})}
              />
            </View>

            <View className="mt-4">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Description</Text>
              <TextInput 
                placeholder="Describe the property..."
                className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                multiline
                numberOfLines={4}
                value={formData.description}
                onChangeText={(t) => setFormData({...formData, description: t})}
              />
            </View>

            <View className="mt-4 mb-20">
              <Text className="text-xs font-bold text-gray-400 uppercase mb-1 ml-1">Amenities</Text>
              <TextInput 
                placeholder="Pool, Gym, Parking..."
                className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-gray-900"
                value={formData.amenities}
                onChangeText={(t) => setFormData({...formData, amenities: t})}
              />
            </View>

            {isEditing && (
              <TouchableOpacity 
                onPress={() => {
                  Alert.alert(
                    "Delete Property",
                    "Are you sure you want to delete this property? This will mark it as Deleted.",
                    [
                      { text: "Cancel", style: "cancel" },
                      { 
                        text: "Delete", 
                        style: "destructive", 
                        onPress: async () => {
                          setLoading(true);
                          try {
                            // We use saveProperty but with status 'Deleted' to soft delete
                            await adminApi.post('saveProperty', {
                              ...formData,
                              status: 'Deleted',
                              id: id
                            });
                            Alert.alert("Success", "Property deleted successfully");
                            router.replace('/(tabs)/');
                          } catch (e: any) {
                            Alert.alert("Error", e.message);
                          } finally {
                            setLoading(false);
                          }
                        }
                      }
                    ]
                  );
                }}
                className="mt-6 bg-red-50 p-4 rounded-xl border border-red-100 items-center mb-8"
              >
                <Text className="text-red-600 font-bold">Delete Property</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
