package com.ants.driver

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.webkit.CookieManager
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.min
import kotlin.math.roundToInt

class ShareService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private val looping = AtomicBoolean(false)
    private var latest: Location? = null
    private var failures = 0
    private val queue = JSONArray()

    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            latest = location
        }

        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
        @Deprecated("legacy")
        override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            Prefs.setArmed(this, false)
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return START_NOT_STICKY
        }
        startInForeground()
        if (looping.compareAndSet(false, true)) {
            listen()
            clock()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        looping.set(false)
        handler.removeCallbacksAndMessages(null)
        runCatching { locationManager().removeUpdates(listener) }
        super.onDestroy()
    }

    private fun startInForeground() {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL, "位置上报", NotificationManager.IMPORTANCE_LOW))
        }
        val stop = PendingIntent.getService(
            this,
            1,
            Intent(this, ShareService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val open = PendingIntent.getActivity(
            this,
            2,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification: Notification = Notification.Builder(this, CHANNEL)
            .setContentTitle("位置上报中")
            .setContentText("前往提货后持续上报。切屏或锁屏仍会继续。")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setContentIntent(open)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "停止", stop)
            .build()
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION)
        } else {
            startForeground(NOTIF_ID, notification)
        }
    }

    private fun listen() {
        val manager = locationManager()
        val fine = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
        val coarse = checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!fine && !coarse) return
        if (fine && manager.isProviderEnabled(LocationManager.GPS_PROVIDER)) {
            manager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 15000L, 0f, listener)
            latest = latest ?: manager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
        }
        if (manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)) {
            manager.requestLocationUpdates(LocationManager.NETWORK_PROVIDER, 15000L, 0f, listener)
            latest = latest ?: manager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
        }
    }

    private fun locationManager() = getSystemService(LocationManager::class.java)

    private fun clock() {
        if (!looping.get()) return
        Thread {
            val stop = runCatching { postOnce() }.getOrDefault(false)
            val wait = if (stop) 0L else min(30000L * (1L shl min(failures, 3)), 120000L)
            handler.post {
                if (stop) {
                    Prefs.setArmed(this, false)
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                } else if (looping.get()) {
                    handler.postDelayed({ clock() }, wait)
                }
            }
        }.start()
    }

    private fun postOnce(): Boolean {
        val cookie = CookieManager.getInstance().getCookie(Prefs.ORIGIN).orEmpty()
        if (!cookie.contains("ynhll_token=")) return false.also { failures += 1 }
        val orders = http("GET", "$API", cookie, null)
        if (orders.first == 401) return true
        if (orders.first !in 200..299) {
            failures += 1
            return false
        }
        val list = JSONObject(orders.second).optJSONArray("data") ?: JSONArray()
        val fix = latest
        if (list.length() == 0 || fix == null) {
            failures = 0
            return false
        }
        val speed = if (fix.hasSpeed() && fix.speed >= 0) (fix.speed * 3.6).roundToInt() else JSONObject.NULL
        val whenIso = java.time.Instant.ofEpochMilli(fix.time).toString()
        val status = Prefs.status(this)
        val reports = JSONArray()
        for (i in 0 until queue.length()) reports.put(queue.getJSONObject(i))
        for (i in 0 until list.length()) {
            val order = list.getJSONObject(i)
            val row = JSONObject()
            row.put("orderId", order.getString("id"))
            row.put("lat", fix.latitude)
            row.put("lng", fix.longitude)
            row.put("speedKmh", speed)
            row.put("statusText", status)
            row.put("recordedAt", whenIso)
            reports.put(row)
        }
        val body = JSONObject().put("reports", reports)
        val saved = http("POST", API, cookie, body.toString())
        if (saved.first == 401) return true
        if (saved.first !in 200..299) {
            failures += 1
            while (queue.length() > 0) queue.remove(0)
            val keep = min(reports.length(), 200)
            val start = reports.length() - keep
            for (i in start until reports.length()) queue.put(reports.getJSONObject(i))
            return false
        }
        while (queue.length() > 0) queue.remove(0)
        failures = 0
        return false
    }

    private fun http(method: String, url: String, cookie: String, body: String?): Pair<Int, String> {
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.requestMethod = method
        connection.connectTimeout = 15000
        connection.readTimeout = 15000
        connection.setRequestProperty("Cookie", cookie)
        connection.setRequestProperty("Accept", "application/json")
        if (body != null) {
            connection.doOutput = true
            connection.setRequestProperty("Content-Type", "application/json")
            connection.outputStream.use { it.write(body.toByteArray()) }
        }
        val code = connection.responseCode
        val stream = if (code in 200..299) connection.inputStream else connection.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
        connection.disconnect()
        return code to text
    }

    companion object {
        const val ACTION_STOP = "com.ants.driver.STOP"
        private const val CHANNEL = "ants-driver-share"
        private const val NOTIF_ID = 42
        private const val API = "${Prefs.ORIGIN}/api/driver/tracking"
    }
}
