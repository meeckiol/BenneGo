import { create } from 'zustand';

/*
 * Réglages du compte chargés une fois après la connexion, pour que les alertes dans l'application
 * (bandeau, son, vibration) respectent les mêmes choix que les notifications push du serveur.
 */
export const useAccountSettings = create((set) => ({
  settings: null,
  load: (api) => api.get('/account/settings').then(({ data }) => set({ settings: data.settings })).catch(() => {}),
  setSettings: (settings) => set({ settings }),
}));

const minutesOf = (hhmm = '00:00') => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Heures calmes, à l'heure du téléphone (au Bénin, la même que celle du serveur). */
export const inQuietHours = (settings, now = new Date()) => {
  const q = settings?.notifications?.quiet_hours;
  if (!q?.enabled) return false;
  const local = now.getHours() * 60 + now.getMinutes();
  const start = minutesOf(q.start);
  const end = minutesOf(q.end);
  if (start === end) return false;
  return start < end ? local >= start && local < end : local >= start || local < end;
};

/**
 * Ce que l'application peut faire pour une alerte de ce type : rien (`show` faux), un bandeau sans son,
 * ou bandeau + son + vibration. Une alerte urgente (course en cours) sonne même aux heures calmes.
 */
export const alertPolicy = (category, { urgent = false } = {}) => {
  const settings = useAccountSettings.getState().settings;
  const n = settings?.notifications;
  if (!n) return { show: true, sound: true, vibrate: true };
  const show = n[category] !== false;
  const sound = show && n.sound && (urgent || !inQuietHours(settings));
  return { show, sound, vibrate: sound && n.vibration };
};
