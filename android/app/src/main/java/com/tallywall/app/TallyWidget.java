package com.tallywall.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.os.Bundle;
import android.widget.RemoteViews;

import androidx.core.content.res.ResourcesCompat;

import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * The home-screen tally. The app sends a snapshot (src/domain/widget.js)
 * whenever the wall changes; this draws it. Between snapshots it has to
 * survive the day turning over on its own, following the same rule as
 * widgetViewFor() in widget.js:
 *   - the snapshot's own day: shown as sent;
 *   - the day after: progress restarts at zero, and the streak carries only
 *     if the routine was logged (or not due) on the snapshot's day;
 *   - later than that: no streak is claimed, and it asks for the app.
 *
 * The face is drawn here as one image in the app's pixel font, because a
 * launcher will not load an app's own fonts into a widget's text views.
 */
public class TallyWidget extends AppWidgetProvider {

    static final String PREFS = "tally_widget";
    static final String KEY_SNAPSHOT = "snapshot";
    private static final int MAX_MARKS = 20;

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, render(context, manager, id));
    }

    /** Resized on the home screen: redraw at the new size so it stays crisp. */
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager, int id, Bundle options) {
        manager.updateAppWidget(id, render(context, manager, id));
    }

    /** Redraw every placed widget, e.g. after the app sends a new snapshot. */
    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, TallyWidget.class));
        for (int id : ids) manager.updateAppWidget(id, render(context, manager, id));
    }

    private static final class Palette {
        final int bg, text, dim, accent, done;
        Palette(int bg, int text, int dim, int accent, int done) {
            this.bg = bg; this.text = text; this.dim = dim; this.accent = accent; this.done = done;
        }
    }

    private static final Palette MEDIEVAL = new Palette(
        R.drawable.widget_bg_medieval, 0xFFEAE6D2, 0xFF9A967F, 0xFFE0A458, 0xFF8FAE74);
    private static final Palette NEON = new Palette(
        R.drawable.widget_bg_neon, 0xFFE4E1FF, 0xFF8E8AB8, 0xFF3CE8FF, 0xFF45FFB0);

    /** What one widget shows: worked out first, then drawn. */
    private static final class Face {
        Palette palette = MEDIEVAL;
        String name = "TALLY WALL";
        String day = "DAY";
        Integer streak = null;
        String status = "OPEN THE WALL";
        int statusColor = MEDIEVAL.dim;
    }

    private static Face faceFor(Context context) {
        Face f = new Face();
        JSONObject snap = null;
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_SNAPSHOT, null);
            if (raw != null) snap = new JSONObject(raw);
        } catch (Exception ignored) { }
        // Placed before the app has ever run: say what it is, claim nothing.
        if (snap == null) return f;

        Palette p = "neon".equals(snap.optString("theme")) ? NEON : MEDIEVAL;
        JSONObject words = snap.optJSONObject("words");
        if (words == null) words = new JSONObject();

        String snapDate = snap.optString("date");
        String today = today(snap.optInt("cutoffHour", 0));
        JSONObject due = snap.optJSONObject("due");
        int done = 0;
        int total = 0;
        boolean stale = false;
        if (today.equals(snapDate)) {
            f.streak = snap.optInt("streak");
            done = snap.optInt("done");
            total = snap.optInt("total");
        } else if (today.equals(addDays(snapDate, 1))) {
            boolean carries = snap.optBoolean("activeDone") || !snap.optBoolean("activeDue");
            f.streak = carries ? snap.optInt("streak") : null;
            total = due != null && due.has(today) ? due.optInt(today) : snap.optInt("total");
        } else {
            stale = true;
        }

        f.palette = p;
        f.name = snap.optString("name");
        f.day = words.optString("day", "DAY");
        f.statusColor = p.dim;
        if (stale) {
            f.status = words.optString("stale", "OPEN THE WALL");
        } else if (total == 0) {
            f.status = words.optString("rest", "A DAY OF REST");
        } else if (done >= total) {
            f.status = words.optString("allDone", "ALL DONE");
            f.statusColor = p.done;
        } else {
            f.status = done + " / " + total + " " + words.optString("done", "DONE");
        }
        return f;
    }

    static RemoteViews render(Context context, AppWidgetManager manager, int id) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_tally);

        Intent open = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
        if (open != null) {
            PendingIntent pi = PendingIntent.getActivity(context, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.widget_root, pi);
        }

        Face f = faceFor(context);
        views.setInt(R.id.widget_root, "setBackgroundResource", f.palette.bg);

        // Drawn at the widget's real size, so the launcher never rescales the pixels.
        Bundle o = manager.getAppWidgetOptions(id);
        float density = context.getResources().getDisplayMetrics().density;
        int wDp = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 0);
        int hDp = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);
        if (wDp <= 0) wDp = 140;
        if (hDp <= 0) hDp = 140;
        int w = Math.round(wDp * density);
        int h = Math.round(hDp * density);
        // keep the image well inside what a widget update may carry
        float cap = Math.min(1f, 720f / Math.max(w, h));
        views.setImageViewBitmap(R.id.widget_canvas, draw(context, f, Math.round(w * cap), Math.round(h * cap)));
        views.setContentDescription(R.id.widget_canvas,
            f.name + ", " + f.day + " " + (f.streak == null ? "unknown" : f.streak) + ", " + f.status);
        return views;
    }

    /** The whole face of the widget, in the app's pixel font. */
    private static Bitmap draw(Context context, Face f, int w, int h) {
        Bitmap bmp = Bitmap.createBitmap(Math.max(w, 1), Math.max(h, 1), Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Typeface font = ResourcesCompat.getFont(context, R.font.press_start_2p);

        // One pixel of the art, sized from the widget so everything scales together.
        int u = Math.max(1, Math.min(w, h) / 64);
        Paint small = text(font, 4 * u, f.palette.dim);
        Paint big = text(font, 12 * u, f.palette.accent);
        Paint shadow = text(font, 12 * u, 0xFF000000);
        Paint status = text(font, 4 * u, f.statusColor);

        int pad = 6 * u;
        String name = ellipsize(f.name, small, w - 2 * pad);
        String number = f.streak == null ? "-" : String.valueOf(f.streak);
        String statusText = ellipsize(f.status, status, w - 2 * pad);
        boolean marks = f.streak != null && f.streak > 0;

        int gap = 5 * u;
        int marksH = 9 * u;
        int blockH = 4 * u + gap + 12 * u + (marks ? gap + marksH : 0) + gap + 4 * u;
        int y = (h - blockH) / 2;

        y += 4 * u;
        c.drawText(name, (w - small.measureText(name)) / 2f, y, small);

        y += gap + 12 * u;
        float dayW = small.measureText(f.day);
        float numW = big.measureText(number);
        float x = (w - (dayW + 3 * u + numW)) / 2f;
        c.drawText(f.day, x, y, small);
        c.drawText(number, x + dayW + 4 * u, y + u, shadow);
        c.drawText(number, x + dayW + 3 * u, y, big);

        if (marks) {
            y += gap;
            Bitmap m = drawMarks(Math.min(f.streak, MAX_MARKS), f.palette.text, u);
            c.drawBitmap(m, (w - m.getWidth()) / 2f, y, null);
            y += marksH;
        }

        y += gap + 4 * u;
        c.drawText(statusText, (w - status.measureText(statusText)) / 2f, y, status);
        return bmp;
    }

    private static Paint text(Typeface font, int size, int color) {
        Paint p = new Paint();
        p.setTypeface(font);
        p.setTextSize(size);
        p.setColor(color);
        // a pixel font drawn at whole multiples stays crisp without smoothing
        p.setAntiAlias(false);
        return p;
    }

    private static String ellipsize(String s, Paint p, int max) {
        if (s == null) return "";
        if (p.measureText(s) <= max) return s;
        String out = s;
        while (out.length() > 1 && p.measureText(out + "..") > max) out = out.substring(0, out.length() - 1);
        return out + "..";
    }

    /** Tally marks as crisp pixels: gates of four strokes and a slash. */
    private static Bitmap drawMarks(int count, int color, int u) {
        final int h = 9 * u;
        int gates = (count + 4) / 5;
        int width = gates * 10 * u - u;
        Bitmap bmp = Bitmap.createBitmap(Math.max(width, u), h, Bitmap.Config.ARGB_8888);
        Canvas c = new Canvas(bmp);
        Paint paint = new Paint();
        paint.setAntiAlias(false);
        paint.setColor(color);

        int drawn = 0;
        for (int g = 0; g < gates; g++) {
            int x0 = g * 10 * u;
            int inGate = Math.min(5, count - drawn);
            for (int s = 0; s < Math.min(4, inGate); s++) {
                int x = x0 + (1 + s * 2) * u;
                c.drawRect(x, u, x + u, h - u, paint);
            }
            if (inGate == 5) {
                // the fifth mark crosses the four, lower-left to upper-right
                for (int i = 0; i < 9; i++) {
                    int x = x0 + i * u;
                    int y = h - (i + 1) * u;
                    c.drawRect(x, y, x + u, y + u, paint);
                }
            }
            drawn += inGate;
        }
        return bmp;
    }

    /** Today as the app counts it: hours before the cutoff still belong to yesterday. */
    private static String today(int cutoffHour) {
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.HOUR_OF_DAY, -Math.max(0, cutoffHour));
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(cal.getTime());
    }

    private static String addDays(String date, int n) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            Calendar cal = Calendar.getInstance();
            cal.setTime(f.parse(date));
            cal.add(Calendar.DAY_OF_MONTH, n);
            return f.format(cal.getTime());
        } catch (Exception e) {
            return "";
        }
    }
}
