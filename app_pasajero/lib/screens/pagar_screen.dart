import 'package:flutter/material.dart';
import 'package:hive/hive.dart';
import 'dart:convert';
import 'package:uuid/uuid.dart';
import '../hce_bridge.dart'; // 👈 crea este archivo como se indicó antes

class PagarScreen extends StatefulWidget {
  const PagarScreen({super.key});

  @override
  State<PagarScreen> createState() => _PagarScreenState();
}

class _PagarScreenState extends State<PagarScreen> {
  bool _enviando = false;
  final wallet = Hive.box('walletBox');

  Future<void> _enviarPago() async {
    double saldo = wallet.get('saldo', defaultValue: 0.0);
    if (saldo < 1.0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Saldo insuficiente')),
      );
      return;
    }

    setState(() => _enviando = true);

    // Datos del pago simulado (formato compacto)
    var pago = {
      'f': 'pasajero_001',
      't': DateTime.now().toUtc().toIso8601String(),
      'a': 100, // 100 centavos = S/1.00
      'id': const Uuid().v4(),
    };

    String jsonData = jsonEncode(pago);

    // Enviar el JSON al servicio HCE
    bool ok = await HceBridge.setPayload(jsonData);

    if (ok) {
      // Descontar saldo local simulado
      wallet.put('saldo', saldo - 1.0);

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Pago listo, acerque su teléfono al cobrador')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Error al preparar el pago')),
      );
    }

    setState(() => _enviando = false);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pagar pasaje')),
      body: Center(
        child: _enviando
            ? const CircularProgressIndicator()
            : ElevatedButton.icon(
                icon: const Icon(Icons.nfc),
                label: const Text('Acerque al cobrador'),
                onPressed: _enviarPago,
              ),
      ),
    );
  }
}
