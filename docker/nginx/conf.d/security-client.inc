# En-têtes de sécurité du site client, inclus au niveau du serveur ET dans chaque location qui pose
# son propre add_header (sinon nginx n'hérite plus des en-têtes du serveur pour cette location).
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.kkiapay.me; style-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; connect-src 'self' https://*.kkiapay.me; frame-src https://*.kkiapay.me; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(self)" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
