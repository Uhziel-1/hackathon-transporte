import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../screens/cobro_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final wallet = Hive.box('walletBox');

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Cobrador - Punto de Cobro')),
      body: ValueListenableBuilder(
        valueListenable: wallet.listenable(),
        builder: (context, Box box, _) {
          final double saldo = box.get('saldo_driver', defaultValue: 0.0);
          final List txs = box.get('txs_driver', defaultValue: []);

          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 30),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Text('💰 Saldo del cobrador:', style: TextStyle(fontSize: 18)),
                const SizedBox(height: 8),
                Text('S/ ${saldo.toStringAsFixed(2)}',
                    style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold, color: Colors.blueGrey)),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  icon: const Icon(Icons.nfc),
                  label: const Text('Iniciar modo cobro (NFC)'),
                  onPressed: () {
                    Navigator.push(context, MaterialPageRoute(builder: (_) => const CobroScreen()));
                  },
                ),
                const SizedBox(height: 12),
                ElevatedButton.icon(
                  icon: const Icon(Icons.download),
                  label: const Text('Solicitar retiro (simulado)'),
                  onPressed: () {
                    // para demo: vaciar saldo y mostrar confirmación
                    if (saldo <= 0) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Saldo 0, nada que retirar')));
                      return;
                    }
                    wallet.put('saldo_driver', 0.0);
                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Retiro simulado solicitado')));
                  },
                ),
                const SizedBox(height: 20),
                const Divider(),
                const SizedBox(height: 10),
                const Text('Historial (últimos pagos):', style: TextStyle(fontSize: 16)),
                const SizedBox(height: 8),
                Expanded(
                  child: txs.isEmpty
                      ? const Center(child: Text('Sin transacciones aún'))
                      : ListView.builder(
                          itemCount: txs.length,
                          itemBuilder: (_, i) {
                            final t = txs.reversed.toList()[i];
                            return ListTile(
                              leading: const Icon(Icons.monetization_on),
                              title: Text('S/ ${ (t['amount'] as num).toStringAsFixed(2) }'),
                              subtitle: Text('${t['from']} • ${t['timestamp']}'),
                            );
                          },
                        ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
