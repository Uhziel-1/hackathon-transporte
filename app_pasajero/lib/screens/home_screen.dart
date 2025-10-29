import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../screens/recarga_screen.dart';
import '../screens/pagar_screen.dart';

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
      appBar: AppBar(title: const Text('Pasajero - Monedero Local')),
      // 👇 Aquí actualizamos dinámicamente el saldo
      body: ValueListenableBuilder(
        valueListenable: wallet.listenable(),
        builder: (context, Box box, _) {
          final double saldo = box.get('saldo', defaultValue: 0.0);

          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text('💵 Saldo disponible:',
                    style: TextStyle(fontSize: 20)),
                const SizedBox(height: 10),
                Text(
                  'S/ ${saldo.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontSize: 36,
                    fontWeight: FontWeight.bold,
                    color: Colors.green,
                  ),
                ),
                const SizedBox(height: 30),
                ElevatedButton.icon(
                  icon: const Icon(Icons.add_circle),
                  label: const Text('Recargar saldo'),
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const RecargaScreen()),
                  ),
                ),
                const SizedBox(height: 15),
                ElevatedButton.icon(
                  icon: const Icon(Icons.nfc),
                  label: const Text('Pagar pasaje (S/1.00)'),
                  onPressed: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const PagarScreen()),
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
