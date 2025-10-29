import 'package:flutter/material.dart';
import 'package:hive/hive.dart';

class RecargaScreen extends StatelessWidget {
  const RecargaScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final wallet = Hive.box('walletBox');

    void recargar(double monto) {
      double saldo = wallet.get('saldo', defaultValue: 0.0);
      wallet.put('saldo', saldo + monto);

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('✅ Se recargó S/${monto.toStringAsFixed(2)}')),
      );

      // 🔹 Esperamos 1 segundo para mostrar el snackbar y luego regresamos
      Future.delayed(const Duration(seconds: 1), () {
        Navigator.pop(context);
      });
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Recargar saldo')),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('Selecciona el monto a recargar:',
                style: TextStyle(fontSize: 18)),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => recargar(1.0),
              child: const Text('Recargar S/1'),
            ),
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed: () => recargar(5.0),
              child: const Text('Recargar S/5'),
            ),
            const SizedBox(height: 10),
            ElevatedButton(
              onPressed: () => recargar(10.0),
              child: const Text('Recargar S/10'),
            ),
          ],
        ),
      ),
    );
  }
}
