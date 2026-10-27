import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';

/// Carte de suivi : point de chargement, point de livraison et position du chauffeur en direct.
class TrackingMap extends StatefulWidget {
  const TrackingMap({super.key, required this.orderId, required this.pickup, required this.delivery});

  final String orderId;
  final LatLng pickup;
  final LatLng delivery;

  @override
  State<TrackingMap> createState() => _TrackingMapState();
}

class _TrackingMapState extends State<TrackingMap> {
  late final RealtimeClient _realtime;
  LatLng? _driver;

  @override
  void initState() {
    super.initState();
    _realtime = context.read<RealtimeClient>();
    _realtime.on('driver_position', _onPosition);
    _realtime.emit('track_order', widget.orderId);
  }

  @override
  void dispose() {
    _realtime.off('driver_position', _onPosition);
    super.dispose();
  }

  void _onPosition(dynamic data) {
    if (data is! Map || data['order_id'] != widget.orderId) return;
    final lat = data['lat'];
    final lng = data['lng'];
    if (lat is! num || lng is! num) return;
    setState(() => _driver = LatLng(lat.toDouble(), lng.toDouble()));
  }

  @override
  Widget build(BuildContext context) {
    final points = [widget.pickup, widget.delivery, ?_driver];
    return ClipRRect(
      borderRadius: BorderRadius.circular(16),
      child: SizedBox(
        height: 260,
        child: FlutterMap(
          options: MapOptions(
            initialCameraFit: CameraFit.bounds(
              bounds: LatLngBounds.fromPoints(points),
              padding: const EdgeInsets.all(40),
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              userAgentPackageName: 'com.bennego.client',
            ),
            MarkerLayer(
              markers: [
                Marker(point: widget.pickup, width: 28, height: 28, child: const _Dot(color: BnColors.info)),
                Marker(point: widget.delivery, width: 28, height: 28, child: const _Dot(color: BnColors.success)),
                if (_driver != null)
                  Marker(
                    point: _driver!,
                    width: 34,
                    height: 34,
                    child: const _Dot(color: BnColors.brand, icon: Icons.navigation),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.color, this.icon});

  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white, width: 2),
        boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 4)],
      ),
      child: icon == null ? null : Icon(icon, color: Colors.white, size: 18),
    );
  }
}
