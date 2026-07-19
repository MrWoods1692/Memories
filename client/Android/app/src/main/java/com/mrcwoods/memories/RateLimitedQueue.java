package com.mrcwoods.memories;

import android.os.Handler;
import android.os.Looper;

import java.util.ArrayDeque;
import java.util.Queue;

public class RateLimitedQueue {
    private final Queue<Runnable> queue = new ArrayDeque<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private boolean running;

    public void add(Runnable runnable) {
        queue.add(runnable);
        if (!running) {
            drain();
        }
    }

    public int size() {
        return queue.size();
    }

    private void drain() {
        running = true;
        int count = 0;
        while (count < AppConfig.RATE_LIMIT_MAX_ITEMS && !queue.isEmpty()) {
            Runnable runnable = queue.poll();
            if (runnable != null) {
                runnable.run();
            }
            count++;
        }
        if (queue.isEmpty()) {
            running = false;
            return;
        }
        handler.postDelayed(this::drain, AppConfig.RATE_LIMIT_WINDOW_MS);
    }
}