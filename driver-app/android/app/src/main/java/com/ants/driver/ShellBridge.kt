package com.ants.driver

import android.webkit.JavascriptInterface

class ShellBridge(private val activity: MainActivity) {
    @JavascriptInterface
    fun setStatus(text: String) {
        Prefs.setStatus(activity, text)
    }

    @JavascriptInterface
    fun start() {
        activity.runOnUiThread { activity.beginReporting() }
    }
}
