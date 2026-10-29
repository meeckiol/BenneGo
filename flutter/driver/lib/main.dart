import 'dart:async';

import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'controllers/driver_controller.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initFrenchFormats();
  // Langue choisie dans Réglages > Langue (sinon celle du téléphone si proposée)
  await Lang.instance.init();

  final api = ApiClient();
  final session = Session(api: api, store: TokenStore());
  final realtime = RealtimeClient(baseUrl: api.baseUrl);
  final driver = DriverController(api: api, realtime: realtime, session: session);
  final chats = ChatCenter(api: api, realtime: realtime);

  runApp(
    // Tout texte affiché se redessine quand la langue change
    LangScope(
      child: MultiProvider(
        providers: [
          Provider.value(value: api),
          Provider.value(value: realtime),
          ChangeNotifierProvider.value(value: session),
          ChangeNotifierProvider.value(value: driver),
          ChangeNotifierProvider.value(value: chats),
        ],
        child: const DriverApp(),
      ),
    ),
  );
  unawaited(session.restore());
}
