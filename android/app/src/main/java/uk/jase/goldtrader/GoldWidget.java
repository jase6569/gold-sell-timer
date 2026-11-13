package uk.jase.goldtrader;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.widget.RemoteViews;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Home-screen widget. Uses exactly the same tested rule as the web app and the phone alerts:
 *   ext  = % above the 40-week average, mom4 = % change over 4 weeks
 *   strong sell: ext >= 20 and mom4 < 0, or ext >= 25
 *   sell zone  : ext >= 15 and mom4 < 0, or ext >= 18
 *   getting close: ext >= 10, otherwise hold
 * The 40-week average and the price 4 weeks ago come from widget.json (refreshed hourly);
 * the price itself is live. The last good reading is kept, so a failed refresh never blanks the widget.
 */
public class GoldWidget extends AppWidgetProvider {

    static final String APP_URL = "https://jase6569.github.io/gold-sell-timer/";
    static final String ACTION_REFRESH = "uk.jase.goldtrader.REFRESH";
    static final double OZ = 31.1034768;
    static final String[] CALLS = {"Don't build stock: send extra", "Fine to hold stock", "Sell zone: sell stock down", "Strong sell: clear stock"};
    static final int[] COLOURS = {Color.parseColor("#CFC8B8"), Color.parseColor("#3FB27F"), Color.parseColor("#D4A843"), Color.parseColor("#F0CB6A")};
    static final int GREY = Color.parseColor("#7D776B");
    static final int AMBER = Color.parseColor("#E3A33B");
    static final int RED = Color.parseColor("#E05D4F");

    @Override
    public void onUpdate(Context ctx, AppWidgetManager mgr, int[] ids) {
        refreshAsync(ctx);
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (ACTION_REFRESH.equals(intent.getAction())) refreshAsync(ctx);
    }

    static void requestRefresh(Context ctx) {
        ctx.sendBroadcast(new Intent(ctx, GoldWidget.class).setAction(ACTION_REFRESH));
    }

    private void refreshAsync(Context ctx) {
        final PendingResult pending = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(() -> {
            try {
                update(app);
            } catch (Throwable ignored) {
            } finally {
                pending.finish();
            }
        }).start();
    }

    static int tierOf(double ext, double mom) {
        if ((ext >= 20 && mom < 0) || ext >= 25) return 3;
        if ((ext >= 15 && mom < 0) || ext >= 18) return 2;
        if (ext >= 10) return 1;
        return 0;
    }

    static String get(String url) throws Exception {
        Exception last = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(url).openConnection();
                c.setConnectTimeout(8000);
                c.setReadTimeout(8000);
                c.setUseCaches(false);
                c.setInstanceFollowRedirects(true);
                c.setRequestProperty("User-Agent", "Mozilla/5.0 (Android) GoldTraderWidget/1.2");
                c.setRequestProperty("Accept", "application/json");
                int code = c.getResponseCode();
                if (code != 200) throw new Exception("HTTP " + code);
                try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = r.readLine()) != null) sb.append(line);
                    return sb.toString();
                }
            } catch (Exception e) {
                last = e;
                try { Thread.sleep(1200); } catch (InterruptedException ignored) { }
            } finally {
                if (c != null) c.disconnect();
            }
        }
        throw last;
    }

    static String gbp(double v) {
        return String.format(Locale.UK, "£%.2f", v);
    }

    static String reason(Exception e) {
        String n = e.getClass().getSimpleName();
        if (n.contains("UnknownHost")) return "no internet";
        if (n.contains("Timeout")) return "connection timed out";
        if (n.contains("SSL")) return "secure connection failed";
        if (n.contains("JSON")) return "bad data";
        String m = e.getMessage();
        return (m != null && m.startsWith("HTTP")) ? m : n;
    }

    static void update(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, GoldWidget.class));
        if (ids.length == 0) return;
        SharedPreferences prefs = ctx.getSharedPreferences("gold", Context.MODE_PRIVATE);
        String time = new SimpleDateFormat("HH:mm", Locale.UK).format(new Date());

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget);
        PendingIntent open = PendingIntent.getActivity(ctx, 0,
                new Intent(Intent.ACTION_VIEW, Uri.parse(APP_URL)), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent refresh = PendingIntent.getBroadcast(ctx, 1,
                new Intent(ctx, GoldWidget.class).setAction(ACTION_REFRESH),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.root, open);
        v.setOnClickPendingIntent(R.id.refresh, refresh);

        // show that a refresh is happening
        RemoteViews busy = new RemoteViews(ctx.getPackageName(), R.layout.widget);
        busy.setTextViewText(R.id.updated, "Refreshing…");
        busy.setTextColor(R.id.updated, GREY);
        mgr.partiallyUpdateAppWidget(ids, busy);

        JSONObject w = null;
        String err = null;
        try {
            w = new JSONObject(get(APP_URL + "widget.json?t=" + System.currentTimeMillis()));
            prefs.edit().putString("widget", w.toString()).apply();
        } catch (Exception e) {
            err = reason(e);
            try {
                String cached = prefs.getString("widget", null);
                if (cached != null) w = new JSONObject(cached);
            } catch (Exception ignored) { }
        }

        if (w == null) {
            v.setTextViewText(R.id.call, "Not loaded yet");
            v.setTextColor(R.id.call, COLOURS[0]);
            v.setTextViewText(R.id.updated, "Couldn't connect (" + err + ") at " + time + ". Tap ↻");
            v.setTextColor(R.id.updated, RED);
            mgr.updateAppWidget(ids, v);
            return;
        }

        try {
            double price = w.getDouble("price_g");
            boolean live = false;
            try {
                double xau = new JSONObject(get("https://api.gold-api.com/price/XAU")).getDouble("price");
                double usdPerGbp = new JSONObject(get("https://open.er-api.com/v6/latest/GBP")).getJSONObject("rates").getDouble("USD");
                price = xau / usdPerGbp / OZ;
                live = true;
                prefs.edit().putFloat("live", (float) price).putString("liveAt", time).apply();
            } catch (Exception e) {
                if (err == null) err = "live price: " + reason(e);
                float lp = prefs.getFloat("live", -1f);
                if (lp > 0) price = lp;
            }
            double ext = (price / w.getDouble("s40_g") - 1) * 100;
            double mom = (price / w.getDouble("p4_g") - 1) * 100;
            int tier = tierOf(ext, mom);
            // the gold dealer's call: how much stock to keep (steep slide = keep about a month's buying)
            int t = tier >= 3 ? 3 : tier == 2 ? 2 : (w.optBoolean("slide", false) ? 0 : 1);

            v.setTextViewText(R.id.price, gbp(price) + "/g");
            v.setTextViewText(R.id.call, CALLS[t]);
            v.setTextColor(R.id.call, COLOURS[t]);
            v.setTextViewText(R.id.zone, tier >= 2
                    ? "Strong zone from " + gbp(w.getDouble("zone_strong_g")) + "/g"
                    : "Sell zone from " + gbp(w.getDouble("zone_sell_g")) + "/g");

            String upd;
            int col;
            if (live && err == null) {
                upd = "Live " + time + String.format(Locale.UK, " · %+.1f%% vs avg", ext);
                col = GREY;
            } else {
                String since = prefs.getString("liveAt", null);
                upd = (since != null ? "Price from " + since : "Last saved price") + " · retry failed (" + err + ")";
                col = AMBER;
            }
            try {
                SimpleDateFormat iso = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.UK);
                iso.setTimeZone(TimeZone.getTimeZone("UTC"));
                long hours = (System.currentTimeMillis() - iso.parse(w.getString("updated")).getTime()) / 3600000L;
                if (hours > 12) {
                    upd = "⚠ Data " + hours + "h old, alerts may be paused";
                    col = RED;
                }
            } catch (Exception ignored) { }
            v.setTextViewText(R.id.updated, upd);
            v.setTextColor(R.id.updated, col);
        } catch (Exception e) {
            v.setTextViewText(R.id.updated, "Error (" + reason(e) + ") at " + time + ". Tap ↻");
            v.setTextColor(R.id.updated, RED);
        }
        mgr.updateAppWidget(ids, v);
    }
}
