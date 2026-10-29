import 'dart:async';

import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'app.dart';
import 'data/admin_repository.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initFrenchFormats();
  // Langue choisie dans Réglages > Langue (sinon celle du téléphone si proposée)
  await Lang.instance.init();

  final api = ApiClient();
  final session = Session(api: api, store: TokenStore());

  runApp(
    // Tout texte affiché se redessine quand la langue change
    LangScope(
      child: MultiProvider(
        providers: [
          Provider.value(value: api),
          Provider(create: (_) => AdminRepository(api)),
          ChangeNotifierProvider.value(value: session),
        ],
        child: const AdminApp(),
      ),
    ),
  );
  unawaited(session.restore());
}
