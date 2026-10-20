# BenneGo — Suivi d'implémentation des features manquantes

> Dernière mise à jour : 2026-10-19

## État global

| Agent | Périmètre | État |
|-------|-----------|------|
| Backend API | Codes promo, Carrières, Parrainage, PoD, Chat, Récurrentes, Rapport | ✅ Terminé |
| Frontend Client | WhatsApp, Promo, Carrières, Badges, Chat, Récurrente, Parrainage | ✅ Terminé |
| Frontend Admin | Rapport mensuel, Parrainage dashboard, Codes promo, PoD photos | ✅ Terminé |
| Frontend Driver | Upload PoD, Chat, Parrainage, Mode hors-ligne PWA | ✅ Terminé |

## Détail des features

### Backend
- [x] `POST /api/promo/validate` — Codes promo
- [x] `GET/POST /api/careers` — Offres d'emploi & candidatures
- [x] `POST /api/referrals` — Parrainage & code parrain
- [x] `POST /api/orders/:id/pod` — Upload photos preuve de livraison (multer)
- [x] Chat Socket.IO (room `chat_<orderId>` + persistance `order_chat_messages`)
- [x] `POST /api/orders/recurring` — Commandes récurrentes
- [x] `GET /api/admin/report/monthly` — Rapport mensuel PDF (pdfkit) & JSON stats
- [x] Intégration SMS (simulé / webhook sans clé externe requise)

### Frontend Client
- [x] Bouton WhatsApp flottant (HomePage)
- [x] Input code promo dans NewOrderPage
- [x] Page `/careers` — Offres d'emploi (liste + formulaire de candidature)
- [x] Badges de confiance sur HomePage
- [x] Chat in-app dans OrderDetailPage
- [x] Commande récurrente dans NewOrderPage
- [x] Page `/referral` — Programme de parrainage (code + partage WhatsApp + stats)

### Frontend Admin
- [x] Page `/report` — Rapport mensuel PDF
- [x] Page `/referrals` — Dashboard parrainage
- [x] Page `/promos` — Codes promo CRUD
- [x] Vue photos PoD dans détail commande (modal + zoom)

### Frontend Driver
- [x] Upload photos PoD dans ActiveDeliveryPage
- [x] Chat chauffeur dans ActiveDeliveryPage
- [x] Section parrainage dans DriverDashboard
- [x] PWA manifest + service worker (hors-ligne)
