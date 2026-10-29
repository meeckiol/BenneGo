import 'package:flutter/material.dart' hide Text;

import '../models/order_status.dart';
import '../theme/bn_theme.dart';
import '../i18n/text.dart';

/// Carte sombre à bords arrondis, cliquable quand [onTap] est fourni.
class BnCard extends StatelessWidget {
  const BnCard({super.key, required this.child, this.padding = const EdgeInsets.all(16), this.onTap, this.color});

  final Widget child;
  final EdgeInsets padding;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final body = Padding(padding: padding, child: child);
    return Container(
      decoration: BoxDecoration(
        color: color ?? BnColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: BnColors.border),
      ),
      child: onTap == null
          ? body
          : Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: onTap,
                child: body,
              ),
            ),
    );
  }
}

/// Pastille colorée : badge, type de commande, indicateur.
class BnPill extends StatelessWidget {
  const BnPill({super.key, required this.label, this.tone = BnTone.neutral, this.icon});

  final String label;
  final BnTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final color = toneColor(tone);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[Icon(icon, size: 14, color: color), const SizedBox(width: 4)],
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

/// Pastille du statut d'une commande, libellé et couleur selon le statut.
class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final info = statusInfo(status);
    return BnPill(label: info.label, tone: info.tone);
  }
}

/// Titre de section, avec un lien d'action optionnel.
class BnSectionHead extends StatelessWidget {
  const BnSectionHead({super.key, required this.title, this.actionLabel, this.onAction});

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(
            title,
            style: const TextStyle(color: BnColors.textStrong, fontSize: 17, fontWeight: FontWeight.w800),
          ),
        ),
        if (actionLabel != null)
          TextButton(
            onPressed: onAction,
            child: Text(
              actionLabel!,
              style: const TextStyle(color: BnColors.brand, fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }
}

/// Indicateur chiffré du tableau de bord.
class BnKpi extends StatelessWidget {
  const BnKpi({super.key, required this.label, required this.value, this.sub, this.icon, this.color = BnColors.brand});

  final String label;
  final String value;
  final String? sub;
  final IconData? icon;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return BnCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (icon != null) ...[Icon(icon, color: color, size: 20), const SizedBox(height: 10)],
          Text(label, style: const TextStyle(color: BnColors.text2, fontSize: 12)),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(color: BnColors.textStrong, fontSize: 18, fontWeight: FontWeight.w800),
          ),
          if (sub != null) Text(sub!, style: const TextStyle(color: BnColors.text3, fontSize: 11)),
        ],
      ),
    );
  }
}

/// Bandeau d'alerte : litige, GPS refusé, information.
class BnBanner extends StatelessWidget {
  const BnBanner({super.key, required this.message, this.tone = BnTone.warning, this.icon = Icons.info_outline});

  final String message;
  final BnTone tone;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final color = toneColor(tone);
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: BnColors.text, fontSize: 13, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

/// État vide, avec une action optionnelle.
class BnEmpty extends StatelessWidget {
  const BnEmpty({super.key, required this.message, this.actionLabel, this.onAction});

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.inbox_outlined, size: 40, color: BnColors.text3),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center, style: const TextStyle(color: BnColors.text2)),
          if (actionLabel != null) ...[
            const SizedBox(height: 16),
            ElevatedButton(onPressed: onAction, child: Text(actionLabel!)),
          ],
        ],
      ),
    );
  }
}

/// Bouton principal plein largeur, avec indicateur pendant une action.
class BnPrimaryButton extends StatelessWidget {
  const BnPrimaryButton({super.key, required this.label, required this.onPressed, this.icon, this.busy = false});

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: busy ? null : onPressed,
      child: busy
          ? const SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white),
            )
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[Icon(icon, size: 18), const SizedBox(width: 8)],
                Text(label),
              ],
            ),
    );
  }
}

/// Avatar circulaire aux initiales.
class BnAvatar extends StatelessWidget {
  const BnAvatar({super.key, required this.initials, this.size = 44});

  final String initials;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: BnColors.brand.withValues(alpha: 0.16),
        shape: BoxShape.circle,
        border: Border.all(color: BnColors.brand.withValues(alpha: 0.4)),
      ),
      child: Text(
        initials,
        style: TextStyle(color: BnColors.brand, fontWeight: FontWeight.w800, fontSize: size * 0.36),
      ),
    );
  }
}
