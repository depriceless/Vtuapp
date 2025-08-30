import React, { useState, useContext } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthContext } from "../contexts/AuthContext";
import { useRouter } from "expo-router";

export default function ChangePassword() {
  const { token } = useContext(AuthContext);
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(""); // will show error or success
  const [isError, setIsError] = useState(true); // tracks if message is error or success
const handleChangePassword = async () => {
  setMessage("");

  console.log("🔹 Change password triggered");
  console.log("Old password:", oldPassword);
  console.log("New password:", newPassword);
  console.log("Confirm password:", confirmPassword);
  console.log("Token:", token);

  if (newPassword !== confirmPassword) {
    setIsError(true);
    setMessage("Passwords do not match");
    console.warn("⚠ Passwords do not match");
    return;
  }
  if (!token) {
    setIsError(true);
    setMessage("You must be logged in");
    console.warn("⚠ No token found");
    return;
  }

  setLoading(true);
  try {
    console.log("🔹 Sending request to backend...");
    const response = await fetch("http://localhost:5000/api/user/change-password", {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        oldPassword: oldPassword,
        newPassword: newPassword,
      }),
    });

    console.log("🔹 Request sent. Waiting for response...");

    const data = await response.json();
    console.log("🔹 Response received:", data);

    if (response.ok && data.success) {
      setIsError(false);
      setMessage(data.message || "Password updated successfully");
      console.log("✅ Password updated successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setIsError(true);
      setMessage(data.message || "Failed to update password");
      console.error("❌ Backend returned error:", data);
    }
  } catch (error: any) {
    console.error("❌ Network/fetch error:", error);
    setIsError(true);
    setMessage(error.message || "Something went wrong");
  } finally {
    setLoading(false);
    console.log("🔹 Loading state set to false");
  }
};


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back-outline" size={24} color="#ff2b2b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Old Password"
          secureTextEntry
          value={oldPassword}
          onChangeText={setOldPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="New Password"
          secureTextEntry
          value={newPassword}
          onChangeText={setNewPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm Password"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {message ? (
          <Text style={[styles.messageText, { color: isError ? "red" : "green" }]}>{message}</Text>
        ) : null}

        <TouchableOpacity style={styles.saveButton} onPress={handleChangePassword} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Update Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#fff" },
  headerTitle: { fontSize: 20, fontWeight: "bold" },
  form: { padding: 20 },
  input: { borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 12, marginBottom: 15 },
  saveButton: { backgroundColor: "#ff2b2b", padding: 15, borderRadius: 8, alignItems: "center" },
  saveButtonText: { color: "#fff", fontWeight: "600" },
  messageText: { marginBottom: 10, fontWeight: "500" },
});
