import React, { useContext, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

export default function Profile() {
  const { token } = useContext(AuthContext);
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedUser, setEditedUser] = useState<any>({});

  useEffect(() => {
    fetchUserProfile();
  }, [token]);

  // Frontend - Complete Profile Functions

const fetchUserProfile = async () => {
  try {
    setLoading(true);
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    const response = await fetch(
      'http://localhost:5000/api/auth/profile',
      {
        method: 'GET', // Fixed: Changed from PUT to GET
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
        // Removed body - GET requests don't need body
      }
    );

    console.log('Response status:', response.status);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log('API Response:', data);

      if (data.success && data.user) {
        const userData = {
          id: data.user.id || data.user._id,
          name: data.user.name || data.user.username || 'User',
          email: data.user.email || 'user@example.com',
          phone: data.user.phone || '',
          username: data.user.username || '',
          dateJoined: data.user.createdAt || data.user.dateJoined || new Date().toISOString(),
        };

        setUser(userData);
        setEditedUser(userData);
        console.log('✅ Profile data loaded:', userData);
      } else {
        console.log('❌ API response unsuccessful:', data);
        const defaultUser = {
          name: 'User',
          email: 'user@example.com',
          phone: '',
          username: '',
          dateJoined: new Date().toISOString(),
        };
        setUser(defaultUser);
        setEditedUser(defaultUser);
      }
    } else {
      const text = await response.text();
      console.log('Non-JSON response:', text);
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.log('Error fetching profile:', error);
    Alert.alert('Error', 'Failed to load profile data');

    const defaultUser = {
      name: 'User',
      email: 'user@example.com',
      phone: '',
      username: '',
      dateJoined: new Date().toISOString(),
    };
    setUser(defaultUser);
    setEditedUser(defaultUser);
  } finally {
    setLoading(false);
  }
};

const handleSaveProfile = async () => {
  try {
    if (!token) {
      Alert.alert('Error', 'No authentication token found');
      return;
    }

    const response = await fetch(
      'http://localhost:5000/api/auth/profile',
      {
        method: 'PUT', // This is correct for updating
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editedUser)
      }
    );

    console.log('Update response status:', response.status);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Update response:', data);

    if (data.success) {
      setUser(editedUser);
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } else {
      Alert.alert('Error', data.message || 'Failed to update profile');
    }
  } catch (error) {
    console.log('Error updating profile:', error);
    Alert.alert('Error', 'Failed to update profile');
  }
};

  const handleCancelEdit = () => {
    setEditedUser(user);
    setEditing(false);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Unknown';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Unknown';
    }
  };

  // Header component for reuse
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace("/"); // fallback to home if no previous screen
          }
        }}
      >
        <Ionicons name="arrow-back-outline" size={24} color="#ff2b2b" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Profile</Text>
      <TouchableOpacity onPress={() => editing ? handleSaveProfile() : setEditing(true)}>
        <Ionicons 
          name={editing ? "checkmark-outline" : "create-outline"} 
          size={24} 
          color="#ff2b2b" 
        />
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {renderHeader()}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@example.com'}</Text>
        </View>

        {/* Profile Information */}
        <View style={styles.infoSection}>
          <Text style={styles.sectionTitle}>Profile Information</Text>

          {/** Full Name */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Full Name</Text>
            {editing ? (
              <TextInput
                style={styles.textInput}
                value={editedUser.name || ''}
                onChangeText={(text) => setEditedUser({...editedUser, name: text})}
                placeholder="Enter your full name"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.name || 'Not provided'}</Text>
            )}
          </View>

          {/** Username */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Username</Text>
            {editing ? (
              <TextInput
                style={styles.textInput}
                value={editedUser.username || ''}
                onChangeText={(text) => setEditedUser({...editedUser, username: text})}
                placeholder="Enter your username"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.username || 'Not provided'}</Text>
            )}
          </View>

          {/** Email */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Email</Text>
            {editing ? (
              <TextInput
                style={styles.textInput}
                value={editedUser.email || ''}
                onChangeText={(text) => setEditedUser({...editedUser, email: text})}
                placeholder="Enter your email"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.email || 'Not provided'}</Text>
            )}
          </View>

          {/** Phone */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Phone Number</Text>
            {editing ? (
              <TextInput
                style={styles.textInput}
                value={editedUser.phone || ''}
                onChangeText={(text) => setEditedUser({...editedUser, phone: text})}
                placeholder="Enter your phone number"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.infoValue}>{user?.phone || 'Not provided'}</Text>
            )}
          </View>

          {/** Date Joined */}
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>{formatDate(user?.dateJoined)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        {editing && (
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelEdit}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Additional Options */}
        <View style={styles.optionsSection}>
          <Text style={styles.sectionTitle}>Account Options</Text>

          <TouchableOpacity style={styles.optionItem} onPress={() => router.push('/change-password')}>
            <Ionicons name="lock-closed-outline" size={20} color="#ff2b2b" />
            <Text style={styles.optionText}>Change Password</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem} onPress={() => router.push('/privacy-settings')}>
            <Ionicons name="shield-outline" size={20} color="#ff2b2b" />
            <Text style={styles.optionText}>Privacy Settings</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="#666" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.optionItem} onPress={() => router.push('/notification-settings')}>
            <Ionicons name="notifications-outline" size={20} color="#ff2b2b" />
            <Text style={styles.optionText}>Notification Settings</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles remain unchanged ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 16, color: '#666' },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 30 },
  avatarSection: { alignItems: 'center', backgroundColor: '#fff', paddingVertical: 30, marginBottom: 20 },
  avatarContainer: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#f8f8f8', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#ff2b2b', marginBottom: 15 },
  avatarText: { fontSize: 36, fontWeight: 'bold', color: '#ff2b2b' },
  userName: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 5 },
  userEmail: { fontSize: 16, color: '#666' },
  infoSection: { backgroundColor: '#fff', marginBottom: 20, paddingHorizontal: 20, paddingVertical: 20 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  infoItem: { marginBottom: 20 },
  infoLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  infoValue: { fontSize: 16, color: '#666', lineHeight: 22 },
  textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, backgroundColor: '#fff', color: '#333' },
  actionButtons: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 20 },
  cancelButton: { flex: 1, backgroundColor: '#f5f5f5', paddingVertical: 12, marginRight: 10, borderRadius: 8, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, color: '#333', fontWeight: '600' },
  saveButton: { flex: 1, backgroundColor: '#ff2b2b', paddingVertical: 12, marginLeft: 10, borderRadius: 8, alignItems: 'center' },
  saveButtonText: { fontSize: 16, color: '#fff', fontWeight: '600' },
  optionsSection: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 20 },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  optionText: { flex: 1, fontSize: 16, color: '#333', marginLeft: 15 },
});
