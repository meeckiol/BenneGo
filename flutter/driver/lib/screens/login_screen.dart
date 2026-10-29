import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:provider/provider.dart';

/// Connexion du chauffeur par numéro de téléphone et mot de passe.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _phone = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _obscure = true;
  String? _error;

  @override
  void dispose() {
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    final session = context.read<Session>();
    try {
      await session.login(phone: _phone.text.trim(), password: _password.text, requiredRole: 'driver');
    } on ApiException catch (error) {
      // Compte supprimé il y a moins de 60 jours : on propose de le reprendre
      if (error.code == 'ACCOUNT_DELETION_PENDING' && mounted && await confirmAccountRestore(context, error)) {
        try {
          await session.restoreAccount(phone: _phone.text.trim(), password: _password.text, requiredRole: 'driver');
          return;
        } on ApiException catch (restoreError) {
          if (mounted) setState(() => _error = restoreError.message);
          return;
        }
      }
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Image.asset('assets/logo.png', height: 72),
                    const SizedBox(height: 16),
                    const Text(
                      'BenneGo Chauffeur',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: BnColors.textStrong, fontSize: 24, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Recevez des missions, suivez le chargement et soyez payé dès la réception confirmée.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: BnColors.text2, height: 1.4),
                    ),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _phone,
                      keyboardType: TextInputType.phone,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      decoration: InputDecoration(
                        labelText: tr('Numéro de téléphone'),
                        hintText: tr('+229 XX XX XX XX'),
                      ),
                      validator: (value) => (value == null || value.trim().length < 8) ? tr('Numéro invalide') : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      obscureText: _obscure,
                      autofillHints: const [AutofillHints.password],
                      decoration: InputDecoration(
                        labelText: tr('Mot de passe'),
                        suffixIcon: IconButton(
                          tooltip: _obscure ? tr('Afficher') : tr('Masquer'),
                          icon: Icon(_obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined),
                          onPressed: () => setState(() => _obscure = !_obscure),
                        ),
                      ),
                      validator: (value) => (value == null || value.isEmpty) ? tr('Saisissez votre mot de passe') : null,
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      BnBanner(message: _error!, tone: BnTone.danger, icon: Icons.error_outline),
                    ],
                    const SizedBox(height: 20),
                    BnPrimaryButton(label: tr('Se connecter'), icon: Icons.login, busy: _busy, onPressed: _submit),
                    const SizedBox(height: 16),
                    const Text(
                      "Pas encore inscrit ? Contactez BenneGo pour l'ouverture de votre compte chauffeur.",
                      textAlign: TextAlign.center,
                      style: TextStyle(color: BnColors.text3, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
