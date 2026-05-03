export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  region: 'nord' | 'sahel' | 'centre_et_sud' | null;
  years_experience: number | null;
  animal_types: string[] | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified_farmer: boolean;
  is_active: boolean;
}

export const REGIONS = [
  { key: 'nord',          label: 'Nord' },
  { key: 'sahel',         label: 'Sahel' },
  { key: 'centre_et_sud', label: 'Centre & Sud' },
];

export const ANIMAL_TYPE_OPTIONS = [
  { key: 'bovin',     label: 'Bovin',     emoji: '🐄' },
  { key: 'vache',     label: 'Vache',     emoji: '🐄' },
  { key: 'genisse',   label: 'Génisse',   emoji: '🐄' },
  { key: 'ovin',      label: 'Ovin',      emoji: '🐑' },
  { key: 'agneau',    label: 'Agneau',    emoji: '🐑' },
  { key: 'taurillon', label: 'Taurillon', emoji: '🐂' },
  { key: 'caprin',    label: 'Caprin',    emoji: '🐐' },
];
