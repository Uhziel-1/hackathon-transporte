import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:geolocator/geolocator.dart';
import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

class AlertasService {
  static final AlertasService _instance = AlertasService._internal();
  factory AlertasService() => _instance;
  AlertasService._internal();

  final FlutterLocalNotificationsPlugin _notificaciones = FlutterLocalNotificationsPlugin();
  final FlutterTts _tts = FlutterTts();
  Timer? _timer;

  Future<void> init() async {
    // Configuración de notificaciones locales
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const initSettings = InitializationSettings(android: androidSettings);
    await _notificaciones.initialize(initSettings);

    // Configuración del texto a voz (TTS)
    await _tts.setLanguage('es-ES');
    await _tts.setSpeechRate(0.5);
    await _tts.setVolume(1.0);

    // Verificar permisos de ubicación
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        print("⚠️ Permiso de ubicación denegado, no se pueden obtener alertas.");
        return;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      print("🚫 Permiso de ubicación denegado permanentemente.");
      return;
    }

    // Iniciar temporizador para verificar alertas cada 30 segundos
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _checkNearbyLine());
    print("✅ AlertasService inicializado correctamente.");
  }

  Future<void> _checkNearbyLine() async {
    try {
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);

      // Llamar al backend de alertas
      final response = await http.post(
        Uri.parse('https://tu-backend.vercel.app/api/alertas'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'ubicacionUsuario': {'lat': pos.latitude, 'lng': pos.longitude}}),
      );

      if (response.statusCode != 200) {
        print("Error API alertas: ${response.statusCode}");
        return;
      }

      final data = jsonDecode(response.body);
      final alertas = data['alertas'] as List<dynamic>? ?? [];

      for (var alerta in alertas) {
        final mensaje = alerta['mensaje'] ?? '';
        if (mensaje.isNotEmpty) {
          // Mostrar notificación local
          await _notificaciones.show(
            DateTime.now().millisecondsSinceEpoch ~/ 1000,
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

          // Reproducir el mensaje con voz
          await _tts.speak(mensaje);
          print("🔔 Alerta hablada: $mensaje");
        }
      }
    } catch (e) {
      print("Error en alertas: $e");
    }
  }

  void dispose() {
    _timer?.cancel();
    print("🛑 AlertasService detenido.");
  }
}
