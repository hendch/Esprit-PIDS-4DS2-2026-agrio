import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useUserStore } from "../../core/userStore/userStore";
import { useTheme } from "../../core/theme/useTheme";
import { authApi } from "./services/authApi";
import { registerPushToken } from "../../core/notifications/notificationService";
import { Routes } from "../../core/navigation/routes";
import { getApiErrorMessage, validateEmail, validatePassword } from "./services/authValidation";

export function LoginScreen() {
  const nav = useNavigation<any>();
  const { colors } = useTheme();
  const setAuth = useUserStore((s) => s.setAuth);
  const setTokens = useUserStore((s) => s.setTokens);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
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
      const result = await authApi.login(email.trim(), password);

      setTokens({
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
      });

      const me = await authApi.me();

      setAuth({
        id: me.id,
        displayName: "User",
        email: email.trim(),
        accessToken: result.access_token,
        refreshToken: result.refresh_token,
      });
      // Fire-and-forget — don't block navigation on permission prompt timing
      registerPushToken().catch(() => {});
      setTimeout(() => {
        nav.navigate(Routes.Dashboard);
      }, 0);
    } catch (error: any) {
      const message = getApiErrorMessage(error, "Sign-in failed. Please try again.");
      Alert.alert("Sign-in failed", message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    Alert.alert("Coming soon", "Google sign-in is not enabled yet.");
  };

  return (
    <KeyboardAvoidingView
      behavior="height"
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo and Branding */}
        <View style={styles.logoContainer}>
          <View style={styles.logoRow}>
            <Text style={styles.leafIcon}>🌿</Text>
            <Text style={styles.logoText}>Agrio</Text>
          </View>
          <Text style={[styles.welcomeText, { color: colors.text }]}>Welcome Back</Text>
          <Text style={[styles.subtitleText, { color: colors.textSecondary }]}>Sign in to continue to Agrio</Text>
        </View>

        {/* Email Input */}
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
              autoCorrect={false}
            />
          </View>
        </View>

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <View style={styles.passwordLabelRow}>
            <Text style={[styles.label, { color: colors.text }]}>Password</Text>
            <TouchableOpacity onPress={() => { }}>
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg }]}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter your password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
            >
              <Text style={styles.eyeIconText}>{showPassword ? "👁️" : "👁️‍🗨️"}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign In Button */}
        <TouchableOpacity
          style={[styles.signInButton, loading && { opacity: 0.7 }]}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text style={styles.signInButtonText}>{loading ? "Signing In..." : "Sign In"}</Text>
        </TouchableOpacity>

        {/* OR CONTINUE WITH Separator */}
        <View style={styles.separatorContainer}>
          <View style={styles.separatorLine} />
          <Text style={styles.separatorText}>OR CONTINUE WITH</Text>
          <View style={styles.separatorLine} />
        </View>

        {/* Continue with Google Button */}
        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={styles.googleButtonText}>Continue with Google</Text>
        </TouchableOpacity>

        {/* Sign Up Link */}
        <View style={styles.signUpContainer}>
          <Text style={styles.signUpText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => nav.navigate(Routes.SignUp)}>
            <Text style={styles.signUpLink}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5DC",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  leafIcon: {
    fontSize: 32,
    marginRight: 8,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "700",
    color: "#4CAF50",
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: "800",
    color: "#2C2C2C",
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C2C2C",
    marginBottom: 8,
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
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
  inputIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#2C2C2C",
  },
  eyeIcon: {
    padding: 4,
  },
  eyeIconText: {
    fontSize: 20,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "500",
  },
  signInButton: {
    backgroundColor: "#4CAF50",
    borderRadius: 12,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  separatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  separatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0",
  },
  separatorText: {
    marginHorizontal: 16,
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    height: 56,
    marginBottom: 32,
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: "700",
    marginRight: 12,
    color: "#4285F4",
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2C2C2C",
  },
  signUpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  signUpText: {
    fontSize: 14,
    color: "#2C2C2C",
  },
  signUpLink: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
});
