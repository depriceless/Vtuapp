import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function Transfer() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Transfer</Text>
      <Text>Page under construction</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10 },
});
