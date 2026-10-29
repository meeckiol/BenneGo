import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';

import '../data/admin_repository.dart';

/// Chauffeurs et clients : consultation et activation ou désactivation des comptes.
class PeopleScreen extends StatelessWidget {
  const PeopleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Utilisateurs'),
          bottom: TabBar(
            indicatorColor: BnColors.brand,
            labelColor: BnColors.textStrong,
            unselectedLabelColor: BnColors.text3,
            tabs: [Tab(text: tr('Chauffeurs')), Tab(text: tr('Clients'))],
          ),
        ),
        body: const TabBarView(children: [_DriversTab(), _ClientsTab()]),
      ),
    );
  }
}

class _DriversTab extends StatefulWidget {
  const _DriversTab();

  @override
  State<_DriversTab> createState() => _DriversTabState();
}

class _DriversTabState extends State<_DriversTab> {
  late Future<List<DriverRow>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().drivers();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().drivers());
    await _future;
  }

  Future<void> _toggle(DriverRow driver, bool active) async {
    try {
      await context.read<AdminRepository>().setActive(driver.id, isActive: active);
      await _reload();
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: BnColors.brand,
      onRefresh: _reload,
      child: FutureBuilder<List<DriverRow>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: BnColors.brand));
          }
          final drivers = snapshot.data ?? const <DriverRow>[];
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              if (drivers.isEmpty) BnCard(child: BnEmpty(message: tr('Aucun chauffeur inscrit.'))),
              for (final driver in drivers) ...[
                BnCard(
                  child: Row(
                    children: [
                      BnAvatar(initials: initialsOf(driver.fullName), size: 40),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(driver.fullName, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
                            Text(
                              '${driver.phone} · ${driver.truckPlate.isEmpty ? 'sans plaque' : driver.truckPlate}',
                              style: const TextStyle(color: BnColors.text2, fontSize: 12),
                            ),
                            Text(
                              '${driver.totalTrips} courses${driver.rating == null ? '' : ' · ${driver.rating!.toStringAsFixed(1)} / 5'}'
                              '${driver.isAvailable ? ' · disponible' : ''}',
                              style: const TextStyle(color: BnColors.text3, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      Switch(value: driver.isActive, activeTrackColor: BnColors.success, onChanged: (v) => _toggle(driver, v)),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ],
          );
        },
      ),
    );
  }
}

class _ClientsTab extends StatefulWidget {
  const _ClientsTab();

  @override
  State<_ClientsTab> createState() => _ClientsTabState();
}

class _ClientsTabState extends State<_ClientsTab> {
  late Future<List<ClientRow>> _future;

  @override
  void initState() {
    super.initState();
    _future = context.read<AdminRepository>().clients();
  }

  Future<void> _reload() async {
    setState(() => _future = context.read<AdminRepository>().clients());
    await _future;
  }

  Future<void> _toggle(ClientRow client, bool active) async {
    try {
      await context.read<AdminRepository>().setActive(client.id, isActive: active);
      await _reload();
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      color: BnColors.brand,
      onRefresh: _reload,
      child: FutureBuilder<List<ClientRow>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: BnColors.brand));
          }
          final clients = snapshot.data ?? const <ClientRow>[];
          return ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16),
            children: [
              if (clients.isEmpty) BnCard(child: BnEmpty(message: tr('Aucun client inscrit.'))),
              for (final client in clients) ...[
                BnCard(
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(client.fullName, style: const TextStyle(color: BnColors.textStrong, fontWeight: FontWeight.w700)),
                            Text(client.phone, style: const TextStyle(color: BnColors.text2, fontSize: 12)),
                            if (client.email.isNotEmpty)
                              Text(client.email, style: const TextStyle(color: BnColors.text3, fontSize: 11)),
                          ],
                        ),
                      ),
                      Switch(value: client.isActive, activeTrackColor: BnColors.success, onChanged: (v) => _toggle(client, v)),
                    ],
                  ),
                ),
                const SizedBox(height: 10),
              ],
            ],
          );
        },
      ),
    );
  }
}
