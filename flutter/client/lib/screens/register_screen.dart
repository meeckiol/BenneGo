import 'package:bennego_core/bennego_core.dart';
import 'package:flutter/material.dart' hide Text;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

/// Inscription client : identité, puis vérification du numéro par code SMS.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _prenom = TextEditingController();
  final _nom = TextEditingController();
  final _phone = TextEditingController();
  final _adresse = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _code = TextEditingController();
  // Code parrain : se saisit à l'inscription (1 500 FCFA de réduction sur la 1re commande)
  final _referral = TextEditingController();
  DateTime? _birthDate;
  bool _codeSent = false;
  bool _verified = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in [_prenom, _nom, _phone, _adresse, _email, _password, _code, _referral]) {
      controller.dispose();
    }
    super.dispose();
  }

  String get _cleanPhone => _phone.text.replaceAll(RegExp(r'\s+'), '');

  Future<void> _run(Future<void> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _requestCode() => _run(() async {
        await context.read<ApiClient>().post('/auth/otp/request', body: {'phone': _cleanPhone});
        if (mounted) setState(() => _codeSent = true);
      });

  Future<void> _verifyCode() => _run(() async {
        await context.read<ApiClient>().post('/auth/otp/verify', body: {'phone': _cleanPhone, 'code': _code.text.trim()});
        if (mounted) setState(() => _verified = true);
      });

  Future<void> _create() async {
    if (!_formKey.currentState!.validate() || _birthDate == null) {
      setState(() => _error = 'Complétez votre date de naissance et les champs requis.');
      return;
    }
    await _run(() async {
      final api = context.read<ApiClient>();
      final session = context.read<Session>();
      await api.post('/auth/register', body: {
        'prenom': _prenom.text.trim(),
        'nom': _nom.text.trim(),
        'phone': _cleanPhone,
        'date_naissance': DateFormat('yyyy-MM-dd').format(_birthDate!),
        'adresse': _adresse.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
        'password': _password.text,
        'role': 'client',
        if (_referral.text.trim().isNotEmpty) 'referral_code': _referral.text.trim().toUpperCase(),
      });
      await session.login(phone: _cleanPhone, password: _password.text, requiredRole: 'client');
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    });
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 30),
      firstDate: DateTime(1920),
      lastDate: DateTime(now.year - 16),
      helpText: 'Date de naissance',
    );
    if (picked != null) setState(() => _birthDate = picked);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Créer mon compte')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _prenom,
                          decoration: InputDecoration(labelText: tr('Prénom')),
                          validator: (v) => (v == null || v.trim().isEmpty) ? tr('Requis') : null,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextFormField(
                          controller: _nom,
                          decoration: InputDecoration(labelText: tr('Nom')),
                          validator: (v) => (v == null || v.trim().isEmpty) ? tr('Requis') : null,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _phone,
                    enabled: !_verified,
                    keyboardType: TextInputType.phone,
                    decoration: InputDecoration(labelText: tr('Téléphone (+229...)')),
                    validator: (v) => (v == null || _cleanPhone.length < 8) ? tr('Numéro invalide') : null,
                  ),
                  const SizedBox(height: 12),
                  if (!_verified) ...[
                    if (!_codeSent)
                      OutlinedButton(
                        onPressed: _busy || _cleanPhone.length < 8 ? null : _requestCode,
                        child: const Text('Recevoir le code par SMS'),
                      )
                    else
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _code,
                              keyboardType: TextInputType.number,
                              maxLength: 6,
                              decoration: InputDecoration(labelText: tr('Code à 6 chiffres'), counterText: ''),
                            ),
                          ),
                          const SizedBox(width: 12),
                          ElevatedButton(
                            onPressed: _busy || _code.text.trim().length != 6 ? null : _verifyCode,
                            child: const Text('Valider'),
                          ),
                        ],
                      ),
                  ] else
                    const Padding(
                      padding: EdgeInsets.only(bottom: 8),
                      child: Text('✓ Numéro vérifié', style: TextStyle(color: BnColors.success, fontWeight: FontWeight.w700)),
                    ),
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _pickBirthDate,
                    icon: const Icon(Icons.cake_outlined),
                    label: Text(_birthDate == null ? tr('Date de naissance') : DateFormat('dd/MM/yyyy').format(_birthDate!)),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _adresse,
                    decoration: InputDecoration(labelText: tr('Adresse')),
                    validator: (v) => (v == null || v.trim().isEmpty) ? tr('Requis') : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: InputDecoration(labelText: tr('Email (facultatif)')),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    decoration: InputDecoration(labelText: tr('Mot de passe (8 caractères minimum)')),
                    validator: (v) => (v == null || v.length < 8) ? tr('8 caractères minimum') : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _referral,
                    textCapitalization: TextCapitalization.characters,
                    maxLength: 30,
                    decoration: InputDecoration(
                      labelText: tr('Code parrain (facultatif)'),
                      helperText: tr('1 500 FCFA de réduction sur votre première commande'),
                      counterText: '',
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    BnBanner(message: _error!, tone: BnTone.danger, icon: Icons.error_outline),
                  ],
                  const SizedBox(height: 20),
                  BnPrimaryButton(
                    label: tr('Créer mon compte'),
                    icon: Icons.person_add_alt,
                    busy: _busy,
                    onPressed: _verified ? _create : null,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
