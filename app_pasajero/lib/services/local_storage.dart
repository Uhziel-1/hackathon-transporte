import 'package:hive_flutter/hive_flutter.dart';

class LocalStorage {
  static const String _boxName = 'walletBox';

  /// Inicializa Hive y abre la caja
  static Future<void> init() async {
    await Hive.initFlutter();
    await Hive.openBox(_boxName);
  }

  /// Obtiene el saldo actual (default 0.0)
  static double getSaldo() {
    final box = Hive.box(_boxName);
    return box.get('saldo', defaultValue: 0.0);
  }

  /// Actualiza el saldo
  static void setSaldo(double nuevoSaldo) {
    final box = Hive.box(_boxName);
    box.put('saldo', nuevoSaldo);
  }

  /// Agrega monto al saldo actual
  static void recargar(double monto) {
    final box = Hive.box(_boxName);
    double saldoActual = box.get('saldo', defaultValue: 0.0);
    box.put('saldo', saldoActual + monto);
  }

  /// Descuenta monto del saldo
  static bool descontar(double monto) {
    final box = Hive.box(_boxName);
    double saldoActual = box.get('saldo', defaultValue: 0.0);
    if (saldoActual < monto) return false;
    box.put('saldo', saldoActual - monto);
    return true;
  }

  /// Guarda una transacción local
  static void guardarTransaccion(Map<String, dynamic> data) {
    final box = Hive.box(_boxName);
    List transacciones = box.get('transacciones', defaultValue: []);
    transacciones.add(data);
    box.put('transacciones', transacciones);
  }

  /// Obtiene historial local
  static List<Map<String, dynamic>> getTransacciones() {
    final box = Hive.box(_boxName);
    final List<dynamic> lista = box.get('transacciones', defaultValue: []);
    return List<Map<String, dynamic>>.from(lista);
  }
}
