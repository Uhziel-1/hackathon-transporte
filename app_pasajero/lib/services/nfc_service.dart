import 'dart:convert';
import 'package:nfc_manager/nfc_manager.dart';

class NFCService {
  /// Escribir datos JSON en una etiqueta NFC (modo NDEF)
  static Future<bool> escribirPago(Map<String, dynamic> data) async {
    bool disponible = await NfcManager.instance.isAvailable();
    if (!disponible) return false;

    String jsonData = jsonEncode(data);

    try {
      await NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
        var ndef = Ndef.from(tag);
        if (ndef == null || !ndef.isWritable) {
          NfcManager.instance.stopSession(errorMessage: 'Etiqueta no compatible');
          return;
        }

        var record = NdefRecord.createText(jsonData);
        var message = NdefMessage([record]);
        await ndef.write(message);

        NfcManager.instance.stopSession();
      });

      return true;
    } catch (e) {
      NfcManager.instance.stopSession(errorMessage: e.toString());
      return false;
    }
  }

  /// Leer datos JSON desde una etiqueta NFC (modo NDEF)
  static Future<Map<String, dynamic>?> leerPago() async {
    bool disponible = await NfcManager.instance.isAvailable();
    if (!disponible) return null;

    Map<String, dynamic>? data;

    try {
      await NfcManager.instance.startSession(onDiscovered: (NfcTag tag) async {
        var ndef = Ndef.from(tag);
        if (ndef == null) {
          NfcManager.instance.stopSession(errorMessage: 'No es etiqueta NDEF');
          return;
        }

        var message = await ndef.read();
        for (var record in message.records) {
          if (record.typeNameFormat == NdefTypeNameFormat.nfcWellknown &&
              utf8.decode(record.type) == 'T') {


            String texto = utf8.decode(record.payload.sublist(3));
            data = jsonDecode(texto);
            break;
          }
        }

        NfcManager.instance.stopSession();
      });
    } catch (e) {
      NfcManager.instance.stopSession(errorMessage: e.toString());
    }

    return data;
  }
}
