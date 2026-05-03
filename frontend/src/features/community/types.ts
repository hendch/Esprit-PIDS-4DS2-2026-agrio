export interface Post {
  id: string;
  user_id: string;
  user_display_name: string;
  content: string;
  category: string;
  media_url: string | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  liked_by_me: boolean;
  is_mine: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user_display_name: string;
  content: string;
  created_at: string;
  is_mine: boolean;
}

export interface Category {
  key: string;
  label: string;
  label_ar: string;
  emoji: string;
}

export const CATEGORY_MAP: Record<string, { label: string; label_ar: string; emoji: string }> = {
  price_talk:       { label: 'Price Talk',     label_ar: 'نقاش الأسعار',       emoji: '🌾' },
  livestock_advice: { label: 'Livestock',       label_ar: 'نصائح الماشية',      emoji: '🐄' },
  crop_disease:     { label: 'Crop & Disease',  label_ar: 'المحاصيل والأمراض',  emoji: '🌿' },
  irrigation:       { label: 'Irrigation',      label_ar: 'الري',               emoji: '💧' },
  buy_sell:         { label: 'Buy & Sell',      label_ar: 'بيع وشراء',          emoji: '📢' },
  general:          { label: 'General',         label_ar: 'عام',                emoji: '❓' },
};
