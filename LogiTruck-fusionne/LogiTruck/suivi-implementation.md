# LogiTruck — Suivi d'implémentation des features manquantes

> Dernière mise à jour : 2026-10-17

## État global

| Agent | Périmètre | État |
|-------|-----------|------|
| Backend API | Codes promo, Carrières, Parrainage, PoD, Chat, Récurrentes, Rapport, SMS | 🔄 En cours |
| Frontend Client | WhatsApp, Promo, Carrières, Badges, Chat, Récurrente, Parrainage | 🔄 En cours |
| Frontend Admin | Rapport mensuel, Parrainage dashboard, Codes promo, PoD photos | 🔄 En cours |
| Frontend Driver | Upload PoD, Chat, Parrainage, Mode hors-ligne PWA | 🔄 En cours |

## Détail des features

### Backend
- [ ] `POST /api/promo/validate` — Codes promo
- [ ] `GET/POST /api/careers` — Offres d'emploi  
- [ ] `POST /api/referrals` — Parrainage
- [ ] `POST /api/orders/:id/pod` — Upload photos preuve de livraison
- [ ] Chat Socket.IO (room `chat_<orderId>`)
- [ ] `POST /api/orders/recurring` — Commandes récurrentes
- [ ] `GET /api/admin/report/monthly` — Rapport mensuel PDF
- [ ] Intégration SMS (Twilio ou local)

### Frontend Client
- [ ] Bouton WhatsApp flottant
- [ ] Input code promo dans NewOrderPage
- [ ] Page `/careers` — Offres d'emploi
- [ ] Badges de confiance sur HomePage
- [ ] Chat in-app dans OrderDetailPage
- [ ] Commande récurrente dans NewOrderPage
- [ ] Page `/referral` — Programme de parrainage

### Frontend Admin
- [ ] Page `/report` — Rapport mensuel PDF
- [ ] Page `/referrals` — Dashboard parrainage
- [ ] Page `/promos` — Codes promo CRUD
- [ ] Vue photos PoD dans détail commande

### Frontend Driver
- [ ] Upload photos PoD dans ActiveDeliveryPage
- [ ] Chat chauffeur dans ActiveDeliveryPage
- [ ] Section parrainage dans DriverDashboard
- [ ] PWA manifest + service worker (hors-ligne)
