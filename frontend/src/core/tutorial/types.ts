export interface TutorialStep {
  key: string;
  title: string;
  description: string;
  emoji: string;
  screen: string;
  position: 'top' | 'bottom' | 'center';
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    key: 'add_animal',
    title: 'Add Your First Animal',
    description: 'Tap the + Add button to register your first animal. You can track its health, age, and market value.',
    emoji: '🐄',
    screen: 'Livestock',
    position: 'bottom',
  },
  {
    key: 'view_market_value',
    title: 'View Market Value',
    description: 'Tap on any animal to open its detail page. Scroll down to see its current market value, then tap "Got it" to continue.',
    emoji: '💰',
    screen: 'Livestock',
    position: 'bottom',
  },
  {
    key: 'set_price_alert',
    title: 'Set a Price Alert',
    description: "Tap + to create a price alert. You'll be notified when livestock prices cross your threshold.",
    emoji: '🔔',
    screen: 'Alerts',
    position: 'bottom',
  },
  {
    key: 'generate_forecast',
    title: 'Generate a Price Forecast',
    description: 'Select a commodity series — the forecast generates automatically. Tap "Got it" when you have reviewed the 12-month predictions.',
    emoji: '📈',
    screen: 'MarketPrices',
    position: 'bottom',
  },
  {
    key: 'view_recommendation',
    title: 'View Sell Recommendation',
    description: 'Scroll down below the forecast table to see the AI sell recommendation — the best and worst months to sell. Tap "Got it" when you have reviewed it.',
    emoji: '🎯',
    screen: 'MarketPrices',
    position: 'top',
  },
  {
    key: 'view_field',
    title: 'Explore Your Land',
    description: 'Tap on a field to view its details — crop type, area, boundary, and satellite data. Tap "Got it" once you have opened a field.',
    emoji: '🗺️',
    screen: 'Satellite',
    position: 'bottom',
  },
  {
    key: 'scan_crop',
    title: 'Scan a Crop for Disease',
    description: 'Tap the camera or upload a photo of your crop leaves. The AI will detect diseases and give you treatment advice.',
    emoji: '🌿',
    screen: 'DiseaseDetection',
    position: 'bottom',
  },
  {
    key: 'check_water',
    title: 'Check Irrigation Status',
    description: 'Tap "Evaluate Field Now" to let the AI analyse soil moisture, weather and crop needs — then decide whether to irrigate.',
    emoji: '💧',
    screen: 'Irrigation',
    position: 'bottom',
  },
  {
    key: 'join_community',
    title: 'Join the Community',
    description: 'Tap + to share advice, ask questions, or discuss prices with other farmers.',
    emoji: '🌱',
    screen: 'Community',
    position: 'bottom',
  },
];

export interface TutorialProgress {
  is_completed: boolean;
  completed_steps: string[];
  skipped_at: string | null;
  completed_at: string | null;
  next_step: string | null;
}
