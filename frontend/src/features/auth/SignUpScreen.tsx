import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../../core/theme/useTheme";
import { Routes } from "../../core/navigation/routes";
import { authApi } from "./services/authApi";
import { getApiErrorMessage, validateEmail, validatePassword } from "./services/authValidation";

export function SignUpScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password) {
      Alert.alert("Missing details", "Please fill all fields.");
      return;
    }
    const emailError = validateEmail(email);
    if (emailError) {
      Alert.alert("Invalid email", emailError);
      return;
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      Alert.alert("Invalid password", passwordError);
      return;
    }

    setLoading(true);
    try {
      await authApi.register({ firstName, lastName, email: email.trim(), password });
      Alert.alert("Success", "Account created. Please sign in.");
      nav.navigate(Routes.Login);
    } catch (error: any) {
      const message = getApiErrorMessage(error, "Sign-up failed. Check your details and try again.");
      Alert.alert("Sign-up failed", message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <View style={styles.logoRow}>
            <Text style={styles.leafIcon}>🌿</Text>
            <Text style={styles.logoText}>Agrio</Text>
          </View>
          <Text style={[styles.welcomeText, { color: colors.text }]}>Create Account</Text>
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>
            Sign up to get started with Agrio
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>First Name</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="First name"
              placeholderTextColor="#999"
              value={firstName}
              onChangeText={setFirstName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Last Name</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Last name"
              placeholderTextColor="#999"
              value={lastName}
              onChangeText={setLastName}
              autoCapitalize="words"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg }]}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="farmer@example.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg }]}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Create a strong password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Text style={styles.eyeIconText}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.signInButton, loading && { opacity: 0.7 }]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={styles.signInButtonText}>{loading ? "Signing Up..." : "Sign Up"}</Text>
        </TouchableOpacity>

        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => nav.navigate(Routes.Login)}>
            <Text style={styles.signUpLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5DC" },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "center",
  },
  logoContainer: { alignItems: "center", marginBottom: 40 },
  logoRow: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  leafIcon: { fontSize: 32, marginRight: 8 },
  logoText: { fontSize: 28, fontWeight: "700", color: "#4CAF50" },
  welcomeText: { fontSize: 32, fontWeight: "800", marginBottom: 8 },
  subtitleText: { fontSize: 16, textAlign: "center" },
  inputContainer: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: { fontSize: 20, marginRight: 12 },
  input: { flex: 1, fontSize: 16, color: "#2C2C2C" },
  eyeIcon: { padding: 4 },
  eyeIconText: { fontSize: 20 },
  signInButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  signInButtonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  signUpContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  signUpText: { fontSize: 14, color: "#2C2C2C" },
  signUpLink: { fontSize: 14, color: "#4CAF50", fontWeight: "600" },
});
