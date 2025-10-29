import 'dart:async';
import 'dart:convert';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;

class AlertasService {
  static final AlertasService _instance = AlertasService._internal();
  factory AlertasService() => _instance;
  AlertasService._internal();

  final FlutterLocalNotificationsPlugin _notificaciones = FlutterLocalNotificationsPlugin();
  final FlutterTts _tts = FlutterTts();
  Timer? _timer;

  // 🧩 URL del backend que ya probaste en Postman
  final String _apiUrl = "https://hackathon-transporte-5q28.vercel.app/api/alertas";

  Future<void> init() async {
    // 🔹 Inicializar notificaciones locales
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);
    await _notificaciones.initialize(initSettings);

    // 🔹 Configurar voz
    await _tts.setLanguage('es-ES');
    await _tts.setSpeechRate(0.5);

    // 🔹 Permiso de ubicación
    await _ensureLocationPermission();

    // 🔹 Revisar alertas cada 15 segundos 🔥
    _timer = Timer.periodic(const Duration(seconds: 15), (_) => _checkNearbyLine());
  }

  Future<void> _ensureLocationPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      print("Los servicios de ubicación están desactivados.");
      return;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        print("Permiso de ubicación denegado.");
      }
    }
  }

  Future<void> _checkNearbyLine() async {
    try {
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);

      final response = await http.post(
        Uri.parse(_apiUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'ubicacionUsuario': {'lat': pos.latitude, 'lng': pos.longitude}
        }),
      );

      if (response.statusCode != 200) {
        print("Error API alertas: ${response.statusCode}");
        return;
      }

      final data = jsonDecode(response.body);
      final alertas = data['alertas'] as List<dynamic>? ?? [];

      if (alertas.isEmpty) return;

      for (var alerta in alertas) {
        final mensaje = alerta['mensaje'] ?? '';
        if (mensaje.isNotEmpty) {
          // 🔔 Mostrar notificación
          await _notificaciones.show(
            DateTime.now().millisecondsSinceEpoch ~/ 1000, // id único
            "🚍 Alerta de Transporte",
            mensaje,
            const NotificationDetails(
              android: AndroidNotificationDetails(
                'alertas_channel',
                'Alertas de Transporte',
                importance: Importance.max,
                priority: Priority.high,
              ),
            ),
          );

          // 🔊 Leer en voz alta
          await _tts.speak(mensaje);
        }
      }
    } catch (e) {
      print("Error en alertas: $e");
    }
  }

  void dispose() {
    _timer?.cancel();
  }
}
