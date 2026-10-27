import 'dart:convert';

import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../data/client_repository.dart';

/// Paiement KKiaPay (MTN MoMo, Moov Money) dans une WebView, comme sur le site.
/// Renvoie `true` quand le paiement est enregistré, `false` sinon.
class PaymentScreen extends StatefulWidget {
  const PaymentScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<PaymentScreen> createState() => _PaymentScreenState();
}

class _PaymentScreenState extends State<PaymentScreen> {
  late final WebViewController _web;
  late final Future<CheckoutConfig> _config;

  @override
  void initState() {
    super.initState();
    final repo = context.read<ClientRepository>();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(BnColors.bg)
      ..addJavaScriptChannel('BenneGo', onMessageReceived: _onMessage);
    _config = repo.checkout(widget.orderId).then((config) {
      _web.loadHtmlString(_pageFor(config));
      return config;
    });
  }

  Future<void> _onMessage(JavaScriptMessage message) async {
    final data = jsonDecode(message.message) as Map<String, dynamic>;
    if (data['type'] != 'success') {
      if (mounted) Navigator.of(context).pop(false);
      return;
    }
    try {
      await context.read<ClientRepository>().confirmPayment(widget.orderId, data['transactionId'] as String);
      if (mounted) Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  /// Page minimale qui charge le widget KKiaPay et renvoie le résultat à l'application.
  String _pageFor(CheckoutConfig config) {
    final options = jsonEncode(config.widgetOptions).replaceAll('<', r'<');
    return '''
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { margin: 0; background: #0b0b10; color: #e4e4ec; font-family: sans-serif;
           display: flex; align-items: center; justify-content: center; height: 100vh; }
  </style>
  <script src="https://cdn.kkiapay.me/k.js"></script>
</head>
<body>
  <p>Ouverture du paiement sécurisé…</p>
  <script>
    addSuccessListener(function (response) {
      BenneGo.postMessage(JSON.stringify({ type: 'success', transactionId: response.transactionId }));
    });
    addFailedListener(function () {
      BenneGo.postMessage(JSON.stringify({ type: 'failed' }));
    });
    window.addEventListener('load', function () { openKkiapayWidget($options); });
  </script>
</body>
</html>
''';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Paiement sécurisé')),
      body: FutureBuilder<CheckoutConfig>(
        future: _config,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            final error = snapshot.error;
            return Padding(
              padding: const EdgeInsets.all(24),
              child: Center(
                child: BnBanner(
                  message: error is ApiException ? error.message : 'Paiement indisponible pour le moment.',
                  tone: BnTone.danger,
                ),
              ),
            );
          }
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator(color: BnColors.brand));
          }
          return WebViewWidget(controller: _web);
        },
      ),
    );
  }
}
