import React from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import ReferralView from '../../../shared/ReferralView';
import '../styles/profile.css';

/** « Mes filleuls » du client : crédit, règles des primes, code et état de chaque filleul. */
export default function ReferralPage() {
  const navigate = useNavigate();
  return <ReferralView api={api} role="client" onBack={() => navigate('/profil')} />;
}
