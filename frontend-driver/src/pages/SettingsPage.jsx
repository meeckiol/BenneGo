import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { getSocket, destroySocket } from '../services/socket';
import useDriverAuthStore from '../store/authStore';
import SettingsView from '../../../shared/SettingsView';
import { dateLocale } from '../../../shared/i18n/dom';

/** Réglages du camionneur : notifications, confidentialité, sécurité, suppression du compte. */
export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useDriverAuthStore((s) => s.user);
  const updateUser = useDriverAuthStore((s) => s.updateUser);
  const logout = useDriverAuthStore((s) => s.logout);

  // Compte supprimé : la session est déjà fermée côté serveur, on quitte l'application
  const onDeleted = (result) => {
    getSocket()?.emit('driver_unavailable');
    try { localStorage.removeItem('bennego-driver-en-ligne'); } catch { /* stockage indisponible */ }
    destroySocket();
    logout({ local: true });
    toast.success(`Compte supprimé. Vous pouvez le reprendre jusqu'au ${new Date(result.restore_until).toLocaleDateString(dateLocale())} en vous reconnectant.`, { duration: 8000 });
    navigate('/login', { replace: true });
  };

  return (
    <SettingsView
      api={api}
      role="driver"
      phone={user?.phone}
      onPhone={(phone) => updateUser({ phone })}
      onBack={() => navigate('/profil')}
      onDeleted={onDeleted}
    />
  );
}
