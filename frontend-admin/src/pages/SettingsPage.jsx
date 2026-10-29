import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import useAdminStore from '../store/adminStore';
import SettingsView from '../../../shared/SettingsView';

/** Réglages de l'administrateur : alertes de la console (litiges, pannes, versements, messages) et sécurité. */
export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAdminStore((s) => s.user);
  const updateUser = useAdminStore((s) => s.updateUser);
  return (
    <SettingsView
      api={api}
      role="admin"
      phone={user?.phone}
      onPhone={(phone) => updateUser({ phone })}
      onBack={() => navigate('/')}
    />
  );
}
