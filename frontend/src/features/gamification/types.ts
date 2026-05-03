export interface DailyTask {
  key: string;
  label: string;
  description: string;
  coins_reward: number;
  icon: string;
  completed: boolean;
}

export interface Transaction {
  amount: number;
  reason: string;
  description: string;
  created_at: string;
}

export interface GamificationDashboard {
  balance: number;
  total_earned: number;
  login_streak: number;
  seconds_until_reset: number;
  tasks: DailyTask[];
  recent_transactions: Transaction[];
}

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  total_earned: number;
  login_streak: number;
  is_verified_farmer: boolean;
}
