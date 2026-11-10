package uk.jase.goldtrader;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
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

/**
 * Home-screen widget. Uses exactly the same tested rule as the web app and the phone alerts:
 *   ext  = % above the 40-week average, mom4 = % change over 4 weeks
 *   strong sell: ext >= 20 and mom4 < 0, or ext >= 25
 *   sell zone  : ext >= 15 and mom4 < 0, or ext >= 18
 *   getting close: ext >= 10, otherwise hold
 * The 40-week average and the price 4 weeks ago come from widget.json (refreshed every 3 hours);
 * the price itself is live.
 */
public class GoldWidget extends AppWidgetProvider {

    static final String APP_URL = "https://jase6569.github.io/gold-sell-timer/";
    static final String ACTION_REFRESH = "uk.jase.goldtrader.REFRESH";
    static final double OZ = 31.1034768;
    static final String[] CALLS = {"Hold", "Hold: getting close", "Sell about a quarter", "Strong sell: sell more"};
    static final int[] COLOURS = {Color.parseColor("#CFC8B8"), Color.parseColor("#3FB27F"), Color.parseColor("#D4A843"), Color.parseColor("#F0CB6A")};

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
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(15000);
        c.setUseCaches(false);
        c.setRequestProperty("User-Agent", "GoldTraderWidget/1.0");
        try (BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            return sb.toString();
        } finally {
            c.disconnect();
        }
    }

    static String gbp(double v) {
        return String.format(Locale.UK, "£%.2f", v);
    }

    static void update(Context ctx) {
        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, GoldWidget.class));
        if (ids.length == 0) return;

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget);

        // tap the widget: open the full app; tap ↻: refresh now
        PendingIntent open = PendingIntent.getActivity(ctx, 0,
                new Intent(Intent.ACTION_VIEW, Uri.parse(APP_URL)), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent refresh = PendingIntent.getBroadcast(ctx, 1,
                new Intent(ctx, GoldWidget.class).setAction(ACTION_REFRESH),
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        v.setOnClickPendingIntent(R.id.root, open);
        v.setOnClickPendingIntent(R.id.refresh, refresh);

        String time = new SimpleDateFormat("HH:mm", Locale.UK).format(new Date());
        try {
            JSONObject w = new JSONObject(get(APP_URL + "widget.json?t=" + System.currentTimeMillis()));
            double price = w.getDouble("price_g");
            boolean live = false;
            try {
                double xau = new JSONObject(get("https://api.gold-api.com/price/XAU")).getDouble("price");
                double usdPerGbp = new JSONObject(get("https://open.er-api.com/v6/latest/GBP")).getJSONObject("rates").getDouble("USD");
                price = xau / usdPerGbp / OZ;
                live = true;
            } catch (Exception ignored) {
                // fall back to the last saved price
            }
            double ext = (price / w.getDouble("s40_g") - 1) * 100;
            double mom = (price / w.getDouble("p4_g") - 1) * 100;
            int t = tierOf(ext, mom);

            v.setTextViewText(R.id.price, gbp(price) + "/g");
            v.setTextViewText(R.id.call, CALLS[t]);
            v.setTextColor(R.id.call, COLOURS[t]);
            String zone = t >= 2
                    ? "Strong zone from " + gbp(w.getDouble("zone_strong_g")) + "/g"
                    : "Sell zone from " + gbp(w.getDouble("zone_sell_g")) + "/g";
            v.setTextViewText(R.id.zone, zone);
            v.setTextViewText(R.id.updated, (live ? "Live " : "Last close · ") + time
                    + String.format(Locale.UK, " · %+.1f%% vs avg", ext));
        } catch (Exception e) {
            v.setTextViewText(R.id.call, "Offline");
            v.setTextViewText(R.id.updated, "Couldn't update at " + time + ". Tap ↻ to retry");
        }
        mgr.updateAppWidget(ids, v);
    }
}
