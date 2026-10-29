import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ReferralView from '../../../shared/ReferralView';
import '../../../frontend-client/src/styles/profile.css';

/** « Mes filleuls » du camionneur : crédit et demande de versement, règles, code et état de chaque filleul. */
export default function ReferralPage() {
  const navigate = useNavigate();
  return <ReferralView api={api} role="driver" onBack={() => navigate('/profil')} />;
}
