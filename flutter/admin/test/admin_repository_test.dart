import 'package:bennego_admin/data/admin_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('isoWeekOf donne la semaine ISO d\'une date', () {
    final week = isoWeekOf(DateTime.utc(2026, 10, 27));
    expect(week.year, 2026);
    expect(week.week, 44);
  });

  test('isoWeekOf rattache le 1er janvier à la dernière semaine de l\'année précédente', () {
    final week = isoWeekOf(DateTime.utc(2027, 1, 1));
    expect(week.year, 2026);
    expect(week.week, 53);
  });

  test('AdminStats lit les montants décimaux et les jours de la semaine', () {
    final stats = AdminStats.fromJson({
      'orders': {'total': 12, 'completed': 7, 'pending': 2, 'cancelled': 1},
      'drivers': {'available': 3, 'total': 15},
      'clients': {'total': 23},
      'revenue': {'total_gmv': '720000.00', 'total_revenue': '72000.00'},
      'weekly': [
        {'day': 'Lun', 'commandes': 4, 'revenus': '12000.00'},
      ],
    });

    expect(stats.orders, 12);
    expect(stats.driversAvailable, 3);
    expect(stats.gmv, 720000);
    expect(stats.weekly.single.label, 'Lun');
    expect(stats.weekly.single.revenue, 12000);
  });
}
