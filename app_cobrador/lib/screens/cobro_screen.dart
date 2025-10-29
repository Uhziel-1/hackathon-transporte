import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:hive/hive.dart';
import '../services/hce_reader.dart';
import '../services/local_storage.dart'; // tu helper anterior

class CobroScreen extends StatefulWidget {
  const CobroScreen({super.key});

  @override
  State<CobroScreen> createState() => _CobroScreenState();
}

class _CobroScreenState extends State<CobroScreen> {
  bool _listening = false;
  String _status = 'Inactivo';
  final wallet = Hive.box('walletBox');

  @override
  void initState() {
    super.initState();
    // registrar callback para recibir payloads desde native
    HceReader.setOnPayload((payload) {
      _onPayloadReceived(payload);
    });
  }

  Future<void> _onPayloadReceived(String payload) async {
    try {
      final Map<String, dynamic> data = jsonDecode(payload);
      final int amountCents = (data['a'] is int) ? data['a'] as int : (data['a'] as num).toInt();
      final double amount = amountCents / 100.0;
      final String from = data['f'] ?? 'pasajero';

      // evitar duplicados: controla por id si quieres (opcional)
      final String txnId = data['id'] ?? DateTime.now().millisecondsSinceEpoch.toString();

      // actualizar saldo del cobrador
      LocalStorageDriver.addSaldo(amount);

      // guardar transaccion
      LocalStorageDriver.guardarTransaccionDriver({
        'from': from,
        'amount': amount,
        'timestamp': data['t'] ?? DateTime.now().toIso8601String(),
        'id': txnId,
      });

      setState(() {
        _status = 'Pago recibido S/ ${amount.toStringAsFixed(2)}';
      });

      // Mensaje breve
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Pago recibido S/ ${amount.toStringAsFixed(2)}')));

      // Volver a modo escucha luego de un delay
      await Future.delayed(const Duration(milliseconds: 900));
      if (_listening) {
        setState(() {
          _status = 'Escuchando NFC... acerque el siguiente teléfono';
        });
      }
    } catch (e) {
      setState(() {
        _status = 'Error leyendo payload';
      });
    }
  }

  Future<void> _startAutoCobro() async {
    final ok = await HceReader.startReader();
    if (ok) {
      setState(() {
        _listening = true;
        _status = 'Escuchando NFC... acerque el teléfono del pasajero';
      });
    } else {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No se pudo iniciar el lector NFC')));
    }
  }

  Future<void> _stopAutoCobro() async {
    await HceReader.stopReader();
    setState(() {
      _listening = false;
      _status = 'Inactivo';
    });
  }

  @override
  Widget build(BuildContext context) {
    final double saldo = wallet.get('saldo_driver', defaultValue: 0.0);

    return Scaffold(
      appBar: AppBar(title: const Text('Modo Cobro')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Text('Estado: $_status', style: const TextStyle(fontSize: 18)),
            const SizedBox(height: 16),
            Text('Saldo actual: S/ ${saldo.toStringAsFixed(2)}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            const SizedBox(height: 24),
            _listening
                ? ElevatedButton.icon(
                    icon: const Icon(Icons.stop),
                    label: const Text('Detener AutoCobro'),
                    onPressed: _stopAutoCobro,
                    style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
                  )
                : ElevatedButton.icon(
                    icon: const Icon(Icons.play_arrow),
                    label: const Text('Iniciar AutoCobro (esperar taps)'),
                    onPressed: _startAutoCobro,
                  ),
            const SizedBox(height: 20),
            const Text('Al recibir un pago, este se procesa automáticamente.'),
          ],
        ),
      ),
    );
  }
}
