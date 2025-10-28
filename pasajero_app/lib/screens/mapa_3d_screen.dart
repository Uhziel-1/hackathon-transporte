import 'package:flutter/material.dart';
import 'pasajero_home_screen.dart';

class Mapa3DScreen extends StatelessWidget {
  const Mapa3DScreen({super.key});

  void _abrirZona(BuildContext context, String zona) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const PasajeroHomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Mapa 3D - Juliaca (Vista simulada)'),
      ),
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [Color(0xFF002f4b), Color(0xFFdc4225)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: const Center(
              child: Icon(Icons.location_city, color: Colors.white54, size: 120),
            ),
          ),
          Positioned(
            bottom: 50,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _zonaButton(context, 'Centro'),
                _zonaButton(context, 'Norte'),
                _zonaButton(context, 'Sur'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _zonaButton(BuildContext context, String zona) {
    return ElevatedButton(
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.lightBlueAccent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      ),
      onPressed: () => _abrirZona(context, zona),
      child: Text(zona),
    );
  }
}
