package com.ants.driver

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var pendingStart = false
    private var askedBackground = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        CookieManager.getInstance().setAcceptCookie(true)
        webView = findViewById(R.id.web)
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.databaseEnabled = true
        val agent = webView.settings.userAgentString
        webView.settings.userAgentString = "$agent ANTSDriver/1.0"
        webView.addJavascriptInterface(ShellBridge(this), "AntsBridge")
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                view?.evaluateJavascript(SHELL_JS, null)
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return false
                if (uri.host == "vnhll-production.up.railway.app") return false
                startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
            }
        }
        if (savedInstanceState == null) {
            webView.loadUrl("${Prefs.ORIGIN}/driver/login")
        }
        if (Prefs.armed(this)) beginReporting()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        webView.saveState(outState)
    }

    override fun onRestoreInstanceState(savedInstanceState: Bundle) {
        super.onRestoreInstanceState(savedInstanceState)
        webView.restoreState(savedInstanceState)
    }

    fun beginReporting() {
        pendingStart = true
        if (!hasLocationPermission()) {
            val needs = mutableListOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= 33) needs.add(Manifest.permission.POST_NOTIFICATIONS)
            requestPermissions(needs.toTypedArray(), REQ_LOCATION)
            return
        }
        if (Build.VERSION.SDK_INT >= 29 && !askedBackground &&
            checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION) != PackageManager.PERMISSION_GRANTED
        ) {
            askedBackground = true
            requestPermissions(arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION), REQ_BACKGROUND)
            return
        }
        CookieManager.getInstance().flush()
        askBattery()
        Prefs.setArmed(this, true)
        pendingStart = false
        startForegroundService(Intent(this, ShareService::class.java))
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (!pendingStart) return
        if (requestCode == REQ_LOCATION && grantResults.any { it == PackageManager.PERMISSION_GRANTED }) {
            beginReporting()
        }
        if (requestCode == REQ_BACKGROUND) beginReporting()
    }

    private fun hasLocationPermission(): Boolean {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    private fun askBattery() {
        val manager = getSystemService(PowerManager::class.java)
        if (manager.isIgnoringBatteryOptimizations(packageName)) return
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName"))
        runCatching { startActivity(intent) }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    companion object {
        private const val REQ_LOCATION = 21
        private const val REQ_BACKGROUND = 22
        private const val SHELL_JS = """
            window.DriverShell = window.DriverShell || {
              isNative: true,
              platform: 'android',
              setStatus: function(text) { AntsBridge.setStatus(String(text || '')); },
              start: function() { AntsBridge.start(); }
            };
        """
    }
}
