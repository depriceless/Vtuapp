import React, { useContext, useEffect, useState } from 'react';
import FundWallet from './fund-wallet'; // ✅ Fixed: Correct file name

import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  Modal, // ✅ Added: Import Modal for the fund wallet modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthContext } from '../contexts/AuthContext';
import { useRouter } from 'expo-router';

const SCREEN_WIDTH = Dimensions.get('window').width;

// ✅ FIXED: API Configuration - Updated endpoints to match server routes
const API_CONFIG = {
  BASE_URL: 'http://localhost:5000/api',  // ✅ FIXED: Changed to match your working endpoint
  ENDPOINTS: {
    PROFILE: '/auth/profile',  // ✅ FIXED: Changed from '/user/profile' to '/auth/profile'
    BALANCE: '/balance',       
    TRANSACTIONS: '/transactions', 
  }
};
// ✅ NEW: TypeScript interfaces for better type safety
interface User {
  name: string;
  email: string;
  phone?: string;
  username?: string;
  dateJoined?: string;
}

interface Transaction {
  type: string;
  amount: number;
  date: string;
}

interface MenuItemType {
  name: string;
  icon: string;
  route?: string;
}

export default function Dashboard() {
  const { logout, token, isLoggedIn } = useContext(AuthContext);
  const router = useRouter();

  // ✅ IMPROVED: Better typed state management
  const [user, setUser] = useState<User | null>(null);
  const [accountBalance, setAccountBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [showFundWallet, setShowFundWallet] = useState(false);

  // ✅ IMPROVED: Loading states for better UX
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ✅ REMOVED: Unused airtime form states (cleaned up)
  // These were declared but never used in the original code

  const sidebarAnim = useState(new Animated.Value(-SCREEN_WIDTH * 0.7))[0];

  // ✅ IMPROVED: Better typed menu items
  const menuItems: MenuItemType[] = [
    { name: 'Dashboard', icon: 'home-outline', route: '/dashboard' },
    { name: 'Profile', icon: 'person-outline', route: '/profile' },
    { name: 'Buy Airtime', icon: 'call-outline', route: '/buy-airtime' },
    { name: 'Buy Data', icon: 'wifi-outline', route: '/buy-data' },
    { name: 'Electricity', icon: 'flash-outline', route: '/electricity' },
    { name: 'Cable TV', icon: 'tv-outline', route: '/cable-tv' },
    { name: 'Internet', icon: 'globe-outline', route: '/internet' },
    { name: 'Transfer', icon: 'send-outline', route: '/transfer' },
    { name: 'Settings', icon: 'settings-outline', route: '/settings' },
    { name: 'Logout', icon: 'log-out-outline' },
  ];

  // ✅ NEW: Helper function for API calls with better error handling
  const makeApiCall = async (endpoint: string, fallbackValue: any = null) => {
    try {
      if (!token) return fallbackValue;

      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        console.log(`${endpoint} returned non-JSON response, using fallback`);
        return fallbackValue;
      }
    } catch (error) {
      console.log(`${endpoint} API error:`, error);
      return fallbackValue;
    }
  };

  // ✅ IMPROVED: Parallel API calls for better performance
  const fetchData = async (showLoader = true) => {
  try {
    if (showLoader) setIsLoading(true);
    setIsRefreshing(!showLoader);

    if (!token) return;

    // Parallel API calls
    const [userResponse, balanceResponse, transactionsResponse] = await Promise.allSettled([
      makeApiCall(API_CONFIG.ENDPOINTS.PROFILE, { user: null }),
      makeApiCall(API_CONFIG.ENDPOINTS.BALANCE, { balance: { amount: '0', currency: 'NGN' } }),
      makeApiCall(API_CONFIG.ENDPOINTS.TRANSACTIONS, { transactions: [] })
    ]);

    // ====== USER DATA ======
    if (userResponse.status === 'fulfilled' && userResponse.value?.success && userResponse.value?.user) {
      const userData = userResponse.value.user;
      setUser({
        name: userData.name || userData.username || 'User',
        email: userData.email || 'user@example.com',
        phone: userData.phone || undefined,
        username: userData.username || undefined,
        dateJoined: userData.createdAt || userData.dateJoined || undefined,
      });
      console.log('✅ User data fetched successfully');
    } else {
      console.log('⚠️ Using default user data');
      setUser({ name: 'User', email: 'user@example.com' });
    }

    // ====== BALANCE DATA ======
    if (balanceResponse.status === 'fulfilled' && balanceResponse.value?.success) {
      // Access nested `balance` object
      const balanceData = balanceResponse.value.balance;
      const calculatedBalance = parseFloat(balanceData?.amount || '0');
      setAccountBalance(calculatedBalance);
      console.log('✅ Balance data fetched successfully:', calculatedBalance);
    } else {
      console.log('⚠️ Using default balance');
      setAccountBalance(0);
    }

    // ====== TRANSACTIONS DATA ======
    if (transactionsResponse.status === 'fulfilled' && transactionsResponse.value?.transactions) {
      setTransactions(transactionsResponse.value.transactions);
    } else {
      console.log('⚠️ Using default transactions');
      setTransactions([]);
    }

  } catch (error) {
    console.error('❌ Error in fetchData:', error);
    // Fallbacks
    if (!user) setUser({ name: 'User', email: 'user@example.com' });
    if (accountBalance === undefined) setAccountBalance(0);
    if (!transactions.length) setTransactions([]);
  } finally {
    setIsLoading(false);
    setIsRefreshing(false);
  }
};


  useEffect(() => {
    fetchData();
  }, [token]);

  // ✅ NEW: Refresh function for pull-to-refresh functionality
  const handleRefresh = () => {
    fetchData(false);
  };

  // ✅ IMPROVED: Simplified navigation with better error handling
  const navigateToProfile = () => {
    console.log('Profile pressed, user data:', user);

    if (sidebarOpen) {
      toggleSidebar();
    }

    const profileRoutes = ['/profile', '/(app)/profile', '/user-profile'];

    for (const route of profileRoutes) {
      try {
        router.push(route);
        return; // Success, exit the function
      } catch (error) {
        console.log(`Failed to navigate to ${route}:`, error);
      }
    }

    // If all routes fail
    Alert.alert('Navigation Error', 'Could not open profile. Please check if profile screen exists.');
  };

  const handleProfilePress = navigateToProfile;

  const handleLogout = async () => {
    console.log('🔥 LOGOUT REQUESTED - SHOWING CONFIRMATION 🔥'); 
    setShowLogoutConfirm(true);
  };

  const confirmLogout = async () => {
    console.log('✅ LOGOUT CONFIRMED - PROCEEDING');
    setShowLogoutConfirm(false);

    try {
      console.log('🔄 Step 1: Calling AuthContext logout()...');
      await logout();
      console.log('✅ Step 2: AuthContext logout completed successfully');

      console.log('🚀 Step 3: Navigating to login screen...');

      // ✅ IMPROVED: Simplified navigation logic
      const loginRoutes = ['/', '/login', '/(auth)/login', '/signin'];

      for (const route of loginRoutes) {
        try {
          router.replace(route);
          console.log(`🎯 Successfully navigated to ${route}`);
          return;
        } catch (error) {
          console.log(`Failed to navigate to ${route}:`, error);
        }
      }

    } catch (error) {
      console.error('❌ Logout error occurred:', error);
      Alert.alert('Logout Error', 'An error occurred during logout. Please restart the app.');
    }
  };

  const cancelLogout = () => {
    console.log('❌ LOGOUT CANCELLED');
    setShowLogoutConfirm(false);
  };

  const toggleSidebar = () => {
    Animated.timing(sidebarAnim, {
      toValue: sidebarOpen ? -SCREEN_WIDTH * 0.7 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
    setSidebarOpen(!sidebarOpen);
  };

  const handleMenuPress = (item: MenuItemType) => {
    console.log('Menu item pressed:', item.name);
    if (item.name === 'Logout') {
      toggleSidebar();
      setTimeout(() => {
        handleLogout();
      }, 100);
    } else {
      setActiveMenu(item.name);
      if (item.route) router.push(item.route);
      toggleSidebar();
    }
  };

  const handleQuickAction = (route: string) => {
    router.push(route);
  };

  const handleFundWallet = () => {
    console.log('Fund Wallet button pressed - showing modal');
    setShowFundWallet(true);
  };

  const toggleBalanceVisibility = () => {
    setBalanceVisible(!balanceVisible);
  };

  // ✅ NEW: Handle successful wallet funding
  const handleFundWalletSuccess = () => {
    setShowFundWallet(false);
    handleRefresh(); // Use the new refresh function
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Sidebar */}
      <Animated.View style={[styles.sidebar, { left: sidebarAnim }]}>
        <View style={styles.profileSection}>
          <View style={styles.profileHeader}>
            <TouchableOpacity onPress={handleProfilePress} style={styles.profileTouchable}>
              <View style={styles.profileAvatar}>
                {user?.name ? (
                  <Text style={styles.avatarText}>
                    {user.name.charAt(0).toUpperCase()}
                  </Text>
                ) : (
                  <Ionicons name="person-outline" size={24} color="#ff2b2b" />
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleProfilePress} style={styles.profileInfoTouchable}>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>
                  {user?.name || (isLoading ? 'Loading...' : 'User')}
                </Text>
                <Text style={styles.profileEmail}>
                  {user?.email || (isLoading ? 'Loading...' : 'user@example.com')}
                </Text>
                {user?.phone && (
                  <Text style={styles.profilePhone}>{user.phone}</Text>
                )}
                <Text style={styles.tapToViewProfile}>Tap to view profile</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={styles.sidebarTitle}>Menu</Text>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.name}
            style={[
              styles.sidebarItem,
              activeMenu === item.name && styles.activeSidebarItem,
              item.name === 'Logout' && styles.sidebarLogoutButton,
            ]}
            onPress={() => handleMenuPress(item)}
          >
            <Ionicons
              name={item.icon as any}
              size={22}
              color={
                item.name === 'Logout'
                  ? '#fff'
                  : activeMenu === item.name
                  ? '#fff'
                  : '#ff2b2b'
              }
            />
            <Text
              style={[
                styles.sidebarText,
                activeMenu === item.name && styles.activeSidebarText,
                item.name === 'Logout' && styles.sidebarLogoutText,
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>

      {/* Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={toggleSidebar}>
            <Ionicons name="menu-outline" size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleProfilePress} style={styles.headerProfileButton}>
            <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0] || 'User'}</Text>
            <Ionicons name="chevron-forward-outline" size={16} color="#fff" style={{ marginLeft: 5 }} />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceSection}>
          <View style={styles.balanceInfo}>
            <View style={styles.balanceTitleRow}>
              <Text style={styles.balanceTitle}>Wallet Balance</Text>
              <TouchableOpacity onPress={toggleBalanceVisibility} style={styles.balanceToggle}>
                <Ionicons 
                  name={balanceVisible ? "eye-outline" : "eye-off-outline"} 
                  size={20} 
                  color="#fff" 
                />
              </TouchableOpacity>
              {/* ✅ NEW: Refresh button */}
              <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton} disabled={isRefreshing}>
                <Ionicons 
                  name={isRefreshing ? "reload-outline" : "refresh-outline"} 
                  size={18} 
                  color="#fff" 
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.balanceAmount}>
              {balanceVisible ? `₦${accountBalance.toLocaleString()}` : '₦****'}
            </Text>
          </View>
          <TouchableOpacity style={styles.fundButton} onPress={handleFundWallet}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.fundButtonText}>Fund Wallet</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.servicesHeader}>What would you like to do?</Text>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/buy-airtime')}
          >
            <Ionicons name="call-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Buy Airtime</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/buy-data')}
          >
            <Ionicons name="wifi-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Buy Data</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/electricity')}
          >
            <Ionicons name="flash-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Electricity</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/cable-tv')}
          >
            <Ionicons name="tv-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Cable TV</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/print-recharge')}
          >
            <Ionicons name="print-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Print Recharge</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/fund-betting')}
          >
            <Ionicons name="football-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Fund Betting</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/internet')}
          >
            <Ionicons name="globe-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Internet</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/education')}
          >
            <Ionicons name="school-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Education</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleQuickAction('/transfer')}
          >
            <Ionicons name="send-outline" size={20} color="#ff2b2b" />
            <Text style={styles.actionText}>Transfer</Text>
          </TouchableOpacity>
        </View>
<View style={styles.needHelpContainer}>
          <TouchableOpacity
            style={styles.needHelpButton}
            onPress={() => handleQuickAction('/need-help')}
          >
            <Ionicons name="help-circle-outline" size={20} color="#fff" />
            <Text style={styles.needHelpText}>Need Help</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.transactionsContainer}>
          <Text style={styles.transactionsTitle}>Recent Transactions</Text>
          {transactions.length === 0 ? (
            <Text style={styles.noTransactions}>
              {isLoading ? 'Loading transactions...' : 'No recent transactions'}
            </Text>
          ) : (
            transactions.map((tx, index) => (
              <View key={index} style={styles.transactionItem}>
                <Text style={styles.transactionText}>{tx.type}</Text>
                <Text style={styles.transactionAmount}>
                  ₦{tx.amount.toLocaleString()}
                </Text>
                <Text style={styles.transactionDate}>{tx.date}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Logout Confirmation</Text>
            <Text style={styles.confirmationMessage}>Are you sure you want to logout?</Text>

            <View style={styles.confirmationButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={cancelLogout}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.logoutConfirmButton} 
                onPress={confirmLogout}
              >
                <Text style={styles.logoutConfirmButtonText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ✅ Fund Wallet Modal */}
      <Modal
        visible={showFundWallet}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFundWallet(false)}
      >
        <FundWallet 
          onClose={() => setShowFundWallet(false)}
          onSuccess={handleFundWalletSuccess}
          token={token}
          currentBalance={accountBalance}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  sidebar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: SCREEN_WIDTH * 0.7,
    backgroundColor: '#fff',
    paddingTop: 50,
    paddingHorizontal: 20,
    zIndex: 10,
  },
  profileSection: {
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  profileTouchable: {},
  profileInfoTouchable: {
    flex: 1,
    marginLeft: 12,
  },
  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f8f8f8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ff2b2b',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ff2b2b',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: 12,
    color: '#666',
    marginBottom: 1,
  },
  profilePhone: {
    fontSize: 11,
    color: '#888',
    marginBottom: 2,
  },
  tapToViewProfile: {
    fontSize: 10,
    color: '#ff2b2b',
    fontStyle: 'italic',
  },
  headerProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceTitleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginBottom: 0,
  },
  balanceToggle: {
    padding: 4,
    marginLeft: 8,
  },
  // ✅ NEW: Refresh button style
  refreshButton: {
    padding: 4,
    marginLeft: 8,
  },
  sidebarTitle: {
    color: '#ff2b2b',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  activeSidebarItem: { backgroundColor: '#ff2b2b' },
  sidebarText: { color: '#000', fontSize: 18, marginLeft: 15 },
  activeSidebarText: { color: '#fff', fontWeight: 'bold' },
  sidebarLogoutButton: {
    backgroundColor: '#ff2b2b',
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  sidebarLogoutText: {
    color: '#fff',
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#ff2b2b',
    borderRadius: 0,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    marginLeft: -7,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  balanceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceInfo: {
    flex: 1,
  },
  balanceTitle: { color: '#fff', fontSize: 16, marginBottom: 5, opacity: 0.9 },
  balanceAmount: { color: '#fff', fontSize: 26, fontWeight: 'bold' },
  fundButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#CC000',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  fundButtonText: { color: 'white', marginLeft: 6, fontWeight: '600', fontSize: 14 },
  greeting: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  needHelpContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  needHelpButton: {
    backgroundColor: '#ff2b2b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 5,
    minWidth: 200,
  },
  needHelpText: {
    color: '#fff',
    marginLeft: 10,
    fontWeight: '700',
    fontSize: 16,
  },
  scrollContent: { paddingHorizontal: 20, paddingVertical: 20 },
  servicesHeader: { 
    fontSize: 18, 
    fontWeight: '600', 
    color: '#333', 
    marginBottom: 20, 
    textAlign: 'center' 
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    marginBottom: 30,
  },
  actionButton: {
    backgroundColor: '#fff',
    width: '30%',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  actionText: { color: '#333', marginTop: 8, fontWeight: '500', fontSize: 12, textAlign: 'center' },
  transactionsContainer: { marginTop: 20 },
  transactionsTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 10 },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  transactionText: { fontSize: 16, color: '#555' },
  transactionAmount: { fontSize: 16, fontWeight: '600' },
  transactionDate: { fontSize: 12, color: '#999' },
  noTransactions: { color: '#999', fontStyle: 'italic' },
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmationModal: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 25,
    width: '80%',
    maxWidth: 350,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 15,
  },
  confirmationMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 25,
  },
  confirmationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    marginRight: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  logoutConfirmButton: {
    flex: 1,
    backgroundColor: '#ff2b2b',
    paddingVertical: 12,
    marginLeft: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  logoutConfirmButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});