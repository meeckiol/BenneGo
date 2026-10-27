import '../format/format.dart';

/// Utilisateur connecté (client, chauffeur ou administrateur).
class AppUser {
  const AppUser({required this.id, required this.fullName, required this.phone, required this.role});

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] as String,
        fullName: json['full_name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        role: json['role'] as String? ?? '',
      );

  final String id;
  final String fullName;
  final String phone;
  final String role;

  String get firstName => fullName.trim().split(RegExp(r'\s+')).first;

  String get initials => initialsOf(fullName);
}
