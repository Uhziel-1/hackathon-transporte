import 'package:flutter/services.dart';

class HceBridge {
  static const MethodChannel _ch = MethodChannel('com.yourdomain.hce');

  static Future<bool> setPayload(String json) async {
    try {
      final res = await _ch.invokeMethod('setPayload', {'payload': json});
      return res == true;
    } catch (e) {
      return false;
    }
  }
}
