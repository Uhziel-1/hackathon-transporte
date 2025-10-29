package com.example.app_pasajero


import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.util.Log

class MainActivity: FlutterActivity() {
    private val CHANNEL = "com.yourdomain.hce"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "setPayload" -> {
                        val payload = call.argument<String>("payload") ?: ""
                        // set payload bytes into CardService.payloadRef
                        CardService.payloadRef.set(payload.toByteArray(Charsets.UTF_8))
                        Log.d("MainActivity", "HCE payload set len=${payload.length}")
                        result.success(true)
                    }
                    else -> result.notImplemented()
                }
            }
    }
}
