package com.example.app_cobrador

import android.nfc.NfcAdapter
import android.nfc.Tag
import android.nfc.tech.IsoDep
import android.os.Bundle
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.example.hce.reader"
    private var flutterChannel: MethodChannel? = null
    private var nfcAdapter: NfcAdapter? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        flutterChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL)
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)

        flutterChannel?.setMethodCallHandler { call, result ->
            when (call.method) {
                "startReader" -> {
                    enableReaderMode()
                    result.success(true)
                }
                "stopReader" -> {
                    disableReaderMode()
                    result.success(true)
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun enableReaderMode() {
        runOnUiThread {
            val flags = NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
            nfcAdapter?.enableReaderMode(this, { tag: Tag? ->
                tag?.let {
                    handleTag(it)
                }
            }, flags, null)
            Log.d("MainActivity", "Reader mode enabled")
        }
    }

    private fun disableReaderMode() {
        runOnUiThread {
            nfcAdapter?.disableReaderMode(this)
            Log.d("MainActivity", "Reader mode disabled")
        }
    }

    private fun handleTag(tag: Tag) {
        try {
            val iso = IsoDep.get(tag)
            iso.connect()
            val aid = byteArrayOf(0xF0.toByte(),0x01.toByte(),0x02.toByte(),0x03.toByte(),0x04.toByte(),0x05.toByte(),0x06.toByte())
            val selectApdu = buildSelectApdu(aid)
            val response = iso.transceive(selectApdu)
            iso.close()

            if (response.size >= 2) {
                val sw1 = response[response.size - 2]
                val sw2 = response[response.size - 1]
                if (sw1 == 0x90.toByte() && sw2 == 0x00.toByte()) {
                    val payloadBytes = response.copyOfRange(0, response.size - 2)
                    val payloadString = String(payloadBytes, Charsets.UTF_8)
                    Log.d("MainActivity", "Received payload: $payloadString")

                    // ✅ Enviar el payload a Flutter en el hilo principal
                    runOnUiThread {
                        flutterChannel?.invokeMethod("onHcePayload", payloadString)
                    }
                } else {
                    Log.d("MainActivity", "SW not OK: ${String.format("%02X %02X", sw1, sw2)}")
                }

            }
        } catch (e: Exception) {
            Log.e("MainActivity", "Error handling tag: ${e.message}")
        }
    }

    private fun buildSelectApdu(aid: ByteArray): ByteArray {
        val header = byteArrayOf(0x00.toByte(), 0xA4.toByte(), 0x04.toByte(), 0x00.toByte())
        val lc = aid.size.toByte()
        return header + byteArrayOf(lc) + aid
    }
}
