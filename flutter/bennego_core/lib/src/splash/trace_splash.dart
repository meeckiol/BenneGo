import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import 'emblem_paths.dart';

/// Splash animé par tracé (même chronologie que le splash web du camionneur) : sur fond sombre quadrillé,
/// le contour de l'emblème se dessine en traits fins avec ses points d'ancrage, se remplit de sable doré,
/// remonte pour laisser apparaître le nom, puis plonge vers l'écran. Un appui le passe.
class TraceSplash extends StatefulWidget {
  const TraceSplash({super.key, required this.onDone, this.tag = 'Driver'});

  final VoidCallback onDone;

  /// Étiquette sous « BenneGo », par exemple « Driver ».
  final String tag;

  @override
  State<TraceSplash> createState() => _TraceSplashState();
}

/// Durée totale, en millisecondes.
const _total = 4400.0;

/// Début et durée du tracé de chaque partie (benne, montant, B, creux du B, anse), en ms.
const _trace = [(350.0, 1150.0), (650.0, 600.0), (800.0, 1250.0), (1350.0, 550.0), (1550.0, 450.0)];

class _TraceSplashState extends State<TraceSplash> with SingleTickerProviderStateMixin {
  late final AnimationController _clock = AnimationController(vsync: this, duration: const Duration(milliseconds: 4400))
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed) widget.onDone();
    });

  @override
  void initState() {
    super.initState();
    _clock.forward();
  }

  @override
  void dispose() {
    _clock.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Material transparent : styles de texte corrects même au-dessus du navigateur de l'application
    return Material(
      type: MaterialType.transparency,
      child: Semantics(
        label: 'BenneGo ${widget.tag}, chargement',
        button: true,
        child: GestureDetector(
          onTap: widget.onDone,
          child: AnimatedBuilder(
            animation: _clock,
            builder: (context, _) {
              final t = _clock.value * _total;
              final out = 1 - _ease(_span(t, 3800, 600));
              final rise = _easeOutBack(_span(t, 2750, 600));
              final dive = _easeIn(_span(t, 3800, 600));
              final scale = (1 - 0.18 * rise) * (1 + 6 * dive);
              final word = _ease(_span(t, 2950, 500));
              return Opacity(
                opacity: out,
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment(0, -0.1),
                      radius: 1.1,
                      colors: [Color(0xFF15161D), Color(0xFF0B0B10)],
                    ),
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      CustomPaint(painter: _GridPainter(opacity: _gridOpacity(t))),
                      Center(
                        child: FractionallySizedBox(
                          widthFactor: 0.78,
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 340),
                            child: Transform.translate(
                              offset: Offset(0, -26 * rise),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Transform.scale(
                                    scale: scale,
                                    child: Opacity(
                                      opacity: 1 - dive,
                                      child: AspectRatio(
                                        aspectRatio: emblemWidth / emblemHeight,
                                        child: CustomPaint(painter: _EmblemPainter(t)),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  Opacity(
                                    opacity: word * (1 - dive),
                                    child: Transform.translate(
                                      offset: Offset(0, 14 * (1 - word)),
                                      child: _Word(tag: widget.tag),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

class _Word extends StatelessWidget {
  const _Word({required this.tag});

  final String tag;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const Text(
          'BenneGo',
          style: TextStyle(
            color: Colors.white,
            fontSize: 34,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.6,
            decoration: TextDecoration.none,
          ),
        ),
        const SizedBox(height: 2),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(999),
            gradient: const LinearGradient(colors: [Color(0xFFE8C38A), Color(0xFFD9A55B)]),
          ),
          child: Text(
            tag.toUpperCase(),
            style: const TextStyle(
              color: Color(0xFF0B0B10),
              fontSize: 12,
              fontWeight: FontWeight.w800,
              letterSpacing: 2,
              decoration: TextDecoration.none,
            ),
          ),
        ),
      ],
    );
  }
}

/// Quadrillage discret, qui s'efface au moment du remplissage.
class _GridPainter extends CustomPainter {
  _GridPainter({required this.opacity});

  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    if (opacity <= 0) return;
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.045 * opacity)
      ..strokeWidth = 1;
    const step = 28.0;
    for (var x = (size.width / 2) % step; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (var y = (size.height / 2) % step; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(_GridPainter old) => old.opacity != opacity;
}

// Contours lus une seule fois
final List<ui.Path> _paths = [for (final part in emblemParts) _parseSvgPath(part.d)];
final ui.Path _whole = () {
  final path = ui.Path()..fillType = ui.PathFillType.evenOdd;
  for (final p in _paths) {
    path.addPath(p, Offset.zero);
  }
  return path;
}();

class _EmblemPainter extends CustomPainter {
  _EmblemPainter(this.t);

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / emblemWidth);

    // Lignes de construction pointillées
    final guides = _guidesOpacity(t);
    if (guides > 0) {
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1
        ..color = const Color(0xFFE8C38A).withValues(alpha: 0.18 * guides);
      _dashed(
        canvas,
        ui.Path()
          ..moveTo(0, 225)
          ..lineTo(720, 225),
        paint,
      );
      _dashed(
        canvas,
        ui.Path()
          ..moveTo(360, 0)
          ..lineTo(360, 450),
        paint,
      );
      _dashed(canvas, ui.Path()..addOval(Rect.fromCircle(center: const Offset(430, 290), radius: 150)), paint);
    }

    // Remplissage sable doré, de gauche à droite
    final wipe = _easeInOut(_span(t, 2050, 650));
    if (wipe > 0) {
      canvas.save();
      canvas.clipRect(Rect.fromLTWH(-40, -40, 800 * wipe, 530));
      canvas.drawPath(
        _whole,
        Paint()
          ..shader = const LinearGradient(
            colors: [Color(0xFFF1DAB0), Color(0xFFE8C38A), Color(0xFFD9A55B)],
            stops: [0, 0.45, 1],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ).createShader(const Rect.fromLTWH(0, 0, emblemWidth, emblemHeight)),
      );
      canvas.restore();
    }

    // Traits blancs qui se dessinent
    final strokeFade = 1 - _span(t, 2450, 350);
    if (strokeFade > 0) {
      final glow = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5
        ..color = Colors.white.withValues(alpha: 0.18 * strokeFade)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3);
      final line = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2
        ..strokeJoin = StrokeJoin.round
        ..color = Colors.white.withValues(alpha: strokeFade);
      for (var i = 0; i < _paths.length; i++) {
        final (delay, dur) = _trace[i];
        final drawn = _easeInOut(_span(t, delay, dur));
        if (drawn <= 0) continue;
        for (final metric in _paths[i].computeMetrics()) {
          final part = metric.extractPath(0, metric.length * drawn);
          canvas.drawPath(part, glow);
          canvas.drawPath(part, line);
        }
      }
    }

    // Points d'ancrage : chacun apparaît quand le trait l'atteint
    final nodeFade = 1 - _span(t, 2300, 300);
    if (nodeFade > 0) {
      final fill = Paint()..color = const Color(0xFF0B0B10);
      final edge = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.6
        ..color = const Color(0xFFE8C38A).withValues(alpha: nodeFade);
      for (var i = 0; i < emblemParts.length; i++) {
        final (delay, dur) = _trace[i];
        for (final node in emblemParts[i].nodes) {
          final pop = _span(t, delay + _reached(node[2]) * dur, 260);
          if (pop <= 0) continue;
          final half = 4 * (0.2 + 0.8 * pop);
          final rect = Rect.fromCenter(center: Offset(node[0], node[1]), width: half * 2, height: half * 2);
          canvas.drawRect(rect, fill..color = const Color(0xFF0B0B10).withValues(alpha: nodeFade));
          canvas.drawRect(rect, edge);
        }
      }
    }

    // Étincelle de départ
    final spark = _span(t, 100, 700);
    if (spark > 0 && spark < 1) {
      final first = emblemParts.first.nodes.first;
      final grow = spark < 0.4 ? spark / 0.4 : 1 - (spark - 0.4) / 0.6;
      canvas.drawCircle(
        Offset(first[0], first[1]),
        6 * (0.4 + grow),
        Paint()
          ..color = Colors.white.withValues(alpha: grow.clamp(0, 1))
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
      );
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_EmblemPainter old) => old.t != t;
}

void _dashed(Canvas canvas, ui.Path path, Paint paint) {
  for (final metric in path.computeMetrics()) {
    for (var d = 0.0; d < metric.length; d += 10) {
      canvas.drawPath(metric.extractPath(d, math.min(d + 4, metric.length)), paint);
    }
  }
}

/// Avancement 0 → 1 d'une étape qui commence à [start] et dure [dur] millisecondes.
double _span(double t, double start, double dur) => ((t - start) / dur).clamp(0.0, 1.0);

double _ease(double x) => Curves.easeOut.transform(x);
double _easeIn(double x) => Curves.easeInCubic.transform(x);
double _easeInOut(double x) => Curves.easeInOutCubic.transform(x);
double _easeOutBack(double x) => Curves.easeOutCubic.transform(x);

/// Instant (0 → 1) où un tracé accéléré en douceur atteint la position [f] du contour.
double _reached(double f) => f < 0.5 ? math.pow(f / 4, 1 / 3).toDouble() : 1 - math.pow(2 * (1 - f), 1 / 3) / 2;

double _gridOpacity(double t) {
  if (t < 520) return t / 520;
  if (t < 1820) return 1;
  return 1 - 0.65 * _span(t, 1820, 780);
}

double _guidesOpacity(double t) {
  if (t < 625) return t / 625;
  if (t < 2000) return 1;
  return 1 - _span(t, 2000, 500);
}

/// Lit un contour SVG absolu (M, L, C, Z), tel que produit par la vectorisation de l'emblème.
ui.Path _parseSvgPath(String d) {
  final path = ui.Path();
  final tokens = RegExp(r'[MLCZ]|-?\d*\.?\d+').allMatches(d).map((m) => m.group(0)!).toList();
  var i = 0;
  String command = 'M';
  double next() => double.parse(tokens[i++]);
  while (i < tokens.length) {
    final token = tokens[i];
    if (RegExp(r'^[MLCZ]$').hasMatch(token)) {
      command = token;
      i++;
      if (command == 'Z') {
        path.close();
        continue;
      }
    }
    switch (command) {
      case 'M':
        path.moveTo(next(), next());
        command = 'L';
      case 'L':
        path.lineTo(next(), next());
      case 'C':
        path.cubicTo(next(), next(), next(), next(), next(), next());
    }
  }
  return path;
}
