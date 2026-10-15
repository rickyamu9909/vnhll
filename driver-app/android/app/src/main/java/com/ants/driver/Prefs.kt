package com.ants.driver

import android.content.Context

object Prefs {
    const val ORIGIN = "https://vnhll-production.up.railway.app"
    private const val FILE = "ants-driver"
    private const val ARMED = "armed"
    private const val STATUS = "status"

    private fun sp(context: Context) = context.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun armed(context: Context) = sp(context).getBoolean(ARMED, false)

    fun setArmed(context: Context, value: Boolean) {
        sp(context).edit().putBoolean(ARMED, value).apply()
    }

    fun status(context: Context) = sp(context).getString(STATUS, "运输中") ?: "运输中"

    fun setStatus(context: Context, text: String) {
        val clean = text.trim().take(40).ifBlank { "运输中" }
        sp(context).edit().putString(STATUS, clean).apply()
    }
}
