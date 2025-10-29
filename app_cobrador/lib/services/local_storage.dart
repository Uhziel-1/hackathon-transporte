import 'package:hive/hive.dart';

class LocalStorageDriver {
  static const _boxName = 'walletBox';

  static double getSaldo() {
    final box = Hive.box(_boxName);
    return box.get('saldo_driver', defaultValue: 0.0);
  }

  static void setSaldo(double s) {
    final box = Hive.box(_boxName);
    box.put('saldo_driver', s);
  }

  static void addSaldo(double monto) {
    final box = Hive.box(_boxName);
    double curr = box.get('saldo_driver', defaultValue: 0.0);
    box.put('saldo_driver', curr + monto);
  }

  static void guardarTransaccionDriver(Map<String, dynamic> tx) {
    final box = Hive.box(_boxName);
    List list = box.get('txs_driver', defaultValue: []);
    list.add(tx);
    box.put('txs_driver', list);
  }

  static List<Map<String, dynamic>> getTransaccionesDriver() {
    final box = Hive.box(_boxName);
    final List<dynamic> lista = box.get('txs_driver', defaultValue: []);
    return List<Map<String, dynamic>>.from(lista);
  }
}
