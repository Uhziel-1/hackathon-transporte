import 'package:flutter/material.dart';

// -------------------------------------------------------------------
// 4. PANTALLA DE RELLENO (Placeholder)
// -------------------------------------------------------------------
class PantallaPlaceholder extends StatelessWidget {
  final String titulo;
  const PantallaPlaceholder({super.key, required this.titulo});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(titulo)),
      body: Center(
        child: Text('Pantalla de "$titulo" en construcción.'),
      ),
    );
  }
}
