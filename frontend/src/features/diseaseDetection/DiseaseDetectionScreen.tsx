import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  useWindowDimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Routes } from "../../core/navigation/routes";
import { useDrawerStore } from "../../core/drawer/drawerStore";
import { useTheme } from "../../core/theme/useTheme";
import { useLanguage } from "../../core/language/useLanguage";
import { diagnoseImage, loadModel, DiagnosisResult } from "./diseaseDetectionService";
import { DISEASE_DATA, SCREEN_LABELS } from "./diseaseAdviceData";
import {
  saveScan,
  fetchScanHistory,
  ScanResultDTO,
  requestSegmentation,
  SegmentationResultDTO,
  requestAdvice,
  sendChatMessage,
  ChatTurnDTO,
} from "./diseaseApi";

const OFFSET_WHITE = "#FAFAF8";
const GREEN = "#4CAF50";
const GREEN_LIGHT = "#E8F5E9";

type Severity = "High" | "Medium" | "Low";

type DiagnosisEntry = {
  id: string;
  name: string;
  confidence: number;
  date: string;
  severity: Severity;
  thumbnailUri?: string;
};

function getSeverity(confidence: number, isHealthy: boolean): Severity {
  if (isHealthy) return "Low";
  if (confidence >= 85) return "High";
  if (confidence >= 60) return "Medium";
  return "Low";
}

function severityColor(s: Severity): string {
  if (s === "High") return "#E53935";
  if (s === "Medium") return "#FF9800";
  return "#2196F3";
}

function TabBar({ active }: { active: string }) {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const tabs = [
    { key: "Home", icon: "🏠", route: Routes.Dashboard },
    { key: "Land", icon: "🗺️", route: Routes.Satellite },
    { key: "Crop", icon: "🌱", route: Routes.DiseaseDetection },
    { key: "Water", icon: "💧", route: Routes.Irrigation },
    { key: "Livestock", icon: "🎯", route: Routes.Livestock },
    { key: "Prices", icon: "📈", route: Routes.MarketPrices },
    { key: "Community", icon: "👥", route: Routes.Community },
    { key: "Alerts", icon: "🔔", route: Routes.Alerts },
  ];
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom + 8 }]}>
      {tabs.map((t) => (
        <Pressable key={t.key} onPress={() => nav.navigate(t.route)} style={styles.tabItem}>
          <View style={[styles.tabIconWrap, active === t.key && styles.tabIconWrapActive]}>
            <Text style={styles.tabIcon}>{t.icon}</Text>
          </View>
          <Text style={[styles.tabLabel, active === t.key && styles.tabLabelActive]}>{t.key}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function DiseaseDetectionScreen() {
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const { language, isRTL, toggleLanguage } = useLanguage();
  const labels = SCREEN_LABELS[language];
  const [history, setHistory] = useState<DiagnosisEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [lastResult, setLastResult] = useState<DiagnosisResult | null>(null);
  const [lastImageUri, setLastImageUri] = useState<string | null>(null);
  const [segResult, setSegResult] = useState<SegmentationResultDTO | null>(null);
  const [segLoading, setSegLoading] = useState(false);
  const [segError, setSegError] = useState(false);

  // AI advisor state — backend Groq generates personalized advice + answers follow-ups.
  // Falls back to the static dict if the LLM is unavailable.
  const [scanId, setScanId] = useState<string | null>(null);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiAdviceLoading, setAiAdviceLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatTurnDTO[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatScrollRef = useRef<ScrollView>(null);

  // Preload model on mount
  useEffect(() => {
    loadModel()
      .then(() => setModelReady(true))
      .catch((err) => console.warn("Model load failed:", err));
  }, []);

  // Load scan history from backend on mount
  useEffect(() => {
    fetchScanHistory()
      .then((scans) => {
        const entries: DiagnosisEntry[] = scans.map((s) => ({
          id: s.id,
          name: s.disease_name ?? "Unknown",
          confidence: s.confidence ?? 0,
          date: new Date(s.scanned_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          severity: getSeverity(s.confidence ?? 0, s.is_healthy),
        }));
        setHistory(entries);
      })
      .catch((err) => console.warn("Failed to load scan history:", err));
  }, []);

  const runDiagnosis = async (imageUri: string) => {
    setIsLoading(true);
    setLastImageUri(imageUri);
    setSegResult(null);
    setSegError(false);
    // Reset AI state for the new scan.
    setScanId(null);
    setAiAdvice(null);
    setAiAdviceLoading(false);
    setChatOpen(false);
    setChatHistory([]);
    setChatError(null);
    try {
      const result = await diagnoseImage(imageUri);
      setLastResult(result);

      const severity = getSeverity(result.confidence, result.isHealthy);
      const today = new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      // Look up advice to send to backend
      const info = DISEASE_DATA[result.name];
      const advice = info?.en?.advice ?? "";

      // Save to backend — needed for follow-up chat (chat is keyed by scan_id).
      const savePromise = saveScan({
        disease_name: result.displayName,
        confidence: result.confidence,
        severity,
        plant_name: result.plant,
        is_healthy: result.isHealthy,
        guidance: advice || undefined,
      });

      let savedId = Date.now().toString();
      savePromise
        .then((saved) => {
          savedId = saved.id;
          setScanId(saved.id);
        })
        .catch((err) => console.warn("Failed to save scan to backend:", err));

      const entry: DiagnosisEntry = {
        id: savedId,
        name: result.displayName,
        confidence: result.confidence,
        date: today,
        severity,
        thumbnailUri: imageUri,
      };

      setHistory((prev) => [entry, ...prev]);

      // Request personalized advice from the LLM (non-blocking).
      // The static dict still renders immediately; LLM advice replaces it on arrival.
      setAiAdviceLoading(true);
      requestAdvice({
        disease_name: result.displayName,
        plant_name: result.plant,
        confidence: result.confidence,
        severity,
        is_healthy: result.isHealthy,
        locale: language,
      })
        .then((res) => {
          if (res.source === "llm" && res.advice) setAiAdvice(res.advice);
        })
        .catch((err) => console.warn("AI advice failed, using static fallback:", err))
        .finally(() => setAiAdviceLoading(false));

      // Fire segmentation request to backend (non-blocking for classification)
      setSegLoading(true);
      requestSegmentation(imageUri)
        .then((seg) => setSegResult(seg))
        .catch((err) => {
          console.warn("Segmentation failed:", err);
          setSegError(true);
        })
        .finally(() => setSegLoading(false));
    } catch (err: any) {
      Alert.alert("Diagnosis Failed", err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendChat = async (overrideMessage?: string) => {
    const message = (overrideMessage ?? chatInput).trim();
    if (!message || !scanId || chatLoading) return;
    const next: ChatTurnDTO[] = [...chatHistory, { role: "user", content: message }];
    setChatHistory(next);
    setChatInput("");
    setChatError(null);
    setChatLoading(true);
    try {
      const res = await sendChatMessage(scanId, {
        message,
        history: chatHistory, // history BEFORE this message
        locale: language,
        original_advice: aiAdvice ?? undefined,
      });
      setChatHistory([...next, { role: "assistant", content: res.reply }]);
      // Scroll to bottom after render
      setTimeout(() => chatScrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (err: any) {
      setChatError(labels.chatError);
    } finally {
      setChatLoading(false);
    }
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required to capture images.");
      return false;
    }
    return true;
  };

  const requestMediaLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery access is required to upload images.");
      return false;
    }
    return true;
  };

  const handleCapture = async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: false, // Disabled: Android crop confirmation returns canceled=true (Expo bug)
        quality: 0.8,
      });
      // Safely handle both canceled states and missing assets
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const uri = result.assets[0].uri;
      if (!uri) return;
      await runDiagnosis(uri);
    } catch (e) {
      Alert.alert("Error", "Could not open camera.");
    }
  };

  const handleUpload = async () => {
    const ok = await requestMediaLibraryPermission();
    if (!ok) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false, // Disabled: Android crop confirmation returns canceled=true (Expo bug)
        quality: 0.8,
      });
      // Safely handle both canceled states and missing assets
      if (result.canceled || !result.assets || result.assets.length === 0) return;
      const uri = result.assets[0].uri;
      if (!uri) return;
      await runDiagnosis(uri);
    } catch (e) {
      Alert.alert("Error", "Could not open gallery.");
    }
  };

  const buttonWidth = (width - 24 * 2 - 16) / 2;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.headerBorder }]}>
        <TouchableOpacity onPress={() => useDrawerStore.getState().openDrawer()}>
          <Text style={styles.hamburger}>☰</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.logoIcon}>🌿</Text>
          <Text style={styles.logoText}>Agrio</Text>
        </View>
        <TouchableOpacity onPress={toggleLanguage} style={styles.langToggle}>
          <Text style={styles.langToggleText}>{language === "en" ? "عربي" : "EN"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 24 + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Model Status */}
        {!modelReady && (
          <View style={styles.modelStatusBar}>
            <ActivityIndicator size="small" color={GREEN} />
            <Text style={[styles.modelStatusText, isRTL && styles.rtlText]}>{labels.loadingModel}</Text>
          </View>
        )}

        {/* Capture or Upload */}
        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{labels.captureOrUpload}</Text>
        <View style={styles.captureRow}>
          <Pressable
            style={({ pressed }) => [styles.captureCard, { width: buttonWidth }, pressed && styles.captureCardPressed]}
            onPress={handleCapture}
            disabled={isLoading}
          >
            <Text style={styles.captureIcon}>📷</Text>
            <Text style={styles.captureTitle}>{labels.captureImage}</Text>
            <Text style={styles.captureSub}>{labels.useCamera}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.captureCard, styles.captureCardGreen, { width: buttonWidth }, pressed && styles.captureCardPressed]}
            onPress={handleUpload}
            disabled={isLoading}
          >
            <Text style={styles.captureIcon}>📤</Text>
            <Text style={styles.captureTitle}>{labels.uploadImage}</Text>
            <Text style={styles.captureSub}>{labels.fromGallery}</Text>
          </Pressable>
        </View>

        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.loadingText}>{labels.analyzingLeaf}</Text>
          </View>
        )}

        {/* Latest Result */}
        {lastResult && lastImageUri && !isLoading && (() => {
          const info = DISEASE_DATA[lastResult.name];
          const localized = info?.[language];
          const displayName = localized?.displayName ?? lastResult.displayName;
          const advice = localized?.advice ?? "";
          return (
            <>
              <View style={styles.resultCard}>
                {segResult ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${segResult.annotated_image}` }}
                    style={styles.resultImage}
                  />
                ) : (
                  <Image source={{ uri: lastImageUri }} style={styles.resultImage} />
                )}
                {segLoading && (
                  <View style={styles.segLoadingOverlay}>
                    <ActivityIndicator size="small" color="#FFF" />
                  </View>
                )}
                <View style={styles.resultBody}>
                  <Text style={[styles.resultTitle, isRTL && styles.rtlText]}>{displayName}</Text>
                  <Text style={[styles.resultConfidence, isRTL && styles.rtlText]}>
                    {lastResult.isHealthy ? "✅" : "⚠️"} {lastResult.confidence}% {labels.confidence}
                  </Text>
                  <Text style={[styles.resultPlant, isRTL && styles.rtlText]}>
                    {labels.plant}: {info?.[language]?.displayName.split(" - ")[0] ?? lastResult.plant}
                  </Text>
                  {!lastResult.isHealthy && (
                    <Text style={[styles.resultDisease, isRTL && styles.rtlText]}>
                      {labels.disease}: {info?.[language]?.displayName.split(" - ")[1] ?? lastResult.disease}
                    </Text>
                  )}
                  <View style={styles.top3Container}>
                    <Text style={[styles.top3Title, isRTL && styles.rtlText]}>{labels.topPredictions}</Text>
                    {lastResult.top3.map((item, idx) => {
                      const itemInfo = DISEASE_DATA[item.name];
                      const itemName = itemInfo?.[language]?.displayName ?? item.displayName;
                      return (
                        <Text key={idx} style={[styles.top3Item, isRTL && styles.rtlText]}>
                          {idx + 1}. {itemName} ({item.confidence}%)
                        </Text>
                      );
                    })}
                  </View>
                </View>
              </View>

              {/* Advice Card — shows static fallback immediately, then LLM-enhanced when ready */}
              {(advice || aiAdvice) ? (
                <View style={[styles.adviceCard, lastResult.isHealthy ? styles.adviceCardHealthy : styles.adviceCardDisease]}>
                  <View style={styles.adviceHeader}>
                    <Text style={[styles.adviceTitle, isRTL && styles.rtlText]}>
                      {lastResult.isHealthy ? `🌱 ${labels.healthyAdvice}` : `⚕️ ${labels.treatmentAdvice}`}
                    </Text>
                    {aiAdvice && (
                      <View style={styles.aiBadge}>
                        <Text style={styles.aiBadgeText}>✨ {labels.aiPoweredBadge}</Text>
                      </View>
                    )}
                  </View>
                  {aiAdviceLoading && !aiAdvice && (
                    <View style={styles.aiLoadingRow}>
                      <ActivityIndicator size="small" color={GREEN} />
                      <Text style={[styles.aiLoadingText, isRTL && styles.rtlText]}>
                        {labels.aiEnhancing}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.adviceText, isRTL && styles.rtlText]}>
                    {aiAdvice || advice}
                  </Text>

                  {scanId && !chatOpen && (
                    <Pressable
                      style={({ pressed }) => [styles.askButton, pressed && styles.askButtonPressed]}
                      onPress={() => setChatOpen(true)}
                    >
                      <Text style={styles.askButtonText}>💬 {labels.askFollowUp}</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}

              {/* Chat panel — opens after advice, scoped to current scan */}
              {scanId && chatOpen && (
                <View style={styles.chatCard}>
                  <View style={styles.chatHeader}>
                    <Text style={[styles.chatTitle, isRTL && styles.rtlText]}>
                      🤖 {labels.chatTitle}
                    </Text>
                    <TouchableOpacity onPress={() => setChatOpen(false)}>
                      <Text style={styles.chatClose}>✕</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView
                    ref={chatScrollRef}
                    style={styles.chatMessages}
                    contentContainerStyle={styles.chatMessagesContent}
                  >
                    {chatHistory.length === 0 && (
                      <View style={styles.chatEmptyState}>
                        <Text style={[styles.chatEmptyText, isRTL && styles.rtlText]}>
                          {labels.chatEmpty}
                        </Text>
                        {[labels.chatSuggestion1, labels.chatSuggestion2, labels.chatSuggestion3].map((sugg) => (
                          <Pressable
                            key={sugg}
                            style={({ pressed }) => [styles.chatSuggestion, pressed && { opacity: 0.7 }]}
                            onPress={() => handleSendChat(sugg)}
                            disabled={chatLoading}
                          >
                            <Text style={[styles.chatSuggestionText, isRTL && styles.rtlText]}>
                              {sugg}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    )}

                    {chatHistory.map((turn, idx) => (
                      <View
                        key={idx}
                        style={[
                          styles.chatBubble,
                          turn.role === "user" ? styles.chatBubbleUser : styles.chatBubbleAssistant,
                        ]}
                      >
                        <Text
                          style={[
                            styles.chatBubbleText,
                            turn.role === "user" && styles.chatBubbleTextUser,
                            isRTL && styles.rtlText,
                          ]}
                        >
                          {turn.content}
                        </Text>
                      </View>
                    ))}

                    {chatLoading && (
                      <View style={[styles.chatBubble, styles.chatBubbleAssistant]}>
                        <ActivityIndicator size="small" color={GREEN} />
                      </View>
                    )}

                    {chatError && (
                      <Text style={[styles.chatErrorText, isRTL && styles.rtlText]}>
                        ⚠️ {chatError}
                      </Text>
                    )}
                  </ScrollView>

                  <View style={styles.chatInputRow}>
                    <TextInput
                      style={[styles.chatInput, isRTL && styles.rtlText]}
                      placeholder={labels.chatPlaceholder}
                      placeholderTextColor="#999"
                      value={chatInput}
                      onChangeText={setChatInput}
                      multiline
                      maxLength={2000}
                      editable={!chatLoading}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.chatSendButton,
                        (!chatInput.trim() || chatLoading) && styles.chatSendButtonDisabled,
                        pressed && styles.askButtonPressed,
                      ]}
                      onPress={() => handleSendChat()}
                      disabled={!chatInput.trim() || chatLoading}
                    >
                      <Text style={styles.chatSendText}>↑</Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {segError && !segLoading && (
                <View style={styles.segErrorCard}>
                  <Text style={[styles.segErrorText, isRTL && styles.rtlText]}>
                    {labels.segmentationFailed}
                  </Text>
                </View>
              )}
            </>
          );
        })()}

        {/* Diagnosis History */}
        <Text style={[styles.sectionTitle, isRTL && styles.rtlText]}>{labels.diagnosisHistory}</Text>
        {history.length === 0 && (
          <Text style={[styles.emptyHistory, isRTL && styles.rtlText]}>{labels.noHistory}</Text>
        )}
        {history.slice(0, 3).map((entry) => (
          <View key={entry.id} style={styles.historyCard}>
            <View style={styles.historyThumb}>
              {entry.thumbnailUri ? (
                <Image source={{ uri: entry.thumbnailUri }} style={styles.historyThumbImage} />
              ) : (
                <View style={styles.historyThumbPlaceholder}>
                  <Text style={styles.historyThumbIcon}>🌿</Text>
                </View>
              )}
            </View>
            <View style={styles.historyBody}>
              <Text style={styles.historyName}>{entry.name}</Text>
              <View style={styles.historyMeta}>
                <Text style={styles.historyMetaText}>✓ {entry.confidence}%</Text>
                <Text style={styles.historyMetaText}>🕐 {entry.date}</Text>
              </View>
            </View>
            <View style={[styles.severityTag, { backgroundColor: severityColor(entry.severity) }]}>
              <Text style={styles.severityText}>{entry.severity}</Text>
            </View>
          </View>
        ))}

        {/* Pro Tips */}
        <View style={styles.proTipsCard}>
          <View style={styles.proTipsTitleRow}>
            <Text style={[styles.proTipsTitle, isRTL && styles.rtlText]}>{labels.proTips}</Text>
            <Text style={styles.proTipsInfoIcon}>ℹ️</Text>
          </View>
          <Text style={[styles.proTipsBullet, isRTL && styles.rtlText]}>• {labels.tip1}</Text>
          <Text style={[styles.proTipsBullet, isRTL && styles.rtlText]}>• {labels.tip2}</Text>
          <Text style={[styles.proTipsBullet, isRTL && styles.rtlText]}>• {labels.tip3}</Text>
          <Text style={[styles.proTipsBullet, isRTL && styles.rtlText]}>• {labels.tip4}</Text>
        </View>
      </ScrollView>

      <TabBar active="Crop" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OFFSET_WHITE },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: OFFSET_WHITE,
    borderBottomWidth: 1,
    borderBottomColor: "#EEE",
  },
  hamburger: { fontSize: 22, color: "#2C2C2C" },
  headerCenter: { flexDirection: "row", alignItems: "center" },
  logoIcon: { fontSize: 24, marginRight: 6 },
  logoText: { fontSize: 20, fontWeight: "700", color: GREEN },
  headerRight: { fontSize: 14, color: "#666", fontWeight: "500" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#2C2C2C", marginBottom: 12 },
  modelStatusBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF8E1",
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#FFECB3",
  },
  modelStatusText: { fontSize: 14, color: "#666" },
  captureRow: { flexDirection: "row", gap: 16, marginBottom: 28 },
  captureCard: {
    backgroundColor: "#FFF8E1",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FFECB3",
  },
  captureCardGreen: {
    backgroundColor: GREEN_LIGHT,
    borderColor: "#A5D6A7",
  },
  captureCardPressed: { opacity: 0.9 },
  captureIcon: { fontSize: 40, marginBottom: 12 },
  captureTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", marginBottom: 4 },
  captureSub: { fontSize: 13, color: "#666" },
  loadingCard: {
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 32,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },
  resultCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#A5D6A7",
  },
  resultImage: {
    width: "100%",
    height: 200,
    resizeMode: "cover",
  },
  segLoadingOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    padding: 6,
  },
  resultBody: { padding: 16 },
  resultTitle: { fontSize: 20, fontWeight: "700", color: "#2C2C2C", marginBottom: 8 },
  resultConfidence: { fontSize: 16, color: "#555", marginBottom: 4 },
  resultPlant: { fontSize: 14, color: "#666", marginBottom: 2 },
  resultDisease: { fontSize: 14, color: "#E53935", marginBottom: 8 },
  top3Container: { marginTop: 12, padding: 12, backgroundColor: "#F5F5F5", borderRadius: 8 },
  top3Title: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  top3Item: { fontSize: 13, color: "#666", marginBottom: 3 },
  emptyHistory: { fontSize: 14, color: "#999", fontStyle: "italic", marginBottom: 16 },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EEE",
  },
  historyThumb: { width: 56, height: 56, borderRadius: 12, overflow: "hidden", marginRight: 14 },
  historyThumbImage: { width: "100%", height: "100%" },
  historyThumbPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  historyThumbIcon: { fontSize: 28 },
  historyBody: { flex: 1 },
  historyName: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", marginBottom: 6 },
  historyMeta: { flexDirection: "row", gap: 16 },
  historyMetaText: { fontSize: 13, color: "#555" },
  severityTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  severityText: { fontSize: 12, fontWeight: "600", color: "#FFF" },
  proTipsCard: {
    backgroundColor: "#EFEBE9",
    borderRadius: 16,
    padding: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#D7CCC8",
  },
  proTipsTitleRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  proTipsTitle: { fontSize: 16, fontWeight: "700", color: "#2C2C2C", flex: 1 },
  proTipsInfoIcon: { fontSize: 18 },
  proTipsBullet: { fontSize: 14, color: "#555", marginBottom: 6 },
  tabBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 12,
    paddingHorizontal: 8,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#EEE",
  },
  tabItem: { alignItems: "center", flex: 1 },
  tabIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tabIconWrapActive: { backgroundColor: GREEN_LIGHT },
  tabIcon: { fontSize: 20 },
  tabLabel: { fontSize: 10, color: "#666" },
  tabLabelActive: { color: GREEN, fontWeight: "600" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  langToggle: {
    backgroundColor: GREEN_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  langToggleText: { fontSize: 14, fontWeight: "600", color: GREEN },
  adviceCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  adviceCardHealthy: {
    backgroundColor: "#E8F5E9",
    borderColor: "#A5D6A7",
  },
  adviceCardDisease: {
    backgroundColor: "#FFF3E0",
    borderColor: "#FFCC80",
  },
  adviceTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 10,
  },
  adviceText: {
    fontSize: 15,
    color: "#444",
    lineHeight: 24,
  },
  segCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#90CAF9",
  },
  segBody: { padding: 16 },
  segTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C2C2C",
    marginBottom: 10,
  },
  segRegionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  segRegionName: { fontSize: 14, color: "#444", flex: 1 },
  segRegionConf: { fontSize: 14, fontWeight: "600", color: GREEN },
  segErrorCard: {
    backgroundColor: "#FFF3E0",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FFCC80",
    alignItems: "center",
  },
  segErrorText: { fontSize: 14, color: "#E65100" },

  // AI advice + chat
  adviceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  aiBadge: {
    backgroundColor: GREEN,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  aiBadgeText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  aiLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  aiLoadingText: { fontSize: 12, color: "#666", fontStyle: "italic" },
  askButton: {
    marginTop: 14,
    backgroundColor: GREEN,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  askButtonPressed: { opacity: 0.85 },
  askButtonText: { color: "#FFF", fontSize: 14, fontWeight: "600" },
  chatCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#A5D6A7",
    overflow: "hidden",
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GREEN_LIGHT,
    borderBottomWidth: 1,
    borderBottomColor: "#A5D6A7",
  },
  chatTitle: { fontSize: 15, fontWeight: "700", color: "#2C2C2C" },
  chatClose: { fontSize: 18, color: "#666", paddingHorizontal: 6 },
  chatMessages: { maxHeight: 320 },
  chatMessagesContent: { padding: 12, gap: 8 },
  chatEmptyState: { gap: 8 },
  chatEmptyText: { fontSize: 13, color: "#666", marginBottom: 4 },
  chatSuggestion: {
    backgroundColor: "#F5F5F5",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  chatSuggestionText: { fontSize: 13, color: "#444" },
  chatBubble: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    maxWidth: "85%",
  },
  chatBubbleUser: {
    backgroundColor: GREEN,
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  chatBubbleAssistant: {
    backgroundColor: "#F0F0F0",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
  },
  chatBubbleText: { fontSize: 14, color: "#2C2C2C", lineHeight: 20 },
  chatBubbleTextUser: { color: "#FFF" },
  chatErrorText: {
    fontSize: 13,
    color: "#E53935",
    textAlign: "center",
    marginTop: 6,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    backgroundColor: "#FAFAFA",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: "#2C2C2C",
    maxHeight: 100,
    minHeight: 40,
  },
  chatSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  chatSendButtonDisabled: { backgroundColor: "#BDBDBD" },
  chatSendText: { color: "#FFF", fontSize: 22, fontWeight: "700", lineHeight: 24 },
});