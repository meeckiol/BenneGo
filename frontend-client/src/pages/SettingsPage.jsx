import React from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import SettingsView from '../../../shared/SettingsView';

/** Réglages du client : notifications, confidentialité, sécurité, suppression du compte. */
export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);

  // Compte supprimé : la session est déjà fermée côté serveur, on quitte l'application
  const onDeleted = (result) => {
    logout({ local: true });
    toast.success(`Compte supprimé. Vous pouvez le reprendre jusqu'au ${new Date(result.restore_until).toLocaleDateString('fr-FR')} en vous reconnectant.`, { duration: 8000 });
    navigate('/login', { replace: true });
  };

  return (
    <SettingsView
      api={api}
      role="client"
      phone={user?.phone}
      onPhone={(phone) => updateUser({ phone })}
      onBack={() => navigate('/profil')}
      onDeleted={onDeleted}
    />
  );
}
