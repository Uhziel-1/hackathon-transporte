import 'package:flutter/services.dart';

class HceReader {
  static const platform = MethodChannel('com.example.hce.reader');
  static Function(String)? _onPayload;

  static void setOnPayload(Function(String) callback) {
    _onPayload = callback;
    platform.setMethodCallHandler((call) async {
      if (call.method == "onHcePayload") {
        _onPayload?.call(call.arguments);
      }
    });
  }

  static Future<bool> startReader() async {
    try {
      await platform.invokeMethod('startReader');
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<void> stopReader() async {
    try {
      await platform.invokeMethod('stopReader');
    } catch (_) {}
  }
}
