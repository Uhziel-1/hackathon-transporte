package com.example.app_pasajero

import android.nfc.cardemulation.HostApduService
import android.os.Bundle
import android.util.Log
import java.util.concurrent.atomic.AtomicReference

class CardService : HostApduService() {

    companion object {
        private const val TAG = "CardService"
        private val SW_OK = byteArrayOf(0x90.toByte(), 0x00.toByte())
        private val SW_UNKNOWN = byteArrayOf(0x6F.toByte(), 0x00.toByte())
        val payloadRef: AtomicReference<ByteArray> = AtomicReference(ByteArray(0))
    }

    override fun processCommandApdu(commandApdu: ByteArray?, extras: Bundle?): ByteArray {
        Log.d(TAG, "APDU received: ${commandApdu?.joinToString(",")}")
        if (commandApdu == null) return SW_UNKNOWN

        // Detectar comando SELECT AID (00 A4 04 00)
        if (commandApdu.size >= 4 &&
            commandApdu[0] == 0x00.toByte() &&
            commandApdu[1] == 0xA4.toByte() &&
            commandApdu[2] == 0x04.toByte() &&
            commandApdu[3] == 0x00.toByte()) {

            val payload = payloadRef.get() ?: ByteArray(0)
            val response = payload + SW_OK
            Log.d(TAG, "Responding with payload of length ${payload.size}")
            return response
        }

        return SW_UNKNOWN
    }

    override fun onDeactivated(reason: Int) {
        Log.d(TAG, "HCE deactivated: reason=$reason")
    }
}
