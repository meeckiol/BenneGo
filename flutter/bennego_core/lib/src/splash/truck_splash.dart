import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart' hide Text;
import '../i18n/text.dart';
import '../i18n/lang.dart';

/// Splash du client (même scène que le web, `shared/SplashScreen.jsx`) : vue de dessus, le camion-benne suit
/// la route en ralentissant dans les virages, recule dans le chantier, lève sa benne et vide le sable,
/// puis « BenneGo » apparaît et l'écran s'efface. Un appui le passe.
class TruckSplash extends StatefulWidget {
  const TruckSplash({super.key, required this.onDone});

  final VoidCallback onDone;

  @override
  State<TruckSplash> createState() => _TruckSplashState();
}

/// Chronologie en secondes depuis l'ouverture (identique au web).
abstract final class _T {
  static const roads = (0.0, 0.5);
  static const drive = (0.3, 2.9);
  static const word = (0.9, 1.4);
  static const reverse = (3.05, 4.05);
  static const tipUp = (4.15, 4.6);
  static const sand = (4.35, 5.25);
  static const tipDown = (5.25, 5.65);
  static const fade = (5.75, 6.15);
}

const _durationMs = 6150;
const _tipMax = 48 * math.pi / 180;
const _truckScale = 1.45;
const _bedX = -30.0;
const _bedLength = 42.0;
const _frontAxle = 20.0;
const _tireY = 12.5;

const _blocks = [
  Rect.fromLTWH(16, 482, 88, 60), Rect.fromLTWH(16, 250, 86, 130), Rect.fromLTWH(16, 60, 120, 80),
  Rect.fromLTWH(204, 60, 132, 78), Rect.fromLTWH(204, 334, 132, 80), Rect.fromLTWH(204, 482, 132, 60),
];
const _trees = [Offset(120, 486), Offset(60, 222), Offset(312, 232), Offset(176, 470), Offset(326, 160)];
const _cones = [Offset(214, 300), Offset(326, 256), Offset(326, 300)];
const _grainColors = [Color(0xFFD9A55B), Color(0xFFC9893C), Color(0xFFECC27F), Color(0xFFB87A32)];

class _Grain {
  const _Grain(this.release, this.y0, this.reach, this.spread, this.color);

  final double release;
  final double y0;
  final double reach;
  final double spread;
  final Color color;
}

final _grains = [
  for (var i = 0; i < 40; i++)
    _Grain(i / 40, -8.0 + (i * 7) % 17, 6.0 + (i * 11) % 17, 1.2 + ((i * 5) % 7) * 0.08, _grainColors[i % 4]),
];

// Route suivie par le camion, marche arrière dans le chantier, et route dessinée
final ui.Path _route = ui.Path()
  ..moveTo(-50, 430)
  ..lineTo(110, 430)
  ..quadraticBezierTo(150, 430, 150, 390)
  ..lineTo(150, 230)
  ..quadraticBezierTo(150, 190, 190, 190)
  ..lineTo(316, 190);
final ui.Path _backRoute = ui.Path()
  ..moveTo(316, 190)
  ..quadraticBezierTo(243, 190, 243, 210);
final ui.Path _road = ui.Path()
  ..moveTo(-80, 430)
  ..lineTo(110, 430)
  ..quadraticBezierTo(150, 430, 150, 390)
  ..lineTo(150, 230)
  ..quadraticBezierTo(150, 190, 190, 190)
  ..lineTo(440, 190);

double _clamp(double v, [double a = 0, double b = 1]) => v < a ? a : (v > b ? b : v);
double _progress((double, double) span, double t) => _clamp((t - span.$1) / (span.$2 - span.$1));
double _easeInOut(double u) => u < 0.5 ? 4 * u * u * u : 1 - math.pow(-2 * u + 2, 3) / 2;
double _wrap(double a) => math.atan2(math.sin(a), math.cos(a));

/// Trajet échantillonné avec un profil de vitesse réaliste : plus lent dans les virages, freinage à l'arrivée.
class _Profile {
  _Profile(ui.Path path, {bool fromRest = false}) {
    final metric = path.computeMetrics().first;
    length = metric.length;
    n = length.ceil();
    for (var i = 0; i <= n; i++) {
      pts.add(metric.getTangentForOffset(math.min(length, i.toDouble()))!.position);
    }
    for (var i = 0; i <= n; i++) {
      final a = pts[math.max(0, i - 1)];
      final b = pts[math.min(n, i + 1)];
      head.add(math.atan2(b.dy - a.dy, b.dx - a.dx));
    }
    final curve = [for (var i = 0; i <= n; i++) _wrap(head[math.min(n, i + 1)] - head[i]).abs()];
    final time = <double>[0];
    for (var i = 1; i <= n; i++) {
      var bend = 0.0;
      for (var k = math.max(0, i - 16); k <= math.min(n, i + 16); k++) {
        bend = math.max(bend, curve[k]);
      }
      final braking = math.sqrt(math.max(0, length - i) / 80);
      final launch = fromRest ? math.sqrt(math.min(1, (i + 4) / 40)) : 1.0;
      final speed = math.max(0.04, (launch * math.min(1, braking)) / (1 + 16 * bend));
      time.add(time[i - 1] + 1 / speed);
    }
    final total = time[n];
    times = [for (final v in time) v / total];
  }

  late final double length;
  late final int n;
  final List<Offset> pts = [];
  final List<double> head = [];
  late final List<double> times;

  double distanceAt(double u) {
    var lo = 0;
    var hi = n;
    while (hi - lo > 1) {
      final mid = (lo + hi) >> 1;
      if (times[mid] <= u) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    final span = (times[hi] - times[lo]) == 0 ? 1 : times[hi] - times[lo];
    return lo + (u - times[lo]) / span;
  }

  (Offset, double) pointAt(double s) {
    final i = s.round().clamp(0, n);
    return (pts[i], head[i]);
  }
}

final _forward = _Profile(_route);
final _back = _Profile(_backRoute, fromRest: true);

class _TruckSplashState extends State<TruckSplash> with SingleTickerProviderStateMixin {
  late final AnimationController _clock = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: _durationMs),
  )..addStatusListener((status) {
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
    return Material(
      type: MaterialType.transparency,
      child: Semantics(
        label: tr('BenneGo, chargement'),
        button: true,
        child: GestureDetector(
          onTap: widget.onDone,
          child: AnimatedBuilder(
            animation: _clock,
            builder: (context, _) {
              final t = _clock.value * _durationMs / 1000;
              final word = _progress(_T.word, t);
              return Opacity(
                opacity: 1 - _progress(_T.fade, t),
                child: ColoredBox(
                  color: Colors.white,
                  child: Column(
                    children: [
                      Expanded(child: CustomPaint(size: Size.infinite, painter: _ScenePainter(t))),
                      Padding(
                        padding: EdgeInsets.only(bottom: MediaQuery.sizeOf(context).height * 0.12),
                        child: Opacity(
                          opacity: word,
                          child: Transform.translate(
                            offset: Offset(0, (1 - word) * 12),
                            child: Text.rich(
                              TextSpan(children: [
                                TextSpan(text: tr('Benne'), style: TextStyle(color: Color(0xFF111827))),
                                TextSpan(text: tr('Go'), style: TextStyle(color: Color(0xFFD9A55B))),
                              ]),
                              style: TextStyle(fontSize: 34, fontWeight: FontWeight.w800, letterSpacing: -0.7),
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

class _ScenePainter extends CustomPainter {
  _ScenePainter(this.t);

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    // Repère 360 × 560 centré, comme le viewBox SVG (« meet »)
    final scale = math.min(size.width / 360, size.height / 560);
    canvas.save();
    canvas.translate((size.width - 360 * scale) / 2, (size.height - 560 * scale) / 2);
    canvas.scale(scale);

    _paintRoads(canvas, _progress(_T.roads, t));
    _paintDust(canvas);

    // En avant sur la route, puis en marche arrière dans le chantier (cap inverse du déplacement)
    final reversing = t >= _T.reverse.$1;
    final path = reversing ? _back : _forward;
    final s = path.distanceAt(_progress(reversing ? _T.reverse : _T.drive, t));
    final (pos, heading) = path.pointAt(s);
    final h = reversing ? heading + math.pi : heading;
    final turn = _clamp(_wrap(path.pointAt(s + 14).$2 - heading) * 1.4, -0.55, 0.55);
    final steer = reversing ? -turn : turn;
    final rolled = reversing ? _forward.length - s : s;

    canvas.save();
    canvas.translate(pos.dx, pos.dy);
    canvas.rotate(h);
    canvas.scale(_truckScale);
    _paintTruck(canvas, steer: steer, rolled: rolled);
    canvas.restore();
    canvas.restore();
  }

  void _paintRoads(Canvas canvas, double opacity) {
    if (opacity <= 0) return;
    Paint fill(Color c) => Paint()..color = c.withValues(alpha: c.a * opacity);
    for (final r in _blocks) {
      canvas.drawRRect(RRect.fromRectAndRadius(r, const Radius.circular(10)), fill(const Color(0xFFF5F1EB)));
    }
    for (final c in _trees) {
      canvas.drawCircle(c, 7, fill(const Color(0xFFE3ECDC)));
    }
    // Chantier où le sable est déchargé, avec son entrée depuis la route
    final site = RRect.fromRectAndRadius(const Rect.fromLTWH(204, 246, 132, 66), const Radius.circular(10));
    canvas.drawRRect(site, fill(const Color(0xFFF1E6D0)));
    _dashed(
      canvas,
      ui.Path()..addRRect(site),
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5
        ..color = const Color(0xFFF0A35C).withValues(alpha: opacity),
      6,
      5,
    );
    canvas.drawRect(const Rect.fromLTWH(222, 214, 42, 36), fill(const Color(0xFFE8E2D9)));
    for (final c in _cones) {
      canvas.drawPath(
        ui.Path()
          ..moveTo(c.dx - 4, c.dy + 4)
          ..lineTo(c.dx, c.dy - 5)
          ..lineTo(c.dx + 4, c.dy + 4)
          ..close(),
        fill(const Color(0xFFD9A55B)),
      );
    }
    canvas.drawPath(
      _road,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 64
        ..color = const Color(0xFFE8E2D9).withValues(alpha: opacity),
    );
    _dashed(
      canvas,
      _road,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..color = Colors.white.withValues(alpha: opacity),
      14,
      12,
    );
  }

  // Poussière soulevée par les roues arrière
  void _paintDust(Canvas canvas) {
    final paint = Paint();
    var k = 0;
    for (var s = 30.0; s < _forward.length - 30 && k < 32; s += 16, k++) {
      final start = _T.drive.$1 + _forward.times[s.round()] * (_T.drive.$2 - _T.drive.$1);
      final age = (t - start) / 0.6;
      if (age < 0 || age > 1) continue;
      final (at, h) = _forward.pointAt(s - 40);
      final side = k.isOdd ? 1 : -1;
      canvas.drawCircle(
        Offset(at.dx - math.sin(h) * 13 * side, at.dy + math.cos(h) * 13 * side),
        2 + age * 7,
        paint..color = const Color(0xFFC8BFB2).withValues(alpha: 0.28 * (1 - age)),
      );
    }
  }

  void _paintTruck(Canvas canvas, {required double steer, required double rolled}) {
    // Ombre au sol
    canvas.drawRRect(
      RRect.fromRectAndRadius(const Rect.fromLTWH(-25.5, -7, 60, 24), const Radius.circular(4)),
      Paint()..color = const Color(0xFF111827).withValues(alpha: 0.13),
    );

    // Tas de sable déversé derrière la benne
    final pile = _easeInOut(_clamp((t - _T.sand.$1 - 0.15) / (_T.sand.$2 - _T.sand.$1)));
    if (pile > 0) {
      canvas.save();
      canvas.translate(-44, 0);
      canvas.scale(pile);
      canvas.drawOval(Rect.fromCenter(center: Offset.zero, width: 30, height: 25), Paint()..color = const Color(0xFFC9893C));
      canvas.drawOval(Rect.fromCenter(center: const Offset(-1.5, -1.5), width: 22, height: 18), Paint()..color = const Color(0xFFD9A55B));
      canvas.drawOval(Rect.fromCenter(center: const Offset(-3, -3), width: 11, height: 9), Paint()..color = const Color(0xFFECC27F));
      canvas.restore();
    }

    // Pneus : les rayures défilent quand le camion roule
    final offset = rolled % 3.2;
    for (final ax in const [-21.0, -11.0]) {
      for (final ty in const [-_tireY, _tireY]) {
        _tire(canvas, ax, ty, offset);
      }
    }
    for (final ty in const [-_tireY, _tireY]) {
      canvas.save();
      canvas.translate(_frontAxle, ty);
      canvas.rotate(steer);
      canvas.translate(-_frontAxle, -ty);
      _tire(canvas, _frontAxle, ty, offset);
      canvas.restore();
    }

    // Châssis et vérin, visibles quand la benne se lève
    final chassis = Paint()..color = const Color(0xFF374151);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(-29, -6.5, 44, 3), const Radius.circular(1)), chassis);
    canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(-29, 3.5, 44, 3), const Radius.circular(1)), chassis);
    final tilt = _tipMax * (_easeInOut(_progress(_T.tipUp, t)) - _easeInOut(_progress(_T.tipDown, t)));
    canvas.drawLine(
      const Offset(12, 0),
      Offset(_bedX + _bedLength * math.cos(tilt), 0),
      Paint()
        ..color = const Color(0xFF9CA3AF)
        ..strokeWidth = 3.2
        ..strokeCap = StrokeCap.round,
    );

    // Benne : pivote sur son arête arrière (raccourcie vue de dessus)
    final unload = _easeInOut(_progress(_T.sand, t));
    canvas.save();
    canvas.translate(_bedX, 0);
    canvas.scale(math.cos(tilt), 1 + 0.08 * math.sin(tilt));
    canvas.translate(-_bedX, 0);
    final bed = RRect.fromRectAndRadius(const Rect.fromLTWH(_bedX, -11, _bedLength, 22), const Radius.circular(2));
    canvas.drawRRect(bed, Paint()..color = const Color(0xFFD9A55B));
    canvas.drawRRect(
      bed,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.2
        ..color = const Color(0xFFA8743A),
    );
    if (unload < 1) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(Rect.fromLTWH(-27, -8.5, 37 * (1 - unload), 17), const Radius.circular(2)),
        Paint()..color = const Color(0xFFB87A32),
      );
    }
    final ridge = Paint()
      ..strokeWidth = 0.6
      ..color = const Color(0xFFC9893C).withValues(alpha: 0.5);
    for (final y in const [-4.0, 0.0, 4.0]) {
      canvas.drawLine(Offset(-27, y), Offset(10, y), ridge);
    }
    canvas.drawRRect(bed, Paint()..color = const Color(0xFF111827).withValues(alpha: 0.22 * math.sin(tilt)));
    canvas.restore();

    // Cabine
    void box(double x, double y, double w, double hgt, double r, Color c) => canvas.drawRRect(
          RRect.fromRectAndRadius(Rect.fromLTWH(x, y, w, hgt), Radius.circular(r)),
          Paint()..color = c,
        );
    box(12.5, -11, 19, 22, 3.5, const Color(0xFF111827));
    box(14.5, -8, 9, 16, 2, const Color(0xFF1F2A3D));
    box(24.5, -9.5, 4.5, 19, 1.5, const Color(0xFF9FC6EF));
    box(21, -13.2, 3, 1.8, 0.6, const Color(0xFF111827));
    box(21, 11.4, 3, 1.8, 0.6, const Color(0xFF111827));
    box(30.6, -9.5, 1.4, 3, 0.5, const Color(0xFFFDE68A));
    box(30.6, 6.5, 1.4, 3, 0.5, const Color(0xFFFDE68A));

    // Sable qui tombe de l'arrière de la benne
    for (final g in _grains) {
      final age = (t - (_T.sand.$1 + g.release * (_T.sand.$2 - _T.sand.$1 - 0.3))) / 0.45;
      if (age < 0 || age > 1.6) continue;
      final fall = _clamp(age);
      final opacity = age <= 1 ? 1.0 : 1 - (age - 1) / 0.6;
      canvas.drawCircle(
        Offset(_bedX - 2 - g.reach * (1 - (1 - fall) * (1 - fall)), g.y0 * (1 + (g.spread - 1) * fall)),
        2.1 - 0.7 * fall,
        Paint()..color = g.color.withValues(alpha: opacity),
      );
    }
  }

  void _tire(Canvas canvas, double ax, double ty, double offset) {
    canvas.drawRRect(
      RRect.fromRectAndRadius(Rect.fromCenter(center: Offset(ax, ty), width: 12.5, height: 4.5), const Radius.circular(2.25)),
      Paint()..color = const Color(0xFF1F2937),
    );
    final tread = Paint()..color = const Color(0xFF0B0F19);
    for (var x = ax - 4 - offset; x < ax + 4; x += 3.2) {
      final left = math.max(ax - 4, x);
      final right = math.min(ax + 4, x + 1.6);
      if (right > left) canvas.drawRect(Rect.fromLTRB(left, ty - 2.25, right, ty + 2.25), tread);
    }
  }

  @override
  bool shouldRepaint(_ScenePainter old) => old.t != t;
}

void _dashed(Canvas canvas, ui.Path path, Paint paint, double dash, double gap) {
  for (final metric in path.computeMetrics()) {
    for (var d = 0.0; d < metric.length; d += dash + gap) {
      canvas.drawPath(metric.extractPath(d, math.min(d + dash, metric.length)), paint);
    }
  }
}
