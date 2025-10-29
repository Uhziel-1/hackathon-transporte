import 'dart:convert';
import 'package:nfc_manager/nfc_manager.dart';

typedef PagoCallback = void Function(Map<String, dynamic> pago);

class NFCService {
  static bool _autoListening = false;

  /// Inicia un loop que escucha NFC continuamente y ejecuta `onPago` por cada pago detectado.
  static Future<void> startAutoListen(PagoCallback onPago) async {
    _autoListening = true;

    // Loop asíncrono: llamamos a _listenOnce repetidas veces mientras _autoListening == true
    while (_autoListening) {
      try {
        // startSession espera a que se descubra un tag
        await NfcManager.instance.startSession(
          onDiscovered: (NfcTag tag) async {
            try {
              var ndef = Ndef.from(tag);
              if (ndef == null) {
                NfcManager.instance.stopSession(errorMessage: 'Etiqueta no NDEF');
                return;
              }

              // leer mensaje
              NdefMessage message = await ndef.read();
              for (var record in message.records) {
                // constante usada en tu versión
                if (record.typeNameFormat == NdefTypeNameFormat.nfcWellknown) {
                  // los payload de texto vienen con 3 bytes de encabezado en createText: [langCodeLen, ...langCode, texto]
                  final payload = record.payload;
                  if (payload.length > 3) {
                    final text = utf8.decode(payload.sublist(3));
                    try {
                      final Map<String, dynamic> data = jsonDecode(text);
                      // notificar callback
                      onPago(data);
                    } catch (e) {
                      // JSON inválido -> ignorar
                    }
                  }
                }
              }
            } catch (e) {
              // no hacer crash: detener la sesion y continuar el loop
            } finally {
              // detener la sesión para poder iniciar de nuevo (loop)
              NfcManager.instance.stopSession();
            }
          },
        );
      } catch (e) {
        // Si startSession falla (p. ej. NFC off), rompemos o esperamos un poco antes de reintentar.
        await Future.delayed(const Duration(milliseconds: 800));
      }
      // pequeño delay entre lecturas para evitar busy-loop
      await Future.delayed(const Duration(milliseconds: 300));
    }
  }

  static Future<void> stopSession() async {
    _autoListening = false;
    try {
      await NfcManager.instance.stopSession();
    } catch (_) {}
  }
}
