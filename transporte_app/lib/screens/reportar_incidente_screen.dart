import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart'; // Para obtener el UID del conductor actual

class PantallaReportarIncidente extends StatefulWidget {
  final String vehiculoId; // Necesitamos saber qué vehículo reporta

  const PantallaReportarIncidente({super.key, required this.vehiculoId});

  @override
  State<PantallaReportarIncidente> createState() =>
      _PantallaReportarIncidenteState();
}

class _PantallaReportarIncidenteState extends State<PantallaReportarIncidente> {
  String? _tipoSeleccionado; // Para guardar la selección del dropdown
  final _mensajeController = TextEditingController();
  bool _isLoading = false;
  String _statusMessage = '';

  final List<String> _tiposIncidente = [
    'averia_mecanica',
    'trafico_denso',
    'accidente_ruta',
    'incidente_seguridad',
    'otro',
  ];

  Future<void> _enviarReporte() async {
    if (_tipoSeleccionado == null) {
      setState(() {
        _statusMessage = 'Por favor, selecciona un tipo de incidente.';
      });
      return;
    }

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      setState(() {
        _statusMessage = 'Error: No se pudo identificar al usuario.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _statusMessage = 'Enviando reporte...';
    });

    try {
      await FirebaseFirestore.instance.collection('ReportesConductor').add({
        'vehiculoId': widget.vehiculoId,
        'conductorAuthUid': user.uid, // Guardamos quién reportó
        'tipo': _tipoSeleccionado,
        'mensaje': _mensajeController.text.trim(),
        'timestamp': FieldValue.serverTimestamp(), // Firestore pone la hora
        'atendido': false,
      });

      setState(() {
        _statusMessage = '¡Reporte enviado con éxito!';
        _isLoading = false;
        _tipoSeleccionado = null; // Limpiar selección
        _mensajeController.clear(); // Limpiar mensaje
      });

      // Opcional: Cerrar la pantalla después de un delay
      Future.delayed(const Duration(seconds: 2), () {
        if (mounted) {
          Navigator.pop(context);
        }
      });

    } catch (e) {
      setState(() {
        _statusMessage = 'Error al enviar el reporte: $e';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reportar Incidente')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _tipoSeleccionado,
              hint: const Text('Selecciona el tipo de incidente'),
              onChanged: (String? newValue) {
                setState(() {
                  _tipoSeleccionado = newValue;
                });
              },
              items: _tiposIncidente
                  .map<DropdownMenuItem<String>>((String value) {
                return DropdownMenuItem<String>(
                  value: value,
                  child: Text(value.replaceAll('_', ' ').toUpperCase()), // Formato legible
                );
              }).toList(),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _mensajeController,
              decoration: const InputDecoration(
                labelText: 'Mensaje (Opcional)',
                hintText: 'Describe brevemente lo ocurrido...',
                border: OutlineInputBorder(),
              ),
              maxLines: 3,
            ),
            const SizedBox(height: 24),
            _isLoading
                ? const Center(child: CircularProgressIndicator())
                : ElevatedButton(
                    onPressed: _enviarReporte,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16.0)
                    ),
                    child: const Text('Enviar Reporte'),
                  ),
            if (_statusMessage.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 16.0),
                child: Text(
                  _statusMessage,
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: _statusMessage.startsWith('Error')
                        ? Colors.red
                        : Colors.green,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

