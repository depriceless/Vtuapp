import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet } from 'react-native';

const PrivacySettingsScreen: React.FC = () => {
  const [isProfilePrivate, setIsProfilePrivate] = useState(false);
  const [isSearchable, setIsSearchable] = useState(true);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Privacy Settings</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Private Profile</Text>
        <Switch
          value={isProfilePrivate}
          onValueChange={setIsProfilePrivate}
          trackColor={{ false: '#ccc', true: '#28a745' }}
          thumbColor="#fff"
        />
      </View>

      <View style={styles.row}>
        <Text style={styles.label}>Allow Search</Text>
        <Switch
          value={isSearchable}
          onValueChange={setIsSearchable}
          trackColor={{ false: '#ccc', true: '#28a745' }}
          thumbColor="#fff"
        />
      </View>
    </View>
  );
};

export default PrivacySettingsScreen;

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginVertical: 10,
  },
  title: { fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
  label: { fontSize: 16, fontWeight: '500' },
});
