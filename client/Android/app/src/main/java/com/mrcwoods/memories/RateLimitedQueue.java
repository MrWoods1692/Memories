package com.mrcwoods.memories;

import android.os.Handler;
import android.os.Looper;

import java.util.ArrayDeque;
import java.util.Queue;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class RateLimitedQueue {
    private final Queue<Runnable> queue = new ArrayDeque<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
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
                // 在后台线程执行耗时操作，避免阻塞主线程
                executor.execute(runnable);
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